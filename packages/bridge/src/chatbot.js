/**
 * Runs chat commands and rotating auto-messages.
 *
 * All the rules live in the pure engine; this part only watches the event
 * stream, decides which platform should answer, and asks that adapter to send.
 *
 * Reading commands needs no account. REPLYING does - a platform will not let an
 * anonymous connection talk - so the bot stays quiet on any platform that is not
 * signed in, rather than failing loudly every message.
 */
import { createLogger } from '#core/index.js';
import {
  createCommand, createRuntime, handleMessage, dueAutoMessage, markAutoSent, sanitizeOutgoing,
} from '#core/command-engine.js';
import { formatUptime } from '#core/stats-model.js';
import { saveConfig } from './config.js';
import { loadData, saveData, resetData } from './store.js';

const log = createLogger('chatbot');

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
    log[ok ? 'info' : 'debug'](`${result.command.trigger} on ${result.platform}${ok ? '' : ' (could not send)'}`);
  };

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
      hub.on('event', onEvent);
      timer = setInterval(tickAuto, 15000);
      timer.unref?.();
    },
    stop() {
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
