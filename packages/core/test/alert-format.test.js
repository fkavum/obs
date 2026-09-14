import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldAlert, formatAlert, fillTemplate, formatAmount } from '#core/alert-format.js';
import { parseSettings, ALERT_SETTINGS, ALERT_THEMES } from '#core/settings-schema.js';

const defaults = parseSettings('', ALERT_SETTINGS, ALERT_THEMES);
const ev = (type, data = {}, extra = {}) => ({
  id: 'x', type, platform: 'twitch', ts: 0, channel: 'c',
  user: { id: '1', name: 'pixelpete', displayName: 'PixelPete', roles: [], color: null, avatar: null },
  data, ...extra,
});

test('chat is never an alert; the four alert types are', () => {
  assert.equal(shouldAlert(ev('chat', { text: 'hi' }), defaults), false);
  for (const t of ['follow', 'subscription', 'donation', 'raid']) assert.equal(shouldAlert(ev(t), defaults), true, t);
});

test('each alert type has its own on/off switch', () => {
  assert.equal(shouldAlert(ev('follow'), { ...defaults, follows: false }), false);
  assert.equal(shouldAlert(ev('raid'), { ...defaults, raids: false }), false);
  assert.equal(shouldAlert(ev('donation'), { ...defaults, donations: false }), false);
});

test('minimum tip and minimum raid size are respected', () => {
  assert.equal(shouldAlert(ev('donation', { amount: 2, currency: 'USD' }), { ...defaults, minDonation: 5 }), false);
  assert.equal(shouldAlert(ev('donation', { amount: 5, currency: 'USD' }), { ...defaults, minDonation: 5 }), true);
  assert.equal(shouldAlert(ev('raid', { viewers: 3 }), { ...defaults, minRaid: 10 }), false);
});

test('platform filter applies', () => {
  assert.equal(shouldAlert(ev('follow'), { ...defaults, platforms: ['kick'] }), false);
  assert.equal(shouldAlert(ev('follow'), { ...defaults, platforms: ['twitch'] }), true);
});

test('default wording for every kind', () => {
  assert.equal(formatAlert(ev('follow'), defaults).headline, 'PixelPete just followed!');
  assert.equal(formatAlert(ev('subscription', { tier: '1', months: 1 }), defaults).headline, 'PixelPete just subscribed!');
  assert.equal(formatAlert(ev('subscription', { tier: '1', months: 7 }), defaults).headline, 'PixelPete resubscribed for 7 months!');
  assert.equal(formatAlert(ev('subscription', { isGift: true, giftCount: 5 }), defaults).headline, 'PixelPete gifted 5 subs!');
  assert.equal(formatAlert(ev('raid', { viewers: 250 }), defaults).headline, 'PixelPete is raiding with 250 viewers!');
});

test('tips show money in its own currency and bits as a count', () => {
  const usd = formatAlert(ev('donation', { amount: 20, currency: 'USD', message: 'gg' }), defaults);
  assert.match(usd.headline, /PixelPete tipped .*20/);
  assert.equal(usd.message, 'gg');
  assert.equal(usd.chime, 'bright');
  assert.equal(formatAmount(500, 'bits'), '500 bits');
  assert.equal(formatAmount(7, ''), '7 bits');
});

test('the attached message can be hidden', () => {
  const a = formatAlert(ev('donation', { amount: 5, currency: 'EUR', message: 'secret' }), { ...defaults, showMessage: false });
  assert.equal(a.message, '');
});

test('custom wording with placeholders, unknown placeholders vanish', () => {
  const a = formatAlert(ev('follow'), { ...defaults, followText: 'Welcome {name} from {platform}! {nope}' });
  assert.equal(a.headline, 'Welcome PixelPete from twitch!');
  assert.equal(fillTemplate('{a}  {b}', { a: 'x' }), 'x');
});

test('highlights carry the number worth emphasising and raids get the big chime', () => {
  assert.equal(formatAlert(ev('raid', { viewers: 1234 }), defaults).highlight, '1,234');
  assert.equal(formatAlert(ev('raid', { viewers: 1234 }), defaults).chime, 'big');
  assert.equal(formatAlert(ev('subscription', { isGift: true, giftCount: 3 }), defaults).highlight, '×3');
});

test('alert settings parse, clamp and round-trip like chat settings', async () => {
  const { toQuery } = await import('#core/settings-schema.js');
  const s = parseSettings('position=bottom&duration=999&border=bogus&followText=Hi%20{name}', ALERT_SETTINGS, ALERT_THEMES);
  assert.equal(s.position, 'bottom');
  assert.equal(s.duration, 30, 'clamped');
  assert.equal(s.border, 'glow', 'fallback');
  assert.equal(s.followText, 'Hi {name}');
  assert.equal(parseSettings('theme=banner', ALERT_SETTINGS, ALERT_THEMES).width, 1200, 'alert themes apply');
  const back = parseSettings(toQuery(s, ALERT_SETTINGS), ALERT_SETTINGS, ALERT_THEMES);
  assert.equal(back.followText, 'Hi {name}');
  assert.equal(back.position, 'bottom');
});

test('chat themes and alert themes do not bleed into each other', () => {
  assert.equal(parseSettings('theme=neon', ALERT_SETTINGS, ALERT_THEMES).border, 'glow');
  assert.equal(parseSettings('theme=banner').layout, 'vertical', 'an alert-only theme name is ignored by chat');
});
