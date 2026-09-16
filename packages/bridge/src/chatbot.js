/**
 * Runs chat commands and rotating auto-messages.
 *
 * All the rules live in the pure engine; this part only watches the event
 * stream, decides which platform should answer, and asks that adapter to send.
 *
 * Reading commands needs no account. REPLYING does - a platform will not let an
 * anonymous connection talk - so the bot stays quiet on any platform that is not
 * signed in, rather than failing loudly every message.
 *
 * When it cannot talk, the answer still goes onto your own overlays as a local
 * chat line. A reply that was sent for real needs no help: the platform echoes
 * our own message back and the overlays draw it like any other. It is only the
 * reply that never left the building that would otherwise vanish, which is why
 * a command looks broken in the rehearsal room and on any channel the bot is
 * not signed in to.
 */
import { createLogger, makeEvent } from '#core/index.js';
import {
  createCommand, createRuntime, handleMessage, dueAutoMessage, markAutoSent, sanitizeOutgoing,
} from '#core/command-engine.js';
import { formatUptime } from '#core/stats-model.js';
import { saveConfig } from './config.js';
import { loadData, saveData, resetData } from './store.js';

const log = createLogger('chatbot');
// What an unsent reply is attributed to on the overlays. Not a platform name,
// and not the operator's channel, so it means the same thing on every install.
const BOT_NAME = 'Bot';

