/**
 * The normalized event schema. Every platform adapter emits these shapes and
 * nothing else, so overlays never learn which platform they're talking to
 * unless they choose to care.
 *
 * Contract: adding a platform must never change this file.
 */

export const EVENT_TYPES = /** @type {const} */ ([
  'chat',
  'chat.delete',
  'chat.clear',
  'follow',
  'subscription',
  'donation',
  'raid',
  'viewers',
  'stream.state',
  'system',
]);

export const ROLES = /** @type {const} */ ([
  'broadcaster',
  'moderator',
  'subscriber',
  'vip',
  'verified',
  'staff',
]);

/**
 * Build a normalized event envelope.
 * @param {object} input
 * @param {string} input.type      one of EVENT_TYPES
 * @param {string} input.platform  adapter id, e.g. 'twitch'
 * @param {string} [input.channel]
 * @param {object} [input.user]
 * @param {object} [input.data]
 * @param {number} [input.ts]
 * @param {string} [input.id]
 */
export function makeEvent({ type, platform, channel = '', user = null, data = {}, ts, id }) {
  return {
    id: id || crypto.randomUUID(),
    type,
    platform,
    ts: ts ?? Date.now(),
    channel,
    user: user ? normalizeUser(user) : null,
    data,
  };
}

export function normalizeUser({
  id = '',
  name = '',
  displayName = '',
  avatar = null,
  roles = [],
  color = null,
}) {
  return {
    id: String(id),
    name: String(name),
    displayName: String(displayName || name),
    avatar: avatar || null,
    roles: roles.filter((r) => ROLES.includes(r)),
    color: color || null,
  };
}

/**
 * Split message text into renderable fragments so overlays never re-parse it.
 * @param {string} text
 * @param {Array<{start:number,end:number,id:string,name:string,url:string}>} emotes
 *   Positions are inclusive character indices into `text`, as Twitch reports them.
 * @returns {Array<{type:'text',text:string}|{type:'emote',name:string,url:string,id:string}>}
 */
export function buildFragments(text, emotes = []) {
  if (!emotes.length) return text ? [{ type: 'text', text }] : [];

  // Work in code points: emote indices count characters, not UTF-16 units, so a
  // single astral-plane character earlier in the message would otherwise shift
  // every emote after it.
  const chars = [...text];
  const sorted = [...emotes].sort((a, b) => a.start - b.start);
  const out = [];
  let cursor = 0;

  for (const e of sorted) {
    if (e.start < cursor || e.start > chars.length) continue; // overlapping or out of range
    if (e.start > cursor) {
      out.push({ type: 'text', text: chars.slice(cursor, e.start).join('') });
    }
    out.push({ type: 'emote', name: e.name, url: e.url, id: e.id });
    cursor = e.end + 1;
  }
  if (cursor < chars.length) {
    out.push({ type: 'text', text: chars.slice(cursor).join('') });
  }
  return out;
}

/** True when the event looks structurally valid. Cheap guard, not a validator. */
export function isEvent(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    EVENT_TYPES.includes(value.type) &&
    typeof value.platform === 'string'
  );
}
