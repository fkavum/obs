/**
 * "Add to OBS for me": puts one of the toolkit's overlays into OBS as a Browser
 * Source, so the operator never creates a source, pastes a link or types a size.
 *
 * This is the only thing the toolkit ever changes in OBS, and it only touches
 * Browser Sources that already point at the toolkit. Someone else's source with
 * the same name (say, an old "Alerts" from a paid service) is left alone and the
 * new one gets a different name.
 *
 * `request` is ObsClient#request, passed in so this can be tested without OBS.
 */

const BROWSER_SOURCE = 'browser_source';
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** The page an overlay URL points at, ignoring its look (the query string). */
function pageOf(url) {
  const path = url.pathname.replace(/index\.html$/, '');
  return path.endsWith('/') ? path : `${path}/`;
}

function parse(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** True when `url` is served by this toolkit (any loopback name, same port). */
export function isToolkitUrl(url, port) {
  const u = typeof url === 'string' ? parse(url) : url;
  return !!u && u.protocol === 'http:' && LOOPBACK.has(u.hostname) && Number(u.port || 80) === Number(port);
}

/**
 * Check what the browser asked for before anything reaches OBS. The link must be
 * one of this toolkit's own overlays; nothing else may be put on stream this way.
 * @returns {{ok: true, name, url, width, height} | {ok: false, message}}
 */
export function validateSourceRequest(body, port) {
  const name = String(body?.name || '').trim().slice(0, 80);
  const url = parse(String(body?.url || ''));
  const width = Math.round(Number(body?.width));
  const height = Math.round(Number(body?.height));
  if (!name) return { ok: false, message: 'The source needs a name.' };
  if (!url || !isToolkitUrl(url, port) || !url.pathname.startsWith('/overlays/')) {
    return { ok: false, message: 'Only the toolkit’s own overlays can be added to OBS this way.' };
  }
  const sane = (n) => Number.isFinite(n) && n >= 16 && n <= 8192;
  if (!sane(width) || !sane(height)) return { ok: false, message: 'That overlay size does not look right.' };
  return { ok: true, name, url: url.href, width, height, keepLook: body.keepLook === true };
}

/**
 * Add the overlay to the scene the operator is looking at, or update the
 * source that already shows it.
 *
 * `keepLook` is for pages that only know the overlay's plain link (the Setup
 * page, a feature's page): there, a source that already exists keeps the look
 * the operator gave it instead of being reset to the default one.
 *
 * @param {(type: string, data?: object) => Promise<object>} request
 * @param {{name: string, url: string, width: number, height: number, port: number, keepLook?: boolean}} source
 * @returns {Promise<{ok: boolean, action?: 'created'|'updated'|'added'|'unchanged', sourceName?: string, sceneName?: string, message: string}>}
 */
export async function placeBrowserSource(request, { name, url, width, height, port, keepLook = false }) {
  const wanted = pageOf(new URL(url));
  const sceneName = await currentScene(request);

  // Every Browser Source already in OBS that shows the toolkit, with its page.
  const { inputs = [] } = await request('GetInputList', { inputKind: BROWSER_SOURCE });
  const ours = [];
  for (const input of inputs) {
    const { inputSettings = {} } = await request('GetInputSettings', { inputName: input.inputName });
    const u = parse(inputSettings.url || '');
    if (u && isToolkitUrl(u, port)) ours.push({ name: input.inputName, page: pageOf(u) });
  }

  // Already there? Change that source's link rather than adding a second copy.
  // Two sources of the same overlay (two looks) is allowed, but then only the
  // operator knows which one they meant.
  const same = ours.filter((s) => s.page === wanted);
  const target = same.length === 1 ? same[0] : same.find((s) => s.name === name);
  if (!target && same.length > 1) {
    return {
      ok: false,
      message: `OBS has ${same.length} sources showing this overlay (${same.map((s) => `“${s.name}”`).join(', ')}). ` +
        'Copy the link and paste it into the one you want to change.',
    };
  }

  if (target) {
    if (!keepLook) {
      await request('SetInputSettings', { inputName: target.name, inputSettings: { url, width, height }, overlay: true });
    }
    const inScene = await sceneHas(request, sceneName, target.name);
    if (!inScene) await request('CreateSceneItem', { sceneName, sourceName: target.name, sceneItemEnabled: true });
    const where = inScene ? '' : ` and is now in the scene “${sceneName}”`;
    return {
      ok: true,
      action: keepLook ? (inScene ? 'unchanged' : 'added') : 'updated',
      sourceName: target.name,
      sceneName,
      message: keepLook
        ? `“${target.name}” is already in OBS${where}. To change its look, use its style page.`
        : `Updated “${target.name}” in OBS with this look${where}.`,
    };
  }

  // A new source. Never reuse a name OBS already has for something else.
  const taken = new Set((await request('GetInputList')).inputs?.map((i) => i.inputName) || []);
  const sourceName = freeName(name, taken);
  const { sceneItemId } = await request('CreateInput', {
    sceneName,
    inputName: sourceName,
    inputKind: BROWSER_SOURCE,
    inputSettings: { url, width, height },
    sceneItemEnabled: true,
  });
  await fitToCanvas(request, sceneName, sceneItemId, width, height);
  return {
    ok: true,
    action: 'created',
    sourceName,
    sceneName,
    message: `Added “${sourceName}” to the scene “${sceneName}”.`,
  };
}

/** In Studio Mode the operator edits the preview scene, not what is live. */
async function currentScene(request) {
  const studio = await request('GetStudioModeEnabled').catch(() => ({}));
  if (studio.studioModeEnabled) {
    return (await request('GetCurrentPreviewScene')).currentPreviewSceneName;
  }
  return (await request('GetCurrentProgramScene')).currentProgramSceneName;
}

async function sceneHas(request, sceneName, sourceName) {
  const { sceneItems = [] } = await request('GetSceneItemList', { sceneName });
  return sceneItems.some((item) => item.sourceName === sourceName);
}

export function freeName(name, taken) {
  if (!taken.has(name)) return name;
  for (let n = 2; ; n += 1) {
    const candidate = `${name} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * A 1920-wide overlay on a 1280-wide canvas would hang off the edge; shrink it
 * to fit. Never scaled up, so a small overlay keeps its crisp size.
 */
async function fitToCanvas(request, sceneName, sceneItemId, width, height) {
  if (sceneItemId === undefined) return;
  try {
    const { baseWidth, baseHeight } = await request('GetVideoSettings');
    const scale = Math.min(1, baseWidth / width, baseHeight / height);
    if (!(scale < 1)) return;
    await request('SetSceneItemTransform', {
      sceneName,
      sceneItemId,
      sceneItemTransform: { scaleX: scale, scaleY: scale },
    });
  } catch {
    /* the source is in; a wrong size is the operator's to drag */
  }
}
