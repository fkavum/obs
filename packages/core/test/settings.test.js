import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSettings, toQuery, CHAT_SETTINGS } from '#core/settings-schema.js';

test('a malformed URL never produces a broken overlay', () => {
  const s = parseSettings('bgOpacity=9999&border=not-a-border&fontSize=abc&layout=sideways&icons=maybe');
  assert.equal(s.bgOpacity, 100, 'out-of-range numbers clamp');
  assert.equal(s.border, CHAT_SETTINGS.border.default, 'unknown option falls back');
  assert.equal(s.fontSize, CHAT_SETTINGS.fontSize.default, 'non-numeric falls back');
  assert.equal(s.layout, 'vertical', 'unknown layout falls back');
  assert.equal(s.icons, true, 'unparseable toggle falls back');
});

test('unknown parameters are ignored rather than throwing', () => {
  const s = parseSettings('somethingWeInvented=1&layout=horizontal');
  assert.equal(s.layout, 'horizontal');
  assert.equal(s.somethingWeInvented, undefined);
});

test('horizontal layout gets its own sensible anchor and flow', () => {
  const s = parseSettings('layout=horizontal');
  assert.equal(s.anchor, 'bottom');
  assert.equal(s.flow, 'newest-right');
  // ...but an explicit choice still wins
  assert.equal(parseSettings('layout=horizontal&anchor=top').anchor, 'top');
});

test('vertical layout rejects a horizontal-only anchor', () => {
  assert.equal(parseSettings('layout=vertical&anchor=bottom').anchor, 'left');
});

test('explicit settings override a theme preset', () => {
  assert.equal(parseSettings('theme=neon').border, 'glow');
  assert.equal(parseSettings('theme=neon&border=pill').border, 'pill');
});

test('per-platform colour overrides are read from the adapter id', () => {
  const s = parseSettings('bgColor.twitch=%23ff0000&bgColor.kick=nope');
  assert.deepEqual(s.platformBg, { twitch: '#ff0000' }, 'invalid colours are dropped');
});

test('settings survive a round trip through the URL', () => {
  const original = parseSettings('layout=horizontal&scale=140&border=glow&hideBots=a,b&bgColor.kick=%2300ff00');
  const restored = parseSettings(toQuery(original));
  for (const key of Object.keys(CHAT_SETTINGS)) {
    assert.deepEqual(restored[key], original[key], `setting "${key}" survived`);
  }
  assert.deepEqual(restored.platformBg, original.platformBg);
});

test('defaults are omitted from the URL to keep it short', () => {
  assert.equal(toQuery(parseSettings('')), '');
});
