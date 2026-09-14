/**
 * Chat command editor. Everything is saved to the toolkit, not to a file the
 * operator has to find - same rule as the rest of the setup pages.
 */
import { OVERLAYS } from '/core/settings-schema.js';

const toastEl = document.getElementById('toast');
let toastTimer;
let state = { commands: [], autoMessages: [], enabled: false, canSendOn: [], sendTo: [] };
let presets = { initial: [], local: [] };

const tabs = document.getElementById('tabs');
for (const o of Object.values(OVERLAYS)) {
  const a = document.createElement('a');
  a.href = `/settings/?overlay=${o.id}`;
  a.textContent = `${o.label} style`;
  tabs.append(a);
}
const own = document.createElement('a');
own.href = '/commands/';
own.textContent = 'Chat commands';
own.setAttribute('aria-current', 'page');
tabs.append(own);

await load();
await loadPresets();

document.getElementById('savePreset').addEventListener('click', savePreset);

document.getElementById('botEnabled').addEventListener('change', (e) => save({ chatbot: { enabled: e.target.checked } }));
document.getElementById('restoreCommands').addEventListener('click', async () => {
  // The shipped examples are a separate file, so this can never fail to find them.
  if (!window.confirm('Put the example commands back? Your current commands are replaced.')) return;
  state = await (await fetch('/api/chatbot/restore', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ which: 'commands' }),
  })).json();
  renderCommands();
  paintBot();
  toast('Examples restored');
});

document.getElementById('addCommand').addEventListener('click', () => {
  state.commands = [...state.commands, { trigger: '!new', response: 'Say something here', enabled: true, permission: 'everyone', cooldownSec: 5, userCooldownSec: 15, aliases: [], platforms: [] }];
  renderCommands();
  save({ commands: state.commands });
});
document.getElementById('addAuto').addEventListener('click', () => {
  state.autoMessages = [...state.autoMessages, { id: `auto-${Date.now()}`, text: 'Something worth repeating', intervalSec: 900, minChatLines: 10, enabled: true }];
  renderAutos();
  save({ autoMessages: state.autoMessages });
});

async function loadPresets() {
  try {
    const body = await (await fetch('/api/presets/commands')).json();
    presets = { initial: body.presets.initial || [], local: body.presets.local || [] };
  } catch {
    presets = { initial: [], local: [] };
  }
  renderPresets();
}

function renderPresets() {
  const box = document.getElementById('presets');
  box.replaceChildren();
  if (!presets.local.length && !presets.initial.length) {
    box.innerHTML = '<span class="sub">Nothing saved yet. Press <strong>Save this set</strong> to keep the commands below as a set you can come back to.</span>';
    return;
  }
  for (const preset of [...presets.initial, ...presets.local]) {
    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:inline-flex;align-items:center';
    const load = document.createElement('button');
    load.textContent = `${preset.name} (${preset.data?.commands?.length ?? 0})`;
    load.title = `Saved ${new Date(preset.savedAt).toLocaleString()}`;
    load.style.cssText = 'border-top-right-radius:0;border-bottom-right-radius:0';
    load.addEventListener('click', async () => {
      // Replaces what is on screen, so say so rather than silently swapping it.
      if (!window.confirm(`Load "${preset.name}"? This replaces the commands you have now.`)) return;
      state.commands = preset.data?.commands || [];
      state.autoMessages = preset.data?.autoMessages || [];
      renderCommands();
      renderAutos();
      await save({ commands: state.commands, autoMessages: state.autoMessages });
      toast(`Loaded "${preset.name}"`);
    });
    // Sets that ship with the toolkit can be loaded but not deleted.
    if (preset.source === 'initial') {
      load.style.cssText = '';
      load.title = `Comes with the toolkit — config/commands/${preset.file}`;
      wrap.append(load);
      box.append(wrap);
      continue;
    }
    const del = document.createElement('button');
    del.textContent = '×';
    del.title = `Delete "${preset.name}"`;
    del.style.cssText = 'border-left:0;border-top-left-radius:0;border-bottom-left-radius:0;padding:6px 9px;color:#ff9ea1';
    del.addEventListener('click', async () => {
      await fetch(`/api/presets/commands/${preset.id}`, { method: 'DELETE' });
      await loadPresets();
      toast(`Deleted "${preset.name}"`);
    });
    wrap.append(load, del);
    box.append(wrap);
  }
}

