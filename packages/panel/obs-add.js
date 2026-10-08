/**
 * The "Add to OBS" button that sits next to every "Copy link" button.
 *
 * One press puts the overlay into the scene OBS is showing, at the right size,
 * or updates the source that already shows it with the new look. Copy link
 * stays beside it as the fallback: it works without the OBS connection.
 */

/**
 * @param {{name: string, url: string, width: number, height: number, keepLook?: boolean}} source
 * @returns {Promise<{ok: boolean, message: string, needsObs?: boolean}>}
 */
export async function addToObs(source) {
  try {
    const res = await fetch('/api/obs/sources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(source),
    });
    const body = await res.json().catch(() => ({}));
    return { ok: !!body.ok, message: body.message || 'OBS did not answer.', needsObs: !!body.needsObs };
  } catch {
    return { ok: false, message: 'Could not reach the toolkit — is it still running?' };
  }
}

/**
 * @param {object} options
 * @param {string | (() => string)} options.name  what the source is called in OBS
 * @param {string | (() => string)} options.url   the overlay link, with its look
 * @param {{width, height} | (() => {width, height})} options.size
 * @param {boolean} [options.keepLook]  for a page that only has the plain link:
 *   an overlay already in OBS keeps the look it was given on its style page
 * @param {(message: string) => void} options.toast
 * @returns {HTMLButtonElement}
 */
export function addToObsButton({ name, url, size, keepLook = false, toast }) {
  const read = (v) => (typeof v === 'function' ? v() : v);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'primary';
  btn.style.whiteSpace = 'nowrap';
  btn.textContent = 'Add to OBS';
  btn.title = 'Puts this overlay into the scene OBS is showing, at the right size';
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Adding…';
    const { width, height } = read(size);
    const result = await addToObs({ name: read(name), url: read(url), width, height, keepLook });
    btn.disabled = false;
    btn.textContent = 'Add to OBS';
    toast(result.message);
  });
  return btn;
}
