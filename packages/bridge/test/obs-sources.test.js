import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeBrowserSource, validateSourceRequest, isToolkitUrl, freeName } from '../src/obs/sources.js';

const PORT = 8787;
const BASE = `http://localhost:${PORT}`;

/**
 * Just enough of OBS's request surface to place a source: inputs with settings,
 * scenes with items, a canvas size, and studio mode. Records every request.
 */
function fakeObs({ inputs = [], scenes = { Main: [] }, current = 'Main', preview = null, canvas = [1920, 1080] } = {}) {
  const state = { inputs: inputs.map((i) => ({ ...i })), scenes: structuredClone(scenes), calls: [] };
  let nextItem = 100;
  const find = (name) => state.inputs.find((i) => i.inputName === name);

  async function request(type, data = {}) {
    state.calls.push({ type, data });
    switch (type) {
      case 'GetStudioModeEnabled': return { studioModeEnabled: !!preview };
      case 'GetCurrentProgramScene': return { currentProgramSceneName: current };
      case 'GetCurrentPreviewScene': return { currentPreviewSceneName: preview };
      case 'GetVideoSettings': return { baseWidth: canvas[0], baseHeight: canvas[1] };
      case 'GetInputList':
        return {
          inputs: state.inputs
            .filter((i) => !data.inputKind || i.inputKind === data.inputKind)
            .map(({ inputName, inputKind }) => ({ inputName, inputKind })),
        };
      case 'GetInputSettings': return { inputSettings: { ...find(data.inputName).settings } };
      case 'SetInputSettings': Object.assign(find(data.inputName).settings, data.inputSettings); return {};
      case 'GetSceneItemList': return { sceneItems: state.scenes[data.sceneName].map((sourceName) => ({ sourceName })) };
      case 'CreateSceneItem': state.scenes[data.sceneName].push(data.sourceName); return { sceneItemId: nextItem++ };
      case 'CreateInput':
        if (find(data.inputName)) throw new Error('an input with that name already exists');
        state.inputs.push({ inputName: data.inputName, inputKind: data.inputKind, settings: { ...data.inputSettings } });
        state.scenes[data.sceneName].push(data.inputName);
        return { sceneItemId: nextItem++ };
      case 'SetSceneItemTransform': return {};
      default: throw new Error(`fake OBS does not know ${type}`);
    }
  }
  return { request, state, find };
}

const chat = (query = '') => ({ name: 'Chat overlay', url: `${BASE}/overlays/chat/${query}`, width: 400, height: 1080, port: PORT });

test('a new overlay is created in the current scene at its size', async () => {
  const obs = fakeObs();
  const result = await placeBrowserSource(obs.request, chat('?fontSize=22'));
  assert.equal(result.ok, true);
  assert.equal(result.action, 'created');
  assert.deepEqual(obs.state.scenes.Main, ['Chat overlay']);
  const input = obs.find('Chat overlay');
  assert.equal(input.inputKind, 'browser_source');
  assert.deepEqual(input.settings, { url: `${BASE}/overlays/chat/?fontSize=22`, width: 400, height: 1080 });
  assert.ok(!obs.state.calls.some((c) => c.type === 'SetSceneItemTransform'), 'fits a 1080p canvas, no scaling');
});

test('pressing it again with a new look updates the same source, not a second copy', async () => {
  const obs = fakeObs();
  await placeBrowserSource(obs.request, chat('?fontSize=22'));
  const result = await placeBrowserSource(obs.request, chat('?fontSize=30'));
  assert.equal(result.action, 'updated');
  assert.equal(obs.state.inputs.length, 1);
  assert.deepEqual(obs.state.scenes.Main, ['Chat overlay']);
  assert.equal(obs.find('Chat overlay').settings.url, `${BASE}/overlays/chat/?fontSize=30`);
});

test('a source the operator added by hand under their own name is found and updated', async () => {
  const obs = fakeObs({
    inputs: [{ inputName: 'My chat', inputKind: 'browser_source', settings: { url: 'http://127.0.0.1:8787/overlays/chat/index.html', width: 400, height: 1080 } }],
    scenes: { Main: ['My chat'] },
  });
  const result = await placeBrowserSource(obs.request, chat('?radius=0'));
  assert.equal(result.sourceName, 'My chat');
  assert.equal(obs.find('My chat').settings.url, `${BASE}/overlays/chat/?radius=0`);
  assert.equal(obs.state.inputs.length, 1);
});

test('keepLook leaves an existing source’s look alone, but still puts it in this scene', async () => {
  const styled = `${BASE}/overlays/chat/?fontSize=30`;
  const obs = fakeObs({
    inputs: [{ inputName: 'Chat overlay', inputKind: 'browser_source', settings: { url: styled } }],
    scenes: { Main: [], Gaming: ['Chat overlay'] },
  });
  const result = await placeBrowserSource(obs.request, { ...chat(), keepLook: true });
  assert.equal(result.action, 'added');
  assert.equal(obs.find('Chat overlay').settings.url, styled);
  assert.deepEqual(obs.state.scenes.Main, ['Chat overlay']);
  assert.ok(!obs.state.calls.some((c) => c.type === 'SetInputSettings'));
});

