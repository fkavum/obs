import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'obs-config-flow-'));
process.env.OBS_TOOLKIT_CONFIG_DIR = dir;
const { loadConfig, saveConfig, setPlatformConfig, resetToSeed, CONFIG_PATH, SEED_PATH } = await import('../src/config.js');
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const writeSeed = (obj) => writeFileSync(SEED_PATH, JSON.stringify(obj));
const readWorking = () => JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
const fresh = () => rmSync(CONFIG_PATH, { force: true });

test('first run copies the seed into the working file', () => {
  fresh();
  writeSeed({ platforms: { twitch: { channel: 's0mcs', enabled: true } }, commands: [{ trigger: '!hi' }] });
  const config = loadConfig();
  assert.equal(existsSync(CONFIG_PATH), true, 'the working file is created immediately');
  assert.equal(config.platforms.twitch.channel, 's0mcs');
  assert.deepEqual(readWorking().commands, [{ trigger: '!hi' }], 'seed contents are really on disk, not just in memory');
});

test('an existing working file is never overwritten by the seed', () => {
  fresh();
  writeSeed({ platforms: { twitch: { channel: 'seed-name', enabled: true } } });
  loadConfig();
  setPlatformConfig(loadConfig(), 'twitch', { channel: 'my-name', accessToken: 'secret-token' });

  // The operator edits the seed afterwards - their own value and token must survive.
  writeSeed({ platforms: { twitch: { channel: 'different-seed-name', enabled: true } } });
  const config = loadConfig();
  assert.equal(config.platforms.twitch.channel, 'my-name', 'their change wins');
  assert.equal(config.platforms.twitch.accessToken, 'secret-token', 'and their token is intact');
});

test('a new setting added by an update is filled in without touching anything else', () => {
  fresh();
  writeSeed({ platforms: { twitch: { channel: 'mine' } } });
  loadConfig();
  setPlatformConfig(loadConfig(), 'twitch', { accessToken: 'keep-me' });

  // A later version ships a seed with a section that genuinely did not exist
  // before, so the working file has no opinion about it yet.
  writeSeed({ platforms: { twitch: { channel: 'mine' } }, giveaway: { keyword: '!enter' } });
  const config = loadConfig();
  assert.deepEqual(config.giveaway, { keyword: '!enter' }, 'the new section appears');
  assert.equal(config.platforms.twitch.accessToken, 'keep-me', 'the token is still there');
  assert.equal(readWorking().giveaway.keyword, '!enter', 'and it was written to disk');
});

test('defaults cover anything the seed forgot', () => {
  fresh();
  writeSeed({});
  const config = loadConfig();
  assert.equal(config.bridge.httpPort, 8778);
  assert.equal(config.obs.url, 'ws://127.0.0.1:4455');
  assert.deepEqual(config.commands, []);
  assert.equal(config.presetsFile, 'presets.json');
});

test('the $comment in the seed is not copied into the working file', () => {
  fresh();
  writeSeed({ $comment: 'explain yourself', platforms: {} });
  loadConfig();
  assert.equal(readWorking().$comment, undefined);
});

test('undefined removes a saved key, which is how Disconnect forgets a login', () => {
  fresh();
  writeSeed({ platforms: { twitch: { channel: 'mine', enabled: true } } });
  const config = loadConfig();
  setPlatformConfig(config, 'twitch', { accessToken: 'tok' });
  setPlatformConfig(config, 'twitch', { accessToken: undefined });
  assert.equal(config.platforms.twitch.accessToken, undefined);
  assert.equal(config.platforms.twitch.channel, 'mine', 'the rest is untouched');
  assert.equal(readWorking().platforms.twitch.accessToken, undefined);
});

test('reset throws the working file away and starts from the seed again', () => {
  fresh();
  writeSeed({ platforms: { twitch: { channel: 'seed-name' } } });
  const config = loadConfig();
  setPlatformConfig(config, 'twitch', { channel: 'changed', accessToken: 'tok' });
  assert.equal(readWorking().platforms.twitch.channel, 'changed');

  resetToSeed();
  assert.equal(readWorking().platforms.twitch.channel, 'seed-name');
  assert.equal(readWorking().platforms.twitch.accessToken, undefined, 'tokens are gone too');
});

test('a corrupt seed is ignored rather than fatal', () => {
  fresh();
  writeFileSync(SEED_PATH, '{ not json at all');
  const config = loadConfig();
  assert.equal(config.bridge.httpPort, 8778, 'falls back to defaults and still starts');
});

test('a corrupt working file does not stop the bridge', () => {
  writeSeed({ platforms: { twitch: { channel: 'mine' } } });
  writeFileSync(CONFIG_PATH, '{ broken');
  const config = loadConfig();
  assert.equal(config.platforms.twitch.channel, 'mine', 'rebuilt from the seed');
});

test('the working file is written with owner-only permissions', () => {
  fresh();
  writeSeed({ platforms: {} });
  loadConfig();
  assert.equal(statSync(CONFIG_PATH).mode & 0o777, 0o600);
});

test('a setting the operator already has is never changed by a later seed', () => {
  // The flip side of the rule above: once it is in the working file, it is theirs.
  fresh();
  writeSeed({ chatbot: { enabled: false, sendTo: [] } });
  const config = loadConfig();
  config.chatbot.enabled = true;
  saveConfig(config);

  writeSeed({ chatbot: { enabled: false, sendTo: ['kick'] } });
  const reloaded = loadConfig();
  assert.equal(reloaded.chatbot.enabled, true, 'their choice survives');
  assert.deepEqual(reloaded.chatbot.sendTo, [], 'and so does the rest of their section');
});