async function savePreset() {
  const name = window.prompt('Name this set (saving over one of your own names replaces it):', presets.local.length ? '' : 'My commands');
  if (name === null) return;
  const res = await fetch('/api/presets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'commands', name, data: { commands: state.commands, autoMessages: state.autoMessages } }),
  });
  const body = await res.json();
  if (!res.ok) {
    toast(body.error || 'Could not save that');
    return;
  }
  await loadPresets();
  toast(`Saved "${body.preset.name}"`);
}

async function load() {
  state = await (await fetch('/api/chatbot')).json();
  paintBot();
  renderCommands();
  renderAutos();
}

async function save(patch) {
  const res = await fetch('/api/chatbot', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch),
  });
  state = await res.json();
  paintBot();
  toast('Saved');
}

function paintBot() {
  document.getElementById('botEnabled').checked = state.enabled;
  const can = state.canSendOn || [];
  document.getElementById('botState').textContent = can.length
    ? `Can talk on: ${can.join(', ')}`
    : 'Not signed in anywhere, so it can read commands but not answer.';
  const warn = document.getElementById('botWarning');
  warn.hidden = can.length > 0;
  warn.innerHTML = 'To let the bot <strong>answer</strong>, sign in to a platform on the <a href="/">Setup page</a>. Reading chat needs no account, but no platform lets an anonymous connection talk.';
}

// ------------------------------------------------------------ commands

function renderCommands() {
  const box = document.getElementById('commands');
  box.replaceChildren();
  if (!state.commands.length) {
    box.innerHTML = '<p class="sub">No commands yet.</p>';
    return;
  }
  state.commands.forEach((cmd, index) => box.append(commandRow(cmd, index)));
}

function commandRow(cmd, index) {
  const details = document.createElement('details');
  details.className = 'group';
  details.style.marginBottom = '8px';
  const summary = document.createElement('summary');
  summary.textContent = `${cmd.trigger}${cmd.enabled ? '' : '  (off)'} — ${String(cmd.response).slice(0, 60)}`;
  const body = document.createElement('div');
  body.className = 'body';

  const update = (patch) => {
    state.commands = state.commands.map((c, i) => (i === index ? { ...c, ...patch } : c));
    summary.textContent = `${state.commands[index].trigger}${state.commands[index].enabled ? '' : '  (off)'} — ${String(state.commands[index].response).slice(0, 60)}`;
  };
  const commit = () => save({ commands: state.commands });

  body.append(field('Command', cmd.trigger, (v) => update({ trigger: v.startsWith('!') ? v : `!${v}` }), commit));
  body.append(field('Answer', cmd.response, (v) => update({ response: v }), commit, 'textarea'));
  body.append(field('Also responds to (separate with commas)', (cmd.aliases || []).join(', '),
    (v) => update({ aliases: v.split(',').map((a) => a.trim()).filter(Boolean) }), commit));

  const row = document.createElement('div');
  row.className = 'row';
  row.append(
    select('Who can use it', ['everyone', 'subscriber', 'vip', 'moderator', 'broadcaster'], cmd.permission, (v) => { update({ permission: v }); commit(); }),
    number('Wait between uses', cmd.cooldownSec, (v) => update({ cooldownSec: v }), commit, 'sec'),
    number('Wait per person', cmd.userCooldownSec, (v) => update({ userCooldownSec: v }), commit, 'sec'),
  );
  body.append(row);

  const actions = document.createElement('div');
  actions.className = 'row';
  actions.style.marginTop = '12px';
  const toggle = document.createElement('label');
  toggle.className = 'switch';
  toggle.innerHTML = `<input type="checkbox" ${cmd.enabled ? 'checked' : ''}><span>On</span>`;
  toggle.querySelector('input').addEventListener('change', (e) => { update({ enabled: e.target.checked }); commit(); });

  const testBtn = document.createElement('button');
  testBtn.textContent = 'Test';
  const testOut = document.createElement('span');
  testOut.style.cssText = 'font-size:13px;color:var(--muted)';
  testBtn.addEventListener('click', async () => {
    const res = await (await fetch('/api/chatbot/test', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trigger: state.commands[index].trigger }),
    })).json();
    testOut.textContent = res.ok ? `→ ${res.reply}` : 'That command produced nothing';
  });

  const del = document.createElement('button');
  del.className = 'ghost danger';
  del.textContent = 'Delete';
  del.addEventListener('click', () => {
    state.commands = state.commands.filter((_, i) => i !== index);
    renderCommands();
    save({ commands: state.commands });
  });

  actions.append(toggle, testBtn, del, testOut);
  body.append(actions);
  details.append(summary, body);
  return details;
}

