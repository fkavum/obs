/**
 * Behaviour for the to-do setup-page card. Loaded by the panel after the card's
 * markup is inserted; nothing in the shared panel code knows about it.
 *
 * The bridge owns the list, so this page only ever asks it to change something
 * and redraws what comes back - which is why a task added from chat appears
 * here, and one added here appears on stream, without either side syncing.
 */
const API = '/api/m/todo';
const POLL_MS = 2500;

let drawn = '';

function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(window.__todoToast);
  window.__todoToast = setTimeout(() => el.classList.remove('show'), 2600);
}

async function send(body) {
  try {
    const res = await fetch(`${API}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const state = await res.json();
    if (state.message && !state.ok) toast(state.message);
    draw(state, true);
    return state;
  } catch {
    toast('The toolkit is not running - start it and reload this page');
    return null;
  }
}

async function refresh() {
  try {
    draw(await (await fetch(`${API}/tasks`)).json());
  } catch {
    // Nothing to do: the page keeps what it last drew.
  }
}

// ---------------------------------------------------------------- drawing

function draw(state, force = false) {
  if (!state || !Array.isArray(state.tasks)) return;
  const signature = JSON.stringify(state);
  // Redrawing under someone's cursor would eat what they are typing.
  const editing = document.activeElement?.dataset?.todoEdit;
  if (!force && (signature === drawn || editing)) return;
  drawn = signature;

  document.getElementById('todoChatCanAdd').checked = !!state.chatCanAdd;

  const host = document.getElementById('todoList');
  host.replaceChildren();
  if (!state.tasks.length) {
    const empty = document.createElement('p');
    empty.className = 'sub';
    empty.style.margin = '0';
    empty.textContent = 'Nothing on the list yet. Add the first thing above.';
    host.append(empty);
  }
  for (const task of state.tasks) host.append(row(task, state.tasks.length));

  const left = state.tasks.filter((t) => !t.done).length;
  const pill = document.getElementById('todoCount');
  pill.innerHTML = '';
  const dot = document.createElement('span');
  dot.className = `dot${state.tasks.length ? ' ok' : ''}`;
  pill.append(dot, document.createTextNode(
    state.tasks.length ? `${left} to do, ${state.tasks.length - left} finished` : 'nothing on the list',
  ));

  const mine = state.tasks.filter((t) => t.by);
  document.getElementById('todoChatCount').textContent = mine.length
    ? `${mine.length} viewer task(s) on the list.`
    : 'No viewer tasks on the list.';
}

function row(task, total) {
  const line = document.createElement('div');
  line.className = 'row';
  line.style.cssText = 'gap:8px;margin-bottom:8px;flex-wrap:nowrap';

  const tick = document.createElement('button');
  tick.className = task.done ? 'primary' : 'ghost';
  tick.style.cssText = 'width:38px;flex:0 0 auto';
  tick.textContent = task.done ? '✓' : ' ';
  tick.title = task.done ? 'Put it back on the list' : 'Mark it finished';
  tick.addEventListener('click', () => send({ action: 'check', n: task.n, done: !task.done }));

  const num = document.createElement('span');
  num.className = 'sub';
  num.style.cssText = 'flex:0 0 auto;min-width:22px;text-align:right';
  num.textContent = `${task.n}.`;

  const text = document.createElement('input');
  text.type = 'text';
  text.className = 'grow';
  text.value = task.text;
  text.maxLength = 120;
  text.dataset.todoEdit = String(task.n);
  if (task.done) text.style.opacity = '0.55';
  const commit = () => {
    const value = text.value.trim();
    if (!value || value === task.text) {
      text.value = task.text;
      return;
    }
    send({ action: 'edit', n: task.n, text: value });
  };
  text.addEventListener('blur', commit);
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') text.blur();
    if (e.key === 'Escape') { text.value = task.text; text.blur(); }
  });

  line.append(tick, num, text);

  // Whose it is, so a viewer's task is never mistaken for one of your own.
  if (task.by) {
    const who = document.createElement('span');
    who.className = 'pill';
    who.style.cssText = 'flex:0 0 auto';
    who.textContent = task.by.displayName || task.by.name;
    who.title = `Added from ${task.by.platform} chat`;
    line.append(who);
  }

  const up = arrow('↑', 'Move it up', () => send({ action: 'move', n: task.n, to: task.n - 1 }), task.n === 1);
  const down = arrow('↓', 'Move it down', () => send({ action: 'move', n: task.n, to: task.n + 1 }), task.n === total);
  const remove = arrow('✕', 'Take it off the list', () => send({ action: 'remove', n: task.n }));
  remove.classList.add('danger');

  line.append(up, down, remove);
  return line;
}

function arrow(label, title, onClick, disabled = false) {
  const button = document.createElement('button');
  button.className = 'ghost';
  button.style.cssText = 'width:38px;flex:0 0 auto';
  button.textContent = label;
  button.title = title;
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}

// ---------------------------------------------------------------- wiring

const newTask = document.getElementById('todoNew');
function addTask() {
  const text = newTask.value.trim();
  if (!text) return;
  newTask.value = '';
  send({ action: 'add', text });
}
document.getElementById('todoAdd').addEventListener('click', addTask);
newTask.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });

document.getElementById('todoChatCanAdd').addEventListener('change', async (e) => {
  const state = await send({ action: 'chat', on: e.target.checked });
  if (state?.message) toast(state.message);
});

document.getElementById('todoClearDone').addEventListener('click', () => send({ action: 'clear', which: 'done' }));
document.getElementById('todoClearChat').addEventListener('click', () => send({ action: 'clear', which: 'chat' }));
document.getElementById('todoClearAll').addEventListener('click', () => {
  // No dialog box: a browser confirm() inside OBS's own browser would be a trap,
  // and the same list can be typed back in seconds.
  send({ action: 'clear', which: 'all' });
  toast('List cleared');
});

const url = `${location.origin}/overlays/todo/list/`;
document.getElementById('todoUrl').value = url;
document.getElementById('todoCopy').addEventListener('click', () => {
  navigator.clipboard?.writeText(url).then(
    () => toast('Link copied - add it to OBS as a Browser Source'),
    () => toast('Could not copy'),
  );
});

refresh();
setInterval(refresh, POLL_MS);
