/**
 * Setup wizard and status screen.
 *
 * Everything a non-technical operator needs: connect a channel, see whether it
 * is working in plain words, and copy the overlay link into OBS. It builds
 * itself from GET /api/platforms, so a newly added adapter shows up here with
 * no edit to this file.
 */
const platformsEl = document.getElementById('platforms');
const healthEl = document.getElementById('health');
const toastEl = document.getElementById('toast');

document.getElementById('overlayUrl').value = `${location.origin}/overlays/chat/`;
document.getElementById('copyOverlay').addEventListener('click', () => {
  copy(document.getElementById('overlayUrl').value, 'Overlay link copied — now paste it into OBS');
});

let statusRows = [];
let toastTimer;

await refresh();
setInterval(refreshStatus, 4000);

async function refresh() {
  await refreshStatus();
  render();
}

async function refreshStatus() {
  try {
    const res = await fetch('/api/status');
    const body = await res.json();
    statusRows = body.platforms;
    paintHealth();
    paintDots();
  } catch {
    healthEl.innerHTML = '<span class="pill"><span class="dot bad"></span>The toolkit stopped running — restart it in the terminal</span>';
  }
}

function statusOf(id) {
  return statusRows.find((r) => r.id === id) || {};
}

/** One card per platform. */
function render() {
  platformsEl.innerHTML = '';
  for (const row of statusRows) {
    if (row.id === 'fake') continue; // demo platform is shown at the bottom instead
    platformsEl.append(card(row));
  }
  const demo = statusOf('fake');
  if (demo.id) platformsEl.append(demoCard(demo));
}

function card(row) {
  const el = document.createElement('section');
  el.className = 'card';
  el.dataset.platform = row.id;

  const head = document.createElement('div');
  head.className = 'row between';
  head.innerHTML = `
    <div class="platform-head">
      <img src="/api/platforms/${row.id}/icon.svg" alt="">
      <div>
        <h2>${escape(row.label)}</h2>
        <span class="pill"><span class="dot ${dotClass(row)}"></span>${escape(plainStatus(row))}</span>
      </div>
    </div>`;

  const actions = document.createElement('div');
  actions.className = 'row';
  head.append(actions);
  el.append(head);

  const connected = row.connected || row.enabled;

  // Channel name is needed whichever way you log in.
  const channelField = field('Your channel name', 'text', `${row.id}-channel`, '');
  channelField.wrap.style.marginTop = '18px';
  el.append(channelField.wrap);

  const saveChannel = () =>
    post(`/api/platforms/${row.id}/config`, { channel: channelField.input.value.trim() });
  channelField.input.addEventListener('change', saveChannel);

  const keyFields = {};

  if (row.authMode === 'device') {
    // ---- One-click sign in -------------------------------------------------
    const connectBtn = document.createElement('button');
    connectBtn.className = 'primary';
    connectBtn.textContent = connected ? `Sign in to ${row.label} again` : `Sign in with ${row.label}`;

    const hint = document.createElement('span');
    hint.style.cssText = 'font-size:13px;color:var(--muted)';

    const panel = document.createElement('div');
    panel.hidden = true;

    connectBtn.addEventListener('click', async () => {
      await saveChannel();
      connectBtn.disabled = true;
      connectBtn.textContent = 'Starting…';
      const session = await post(`/api/platforms/${row.id}/device/start`, {});
      connectBtn.disabled = false;
      connectBtn.textContent = `Sign in with ${row.label}`;
      if (session.status === 'error' || !session.userCode) {
        hint.textContent = session.error === `missing clientId`
          ? 'No application set up yet — open “Use your own application” below.'
          : session.error || 'Could not start the sign in.';
        return;
      }
      showDeviceCode(row, panel, session);
    });

    const connectRow = document.createElement('div');
    connectRow.className = 'row';
    connectRow.append(connectBtn, hint);
    el.append(connectRow, panel);

    if (!row.hasDefaultClientId) {
      hint.textContent = 'Uses your own application (set up below).';
    }
  }

  // ---- Developer application path (available for every platform) -----------
  const details = document.createElement('details');
  details.className = 'group';
  details.style.marginTop = '16px';
  // For one-click platforms this is the optional advanced path, so start closed.
  details.open = row.authMode !== 'device' && !connected;
  const summary = document.createElement('summary');
  summary.textContent =
    row.authMode === 'device'
      ? `Use your own ${row.label} application (optional)`
      : `Set up ${row.label}`;
  const body = document.createElement('div');
  body.className = 'body';

  if ((row.needs || []).length) body.append(setupSteps(row));

  for (const key of row.needs || []) {
    const f = field(labelFor(key), key.toLowerCase().includes('secret') ? 'password' : 'text', `${row.id}-${key}`, '');
    keyFields[key] = f;
    body.append(f.wrap);
  }

  const saveRow = document.createElement('div');
  saveRow.className = 'row';
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', async () => {
    const patch = { channel: channelField.input.value.trim() };
    for (const [key, f] of Object.entries(keyFields)) {
      if (f.input.value && f.input.value !== '__set__') patch[key] = f.input.value.trim();
    }
    await post(`/api/platforms/${row.id}/config`, patch);
    toast('Saved');
    await refresh();
  });
  saveRow.append(saveBtn);

  // Redirect-style platforms log in from here; device-style ones use the button above.
  if (row.authMode !== 'device' && (row.needs || []).length) {
    const connectLink = document.createElement('a');
    connectLink.className = 'btn primary';
    connectLink.href = `/auth/${row.id}/start`;
    connectLink.target = '_blank';
    connectLink.rel = 'noopener';
    connectLink.textContent = connected ? `Log in to ${row.label} again` : `Connect ${row.label}`;
    saveRow.append(connectLink);
  }

  body.append(saveRow);
  details.append(summary, body);
  el.append(details);

  // ---- on/off + disconnect ----
  const toggle = document.createElement('label');
  toggle.className = 'switch';
  toggle.innerHTML = `<input type="checkbox" ${row.enabled ? 'checked' : ''}><span>Use this channel</span>`;
  toggle.querySelector('input').addEventListener('change', async (e) => {
    await post(`/api/platforms/${row.id}/enabled`, { enabled: e.target.checked });
    await refresh();
  });
  actions.append(toggle);

  if (connected) {
    const dis = document.createElement('button');
    dis.className = 'ghost danger';
    dis.textContent = 'Disconnect';
    dis.addEventListener('click', async () => {
      await post(`/api/platforms/${row.id}/disconnect`, {});
      toast(`${row.label} disconnected`);
      await refresh();
    });
    actions.append(dis);
  }

  // Prefill from the server (secrets come back as a marker, never the value).
  fetch(`/api/platforms/${row.id}/config`)
    .then((r) => r.json())
    .then(({ config }) => {
      channelField.input.value = config.channel || '';
      for (const [key, f] of Object.entries(keyFields)) {
        if (config[key] === '__set__') {
          f.input.placeholder = 'Already saved — leave blank to keep it';
          f.input.value = '';
        } else if (config[key]) {
          f.input.value = config[key];
        }
      }
    })
    .catch(() => {});

  return el;
}