export function createChatbot({ config, hub }) {
  const runtime = createRuntime();
  let timer = null;
  let chatLinesSince = 0;
  // Kick's chat socket echoes our own messages back, so without this a reply
  // containing a trigger would set the bot answering itself forever.
  const recentlySent = [];
  let liveSince = null;
  const viewers = new Map();

  // Each lives in its own file, copied from the shipped examples on first read.
  const commands = () => loadData(config, 'commands', []) || [];
  const autoMessages = () => loadData(config, 'autoMessages', []) || [];

  /**
   * Which platforms the bot is allowed AND actually able to talk on.
   * Every adapter HAS a send() - what decides it is whether that platform is
   * signed in, since none of them let an anonymous connection talk.
   */
  function sendablePlatforms() {
    const allowed = config.chatbot?.sendTo || [];
    return [...hub.platforms.entries()]
      .filter(([id, entry]) => {
        if (!entry.adapter || typeof entry.adapter.send !== 'function') return false;
        if (allowed.length && !allowed.includes(id)) return false;
        let health = {};
        try {
          health = entry.adapter.health?.() || {};
        } catch {
          return false;
        }
        // `signedIn` is only reported by adapters that can be anonymous; one
        // that has no anonymous mode is sendable as soon as it is connected.
        return health.signedIn !== false && health.connected !== false;
      })
      .map(([id]) => id);
  }

  async function sendTo(platformId, text) {
    const entry = hub.platforms.get(platformId);
    if (!entry?.adapter?.send) return false;
    try {
      await entry.adapter.send(text);
      recentlySent.push({ text, at: Date.now() });
      while (recentlySent.length > 20) recentlySent.shift();
      return true;
    } catch (err) {
      // Not signed in is the normal case, not an incident; say it once quietly.
      log.debug(`${platformId}: ${err.message}`);
      return false;
    }
  }

  function context() {
    const total = [...viewers.values()].reduce((a, b) => a + b, 0);
    return {
      uptime: liveSince ? formatUptime(Date.now() - liveSince) : 'a bit',
      viewers: total || '',
      commands: commands().filter((c) => c.enabled).map((c) => c.trigger).join(' '),
    };
  }

  const onEvent = async (event) => {
    if (event.type === 'viewers') {
      viewers.set(event.platform, Number(event.data?.count) || 0);
      if (!liveSince) liveSince = Date.now();
      return;
    }
    if (event.type === 'stream.state') {
      if (event.data?.live && !liveSince) liveSince = Date.now();
      return;
    }
    if (event.type !== 'chat') return;

    chatLinesSince += 1;
    if (!config.chatbot?.enabled) return;
    // Never answer ourselves: a bot replying to its own message is a loop.
    if (event.user?.self) return;
    const text = event.data?.text || '';
    const cutoff = Date.now() - 15000;
    if (recentlySent.some((m) => m.at > cutoff && m.text === text)) return;

    const result = handleMessage(commands(), event, runtime, context());
    if (!result) return;

    // Answer where it was asked, which is what a viewer expects.
    const ok = await sendTo(result.platform, result.reply);
    if (!ok) showLocally(result.platform, result.reply);
    log[ok ? 'info' : 'debug'](`${result.command.trigger} on ${result.platform}${ok ? '' : ' (shown locally only)'}`);
  };

  /**
   * Put a reply the bot could not send onto the overlays anyway.
   *
   * Tagged with the platform it was asked on so it sits in the right place in a
   * chat overlay, and recorded as ours first - `user.self` does not survive
   * makeEvent, so `recentlySent` is what actually stops the bot answering its
   * own answer if a reply happens to contain a trigger.
   */
  function showLocally(platform, reply) {
    recentlySent.push({ text: reply, at: Date.now() });
    while (recentlySent.length > 20) recentlySent.shift();
    hub.inject(makeEvent({
      type: 'chat',
      platform,
      user: { id: 'bot', name: 'bot', displayName: BOT_NAME },
      data: { text: reply, fragments: [{ type: 'text', text: reply }] },
    }));
  }

  async function tickAuto() {
    if (!config.chatbot?.enabled) return;
    const message = dueAutoMessage(autoMessages(), runtime, { chatLinesSince });
    if (!message) return;
    const text = sanitizeOutgoing(message.text);
    if (!text) return;
    const targets = sendablePlatforms();
    let sent = 0;
    for (const id of targets) if (await sendTo(id, text)) sent += 1;
    if (sent) {
      markAutoSent(runtime, autoMessages());
      chatLinesSince = 0;
      log.info(`auto-message sent to ${sent} platform(s)`);
    }
  }

  return {
    start() {
      // How anything else in the toolkit says something in chat, without
      // knowing which platforms exist or whether they are signed in.
      hub.say = async (platformId, text) => {
        const clean = sanitizeOutgoing(text);
        if (!clean) return false;
        if (platformId) return sendTo(platformId, clean);
        let sent = false;
        for (const id of sendablePlatforms()) if (await sendTo(id, clean)) sent = true;
        return sent;
      };
      hub.on('event', onEvent);
      timer = setInterval(tickAuto, 15000);
      timer.unref?.();
    },
    stop() {
      delete hub.say;
      hub.off('event', onEvent);
      clearInterval(timer);
    },
    getCommands: commands,
    getAutoMessages: autoMessages,
    save({ commands: nextCommands, autoMessages: nextAuto, chatbot }) {
      if (Array.isArray(nextCommands)) saveData(config, 'commands', nextCommands.map((c) => createCommand(c)));
      if (Array.isArray(nextAuto)) saveData(config, 'autoMessages', nextAuto);
      if (chatbot) {
        config.chatbot = { ...config.chatbot, ...chatbot };
        saveConfig(config);
      }
      return this.status();
    },

    /** Put the shipped example commands back, losing local edits to them. */
    restore(which = 'commands') {
      resetData(config, which === 'autoMessages' ? 'autoMessages' : 'commands');
      return this.status();
    },
    /** One fake run of a command, for the Test button. */
    test(trigger) {
      const event = {
        id: 'test', type: 'chat', platform: sendablePlatforms()[0] || 'twitch', ts: Date.now(), channel: '',
        user: { id: 'test', name: 'you', displayName: 'You', roles: ['broadcaster'], color: null, avatar: null },
        data: { text: trigger },
      };
      // A fresh runtime so cooldowns never block a deliberate test.
      const result = handleMessage(commands(), event, createRuntime(), context());
      return result ? { ok: true, reply: result.reply } : { ok: false, reply: '' };
    },
    status() {
      return {
        enabled: !!config.chatbot?.enabled,
        canSendOn: sendablePlatforms(),
        commands: commands(),
        autoMessages: autoMessages(),
        sendTo: config.chatbot?.sendTo || [],
      };
    },
  };
}