test('someone else’s source with the same name is never touched', async () => {
  const theirs = { url: 'https://streamlabs.com/alert-box/abc' };
  const obs = fakeObs({
    inputs: [
      { inputName: 'Alerts', inputKind: 'browser_source', settings: { ...theirs } },
      { inputName: 'Alerts 2', inputKind: 'image_source', settings: {} },
    ],
  });
  const result = await placeBrowserSource(obs.request, { name: 'Alerts', url: `${BASE}/overlays/alerts/`, width: 1920, height: 1080, port: PORT });
  assert.equal(result.sourceName, 'Alerts 3');
  assert.deepEqual(obs.find('Alerts').settings, theirs);
});

test('a toolkit link on a different port is not ours either', async () => {
  const obs = fakeObs({ inputs: [{ inputName: 'Chat overlay', inputKind: 'browser_source', settings: { url: 'http://localhost:9999/overlays/chat/' } }] });
  const result = await placeBrowserSource(obs.request, chat());
  assert.equal(result.sourceName, 'Chat overlay 2');
});

test('two sources of the same overlay: ask rather than guess', async () => {
  const obs = fakeObs({
    inputs: [
      { inputName: 'Chat left', inputKind: 'browser_source', settings: { url: `${BASE}/overlays/chat/?anchor=left` } },
      { inputName: 'Chat ticker', inputKind: 'browser_source', settings: { url: `${BASE}/overlays/chat/?layout=horizontal` } },
    ],
  });
  const result = await placeBrowserSource(obs.request, chat('?fontSize=10'));
  assert.equal(result.ok, false);
  assert.match(result.message, /Chat left/);
  assert.match(result.message, /Chat ticker/);
  assert.ok(!obs.state.calls.some((c) => c.type === 'SetInputSettings' || c.type === 'CreateInput'));
});

test('two sources, one with the button’s own name: that one is updated', async () => {
  const obs = fakeObs({
    inputs: [
      { inputName: 'Chat overlay', inputKind: 'browser_source', settings: { url: `${BASE}/overlays/chat/` } },
      { inputName: 'Chat ticker', inputKind: 'browser_source', settings: { url: `${BASE}/overlays/chat/?layout=horizontal` } },
    ],
    scenes: { Main: ['Chat overlay', 'Chat ticker'] },
  });
  const result = await placeBrowserSource(obs.request, chat('?fontSize=10'));
  assert.equal(result.sourceName, 'Chat overlay');
  assert.equal(obs.find('Chat ticker').settings.url, `${BASE}/overlays/chat/?layout=horizontal`);
});

test('in Studio Mode it goes into the preview scene, not what is live', async () => {
  const obs = fakeObs({ scenes: { Live: [], Next: [] }, current: 'Live', preview: 'Next' });
  const result = await placeBrowserSource(obs.request, chat());
  assert.equal(result.sceneName, 'Next');
  assert.deepEqual(obs.state.scenes.Live, []);
});

test('a full-screen overlay is shrunk to fit a smaller canvas, never enlarged', async () => {
  const obs = fakeObs({ canvas: [1280, 720] });
  await placeBrowserSource(obs.request, { name: 'Alerts', url: `${BASE}/overlays/alerts/`, width: 1920, height: 1080, port: PORT });
  const t = obs.state.calls.find((c) => c.type === 'SetSceneItemTransform');
  assert.ok(t);
  assert.ok(Math.abs(t.data.sceneItemTransform.scaleX - 2 / 3) < 1e-9);

  const big = fakeObs({ canvas: [2560, 1440] });
  await placeBrowserSource(big.request, { name: 'Alerts', url: `${BASE}/overlays/alerts/`, width: 1920, height: 1080, port: PORT });
  assert.ok(!big.state.calls.some((c) => c.type === 'SetSceneItemTransform'));
});

test('only the toolkit’s own overlay links are accepted', () => {
  const ok = validateSourceRequest({ name: 'Chat overlay', url: `${BASE}/overlays/chat/?x=1`, width: 400, height: 1080 }, PORT);
  assert.equal(ok.ok, true);
  assert.equal(ok.keepLook, false);

  const bad = [
    { name: 'x', url: 'https://example.com/overlays/chat/', width: 400, height: 400 },
    { name: 'x', url: 'http://localhost:1234/overlays/chat/', width: 400, height: 400 },
    { name: 'x', url: `${BASE}/api/quit`, width: 400, height: 400 },
    { name: 'x', url: `${BASE}/overlays/chat/`, width: 0, height: 400 },
    { name: '', url: `${BASE}/overlays/chat/`, width: 400, height: 400 },
    { name: 'x', url: 'not a url', width: 400, height: 400 },
  ];
  for (const body of bad) assert.equal(validateSourceRequest(body, PORT).ok, false, JSON.stringify(body));
});

test('loopback names all count as the toolkit; other hosts do not', () => {
  assert.ok(isToolkitUrl(`http://localhost:${PORT}`, PORT));
  assert.ok(isToolkitUrl(`http://127.0.0.1:${PORT}/x`, PORT));
  assert.ok(isToolkitUrl(`http://[::1]:${PORT}/x`, PORT));
  assert.ok(!isToolkitUrl(`http://evil.example:${PORT}`, PORT));
  assert.ok(!isToolkitUrl(`https://localhost:${PORT}`, PORT));
  assert.ok(!isToolkitUrl('null', PORT));
});

test('free names count up past what is taken', () => {
  assert.equal(freeName('A', new Set()), 'A');
  assert.equal(freeName('A', new Set(['A', 'A 2'])), 'A 3');
});