/** Show the short code and poll until the operator has typed it in. */
function showDeviceCode(row, panel, session) {
  panel.hidden = false;
  panel.innerHTML = `
    <div class="card" style="background:var(--surface-2);margin:16px 0 0">
      <p class="sub" style="margin:0 0 10px">Two steps, then you're done:</p>
      <ol class="steps">
        <li>Open <a href="${escape(session.verificationUri)}" target="_blank" rel="noopener">${escape(session.verificationUri)}</a></li>
        <li>Type this code:</li>
      </ol>
      <div class="row" style="gap:10px">
        <code class="inline" style="font-size:28px;letter-spacing:0.16em;padding:10px 18px">${escape(session.userCode)}</code>
        <button class="ghost" data-copy>Copy code</button>
        <a class="btn primary" href="${escape(session.verificationUri)}" target="_blank" rel="noopener">Open the page</a>
      </div>
      <p class="sub" data-state style="margin:14px 0 0">Waiting for you to finish on ${escape(row.label)}…</p>
    </div>`;

  panel.querySelector('[data-copy]').addEventListener('click', () => copy(session.userCode, 'Code copied'));
  const state = panel.querySelector('[data-state]');

  const poll = setInterval(async () => {
    let status;
    try {
      status = await (await fetch(`/api/platforms/${row.id}/device/status`)).json();
    } catch {
      return;
    }
    if (status.status === 'pending') {
      state.textContent = `Waiting for you to finish on ${row.label}… (${formatLeft(status.secondsLeft)} left)`;
      return;
    }
    clearInterval(poll);
    if (status.status === 'done') {
      state.textContent = 'Connected.';
      toast(`${row.label} connected`);
      panel.hidden = true;
      await refresh();
    } else if (status.status === 'expired') {
      state.textContent = 'That code ran out. Press sign in again for a fresh one.';
    } else {
      state.textContent = status.error || 'That did not work. Try again.';
    }
  }, 2000);
}

function formatLeft(seconds) {
  const m = Math.floor(seconds / 60);
  return m > 0 ? `${m} min` : `${seconds}s`;
}