// ------------------------------------------------------------ auto-messages

function renderAutos() {
  const box = document.getElementById('autos');
  box.replaceChildren();
  if (!state.autoMessages.length) {
    box.innerHTML = '<p class="sub">No auto-messages.</p>';
    return;
  }
  state.autoMessages.forEach((msg, index) => {
    const card = document.createElement('div');
    card.className = 'group';
    card.style.marginBottom = '8px';
    const body = document.createElement('div');
    body.className = 'body';
    const update = (patch) => { state.autoMessages = state.autoMessages.map((m, i) => (i === index ? { ...m, ...patch } : m)); };
    const commit = () => save({ autoMessages: state.autoMessages });

    body.append(field('Message', msg.text, (v) => update({ text: v }), commit, 'textarea'));
    const row = document.createElement('div');
    row.className = 'row';
    row.append(
      number('Every', Math.round((msg.intervalSec || 900) / 60), (v) => update({ intervalSec: v * 60 }), commit, 'min'),
      number('Only if chat said at least', msg.minChatLines ?? 0, (v) => update({ minChatLines: v }), commit, 'lines'),
    );
    body.append(row);

    const actions = document.createElement('div');
    actions.className = 'row';
    actions.style.marginTop = '12px';
    const toggle = document.createElement('label');
    toggle.className = 'switch';
    toggle.innerHTML = `<input type="checkbox" ${msg.enabled ? 'checked' : ''}><span>On</span>`;
    toggle.querySelector('input').addEventListener('change', (e) => { update({ enabled: e.target.checked }); commit(); });
    const del = document.createElement('button');
    del.className = 'ghost danger';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      state.autoMessages = state.autoMessages.filter((_, i) => i !== index);
      renderAutos();
      save({ autoMessages: state.autoMessages });
    });
    actions.append(toggle, del);
    body.append(actions);
    card.append(body);
    box.append(card);
  });
}

// ------------------------------------------------------------ small helpers

function field(label, value, onInput, onCommit, kind = 'input') {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement(kind === 'textarea' ? 'textarea' : 'input');
  if (kind === 'textarea') { input.rows = 2; input.style.cssText = 'width:100%;font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:8px 11px;resize:vertical'; }
  else input.type = 'text';
  input.value = value ?? '';
  input.addEventListener('input', () => onInput(input.value));
  input.addEventListener('change', onCommit);
  wrap.append(span, input);
  return wrap;
}

function number(label, value, onInput, onCommit, unit = '') {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  wrap.style.cssText = 'flex:0 0 190px;margin:0';
  const span = document.createElement('span');
  span.textContent = unit ? `${label} (${unit})` : label;
  const input = document.createElement('input');
  input.type = 'number';
  input.min = 0;
  input.value = value ?? 0;
  input.addEventListener('input', () => onInput(Math.max(0, Number(input.value) || 0)));
  input.addEventListener('change', onCommit);
  wrap.append(span, input);
  return wrap;
}

function select(label, options, value, onChange) {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  wrap.style.cssText = 'flex:0 0 200px;margin:0';
  const span = document.createElement('span');
  span.textContent = label;
  const sel = document.createElement('select');
  for (const option of options) {
    const o = document.createElement('option');
    o.value = option;
    o.textContent = option;
    o.selected = option === value;
    sel.append(o);
  }
  sel.addEventListener('change', () => onChange(sel.value));
  wrap.append(span, sel);
  return wrap;
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}
