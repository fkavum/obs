/**
 * Chat commands, as pure functions.
 *
 * Matching, permissions, cooldowns and text substitution all happen here with no
 * network and no clock of their own, so every rule is testable. The bridge layer
 * only decides when to call in and where to send the answer.
 */

/** Highest wins. A moderator satisfies a "subscriber only" command. */
const ROLE_RANK = { everyone: 0, subscriber: 1, vip: 2, moderator: 3, broadcaster: 4 };
export const PERMISSIONS = Object.keys(ROLE_RANK);

export function createCommand(overrides = {}) {
  return {
    id: overrides.id || `cmd-${Math.random().toString(36).slice(2, 9)}`,
    trigger: '!command',
    aliases: [],
    response: '',
    enabled: true,
    permission: 'everyone',
    cooldownSec: 5,         // per command, for everyone
    userCooldownSec: 15,    // per person
    platforms: [],          // empty = all
    count: 0,
    ...overrides,
  };
}

export function createRuntime() {
  return { lastRun: new Map(), lastRunByUser: new Map(), counts: new Map() };
}

/** What rank the chatter holds, from their normalized roles. */
export function rankOf(user) {
  const roles = user?.roles || [];
  return roles.reduce((best, role) => Math.max(best, ROLE_RANK[role] ?? 0), 0);
}

/**
 * Find the command a message invokes.
 * Triggers match case-insensitively and only at the very start of the message.
 */
export function matchCommand(commands, text) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('!')) return null;
  const [word, ...rest] = trimmed.split(/\s+/);
  const key = word.toLowerCase();
  for (const command of commands) {
    if (!command.enabled) continue;
    const names = [command.trigger, ...(command.aliases || [])].map((t) => String(t).toLowerCase());
    if (names.includes(key)) return { command, args: rest.join(' ') };
  }
  return null;
}

/**
 * May this command run right now? Returns a reason when not, so the caller can
 * stay silent rather than telling chat off - a bot that argues is worse than one
 * that says nothing.
 */
export function canRun(command, event, runtime, now = Date.now()) {
  if (command.platforms?.length && !command.platforms.includes(event.platform)) {
    return { ok: false, reason: 'platform' };
  }
  if (rankOf(event.user) < (ROLE_RANK[command.permission] ?? 0)) {
    return { ok: false, reason: 'permission' };
  }
  const last = runtime.lastRun.get(command.id) || 0;
  if (now - last < (command.cooldownSec || 0) * 1000) return { ok: false, reason: 'cooldown' };

  const userKey = `${command.id}:${event.platform}:${event.user?.id || event.user?.name || '?'}`;
  const lastUser = runtime.lastRunByUser.get(userKey) || 0;
  if (now - lastUser < (command.userCooldownSec || 0) * 1000) return { ok: false, reason: 'user-cooldown' };

  return { ok: true };
}

/** Record that it ran, so cooldowns and {count} work. */
export function markRun(command, event, runtime, now = Date.now()) {
  runtime.lastRun.set(command.id, now);
  runtime.lastRunByUser.set(`${command.id}:${event.platform}:${event.user?.id || event.user?.name || '?'}`, now);
  const next = (runtime.counts.get(command.id) || command.count || 0) + 1;
  runtime.counts.set(command.id, next);
  return next;
}

/**
 * Fill {placeholders}. Anything unknown becomes empty rather than being shown raw.
 * {random: a | b | c} picks one at random.
 */
export function renderResponse(template, vars) {
  return String(template || '')
    .replace(/\{random:([^}]*)\}/gi, (_, list) => {
      const options = list.split('|').map((o) => o.trim()).filter(Boolean);
      return options.length ? options[Math.floor(Math.random() * options.length)] : '';
    })
    .replace(/\{(\w+)\}/g, (_, key) => {
      const value = vars[key.toLowerCase()];
      return value === undefined || value === null ? '' : String(value);
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Strip anything that would make the streamer's account run a platform command.
 * A response is streamer-written, but {args} is not - without this, a viewer
 * could type `!echo /ban someone` and have the bot execute it as the broadcaster.
 */
export function sanitizeOutgoing(text, maxLength = 400) {
  return String(text || '')
    .replace(/[\r\n\u2028\u2029]+/g, ' ')
    .replace(/^[\s/.]+/, '')   // leading / or . would be a chat command
    .slice(0, maxLength)
    .trim();
}

/**
 * The whole decision for one chat message.
 * @returns {null | { command, reply, platform, count }}
 */
export function handleMessage(commands, event, runtime, context = {}, now = Date.now()) {
  if (event?.type !== 'chat') return null;
  const match = matchCommand(commands, event.data?.text);
  if (!match) return null;

  const allowed = canRun(match.command, event, runtime, now);
  if (!allowed.ok) return null;

  const count = markRun(match.command, event, runtime, now);
  const args = sanitizeOutgoing(match.args, 200);
  const reply = sanitizeOutgoing(renderResponse(match.command.response, {
    user: event.user?.displayName || event.user?.name || 'friend',
    channel: event.channel || '',
    platform: event.platform,
    args,
    target: args || event.user?.displayName || event.user?.name || '',
    count,
    ...context,
  }));

  if (!reply) return null;
  return { command: match.command, reply, platform: event.platform, count };
}

/**
 * Which auto-message should go out now, if any.
 * `minChatLines` stops a dead chat being spammed by the bot talking to itself.
 */
export function dueAutoMessage(autoMessages, runtime, { now = Date.now(), chatLinesSince = 0 } = {}) {
  const active = autoMessages.filter((m) => m.enabled && m.text?.trim());
  if (!active.length) return null;

  const lastAny = runtime.lastAutoAt || 0;
  const index = runtime.autoIndex || 0;
  const message = active[index % active.length];
  const intervalMs = Math.max(30, message.intervalSec || 600) * 1000;

  if (now - lastAny < intervalMs) return null;
  if (chatLinesSince < (message.minChatLines ?? 0)) return null;
  return message;
}

export function markAutoSent(runtime, autoMessages, now = Date.now()) {
  runtime.lastAutoAt = now;
  runtime.autoIndex = ((runtime.autoIndex || 0) + 1) % Math.max(1, autoMessages.filter((m) => m.enabled).length);
}
