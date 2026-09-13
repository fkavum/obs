/**
 * Twitch-shaped payloads in, normalized events out.
 * Everything Twitch-specific stops here -- nothing outside this folder knows
 * what an IRC tag or an EventSub notification looks like.
 */
import { makeEvent, buildFragments } from '#core/index.js';

const EMOTE_CDN = 'https://static-cdn.jtvnw.net/emoticons/v2';

/**
 * Parse one IRC line into { tags, prefix, command, params }.
 * Returns null for blank lines.
 */
export function parseIRC(line) {
  if (!line) return null;
  let rest = line;
  const tags = {};

  if (rest.startsWith('@')) {
    const end = rest.indexOf(' ');
    for (const pair of rest.slice(1, end).split(';')) {
      const eq = pair.indexOf('=');
      const key = eq === -1 ? pair : pair.slice(0, eq);
      const value = eq === -1 ? '' : pair.slice(eq + 1);
      tags[key] = unescapeTag(value);
    }
    rest = rest.slice(end + 1);
  }

  let prefix = '';
  if (rest.startsWith(':')) {
    const end = rest.indexOf(' ');
    prefix = rest.slice(1, end);
    rest = rest.slice(end + 1);
  }

  // The trailing parameter (after " :") may contain spaces.
  const trailingAt = rest.indexOf(' :');
  let head = rest;
  let trailing = null;
  if (trailingAt !== -1) {
    head = rest.slice(0, trailingAt);
    trailing = rest.slice(trailingAt + 2);
  }
  const parts = head.split(' ').filter(Boolean);
  const command = parts.shift() || '';
  if (trailing !== null) parts.push(trailing);

  return { tags, prefix, command, params: parts };
}

function unescapeTag(v) {
  return v
    .replace(/\\s/g, ' ')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\:/g, ';')
    .replace(/\\\\/g, '\\');
}

/** Twitch's `emotes` tag -> the emote list buildFragments expects. */
export function parseEmotes(tag) {
  if (!tag) return [];
  const out = [];
  for (const chunk of tag.split('/')) {
    const [id, ranges] = chunk.split(':');
    if (!id || !ranges) continue;
    for (const range of ranges.split(',')) {
      const [start, end] = range.split('-').map(Number);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      out.push({ id, start, end, name: '', url: `${EMOTE_CDN}/${id}/default/dark/2.0` });
    }
  }
  return out;
}

export function rolesFromTags(tags, channel) {
  const roles = [];
  const badges = tags.badges || '';
  if (tags.mod === '1' || badges.includes('moderator/')) roles.push('moderator');
  if (tags.subscriber === '1' || badges.includes('subscriber/')) roles.push('subscriber');
  if (badges.includes('vip/')) roles.push('vip');
  if (badges.includes('broadcaster/') || (tags['display-name'] || '').toLowerCase() === channel) roles.push('broadcaster');
  if (badges.includes('staff/') || badges.includes('admin/')) roles.push('staff');
  return roles;
}

/** PRIVMSG -> normalized chat event. */
export function chatEvent({ tags, params, prefix }, channelName) {
  const text = params[1] ?? '';
  const login = (prefix.split('!')[0] || tags['display-name'] || '').toLowerCase();
  const emotes = parseEmotes(tags.emotes);

  return makeEvent({
    id: tags.id || undefined,
    type: 'chat',
    platform: 'twitch',
    channel: channelName,
    ts: tags['tmi-sent-ts'] ? Number(tags['tmi-sent-ts']) : Date.now(),
    user: {
      id: tags['user-id'] || login,
      name: login,
      displayName: tags['display-name'] || login,
      roles: rolesFromTags(tags, channelName),
      color: tags.color || null,
    },
    data: {
      text,
      fragments: buildFragments(text, emotes),
      replyTo: tags['reply-parent-msg-id'] || undefined,
    },
  });
}

/** CLEARCHAT / CLEARMSG -> moderation events. */
export function moderationEvent(msg, channelName) {
  if (msg.command === 'CLEARMSG') {
    return makeEvent({
      type: 'chat.delete',
      platform: 'twitch',
      channel: channelName,
      data: { messageId: msg.tags['target-msg-id'] || '' },
    });
  }
  return makeEvent({
    type: 'chat.clear',
    platform: 'twitch',
    channel: channelName,
    data: { userId: msg.tags['target-user-id'] || undefined },
  });
}

/** An EventSub notification payload -> normalized event, or null if unmapped. */
export function eventSubEvent(subscriptionType, payload, channelName) {
  const user = {
    id: payload.user_id || payload.from_broadcaster_user_id || '',
    name: payload.user_login || payload.from_broadcaster_user_login || '',
    displayName: payload.user_name || payload.from_broadcaster_user_name || '',
    roles: [],
    color: null,
  };
  const base = { platform: 'twitch', channel: channelName, user };

  switch (subscriptionType) {
    case 'channel.follow':
      return makeEvent({ ...base, type: 'follow', data: {} });
    case 'channel.subscribe':
      return makeEvent({ ...base, type: 'subscription', data: { tier: tierOf(payload.tier), months: 1, isGift: !!payload.is_gift } });
    case 'channel.subscription.message':
      return makeEvent({ ...base, type: 'subscription', data: { tier: tierOf(payload.tier), months: payload.cumulative_months || 1, isGift: false, message: payload.message?.text || '' } });
    case 'channel.subscription.gift':
      return makeEvent({ ...base, type: 'subscription', data: { tier: tierOf(payload.tier), months: 1, isGift: true, giftCount: payload.total || 1 } });
    case 'channel.cheer':
      return makeEvent({ ...base, type: 'donation', data: { amount: payload.bits || 0, currency: 'bits', message: payload.message || '' } });
    case 'channel.raid':
      return makeEvent({
        ...base,
        type: 'raid',
        data: { viewers: payload.viewers || 0, fromChannel: payload.from_broadcaster_user_login || '' },
      });
    default:
      return null;
  }
}

function tierOf(tier) {
  return { 1000: '1', 2000: '2', 3000: '3' }[tier] || String(tier || '1');
}