/** Registering your own application on the platform. Optional for one-click platforms. */
function setupSteps(row) {
  const box = document.createElement('div');

  if (row.authMode === 'device') {
    // This flow has no redirect URL and no client secret, so the steps are shorter.
    box.innerHTML = `
      <p class="sub">You only need this if you'd rather use your own ${escape(row.label)}
      application than the built-in one. You do it once.</p>
      <ol class="steps">
        <li>Open <a href="${escape(row.setupUrl || '#')}" target="_blank" rel="noopener">the ${escape(row.label)} developer page</a> and create an application.</li>
        <li>Set <strong>Client Type</strong> to <strong>Public</strong>. If it insists on an OAuth Redirect URL, put <code class="inline">http://localhost</code> — this kind of login never uses it.</li>
        <li>Copy the <strong>Client ID</strong> into the box below and press <strong>Save</strong>. There is no secret to copy.</li>
        <li>Then press <strong>Sign in with ${escape(row.label)}</strong> above.</li>
      </ol>`;
    return box;
  }

  const redirect = row.redirectUri || `${location.origin}/auth/${row.id}/callback`;
  box.innerHTML = `
    <p class="sub">You only do this once.</p>
    <ol class="steps">
      <li>Open <a href="${escape(row.setupUrl || '#')}" target="_blank" rel="noopener">the ${escape(row.label)} developer page</a> and create an application.</li>
      <li>When it asks for a <strong>Redirect URL</strong>, paste exactly this: <code class="inline">${escape(redirect)}</code></li>
      <li>Copy the ID and secret it gives you into the boxes below, then press <strong>Save</strong>.</li>
      <li>Press <strong>Connect ${escape(row.label)}</strong> and log in.</li>
    </ol>`;
  const copyBtn = document.createElement('button');
  copyBtn.className = 'ghost';
  copyBtn.textContent = 'Copy the Redirect URL';
  copyBtn.style.marginBottom = '14px';
  copyBtn.addEventListener('click', () => copy(redirect, 'Redirect URL copied'));
  box.append(copyBtn);
  return box;
}

function demoCard(row) {
  const el = document.createElement('section');
  el.className = 'card';
  el.innerHTML = `
    <div class="row between">
      <div class="platform-head">
        <img src="/api/platforms/fake/icon.svg" alt="">
        <div>
          <h2>Demo chat</h2>
          <p class="sub" style="margin:0">Fake messages, so you can design your overlay without going live.</p>
        </div>
      </div>
    </div>`;
  const toggle = document.createElement('label');
  toggle.className = 'switch';
  toggle.style.marginTop = '14px';
  toggle.innerHTML = `<input type="checkbox" ${row.enabled ? 'checked' : ''}><span>Send fake chat</span>`;
  toggle.querySelector('input').addEventListener('change', async (e) => {
    await post('/api/platforms/fake/enabled', { enabled: e.target.checked });
    await refresh();
  });
  el.append(toggle);
  return el;
}

// ---------------------------------------------------------------- helpers

function plainStatus(row) {
  if (!row.enabled) return 'Off';
  if (row.connected) return row.detail || 'Working';
  if (row.needsLogin) return 'Needs you to log in';
  if (row.error) return row.error;
  return row.detail || 'Connecting…';
}

function dotClass(row) {
  if (!row.enabled) return '';
  if (row.connected) return 'ok';
  if (row.error || row.needsLogin) return 'bad';
  return 'warn';
}

function paintHealth() {
  healthEl.innerHTML = '';
  for (const row of statusRows) {
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.innerHTML = `<span class="dot ${dotClass(row)}"></span>${escape(row.label)} — ${escape(plainStatus(row))}`;
    healthEl.append(pill);
  }
}

/** Live-update the dots without rebuilding the forms and losing what's typed. */
function paintDots() {
  for (const row of statusRows) {
    const card = [...document.querySelectorAll('.platform-head h2')].find((h) => h.textContent === row.label);
    const pill = card?.parentElement?.querySelector('.pill');
    if (pill) pill.innerHTML = `<span class="dot ${dotClass(row)}"></span>${escape(plainStatus(row))}`;
  }
}

function field(labelText, type, id, value) {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  const span = document.createElement('span');
  span.textContent = labelText;
  const input = document.createElement('input');
  input.type = type;
  input.id = id;
  input.value = value;
  input.autocomplete = 'off';
  wrap.append(span, input);
  return { wrap, input };
}

function labelFor(key) {
  return { clientId: 'Application ID (Client ID)', clientSecret: 'Application secret (Client Secret)' }[key] || key;
}

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    toast(err.error || 'That did not work');
  }
  return res.json().catch(() => ({}));
}

function copy(text, message) {
  navigator.clipboard?.writeText(text).then(
    () => toast(message),
    () => toast('Could not copy — select the text and copy it yourself'),
  );
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
