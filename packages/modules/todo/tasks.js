/**
 * The to-do list itself: the data, the rules, and the file it lives in.
 *
 * The list is small and changes a few times a minute at most, so every change is
 * written straight to disk - there is no flush timer that could lose work.
 *
 * Tasks are addressed by the number shown on stream: the first line is 1, the
 * second is 2, and removing or reordering renumbers the rest. That is what lets
 * the streamer read a number off their own overlay and type it into chat, and it
 * keeps the file a plain ordered list with no ids to keep unique by hand.
 */
import { watch, readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

export const MAX_TASKS = 40;
export const MAX_TEXT = 120;
/** How long a viewer's finished task stays on screen, ticked, before it goes. */
export const DONE_LINGER_MS = 12000;

export const EMPTY = { chatCanAdd: false, tasks: [] };

// Written as ranges rather than literals so the file can be read in any editor.
const CONTROL = new RegExp('[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u202a-\\u202e]', 'g');
const BREAKS = new RegExp('[\\r\\n\\u2028\\u2029\\t]+', 'g');

/** One line of chat, made safe to draw on a stream and to store. */
export function cleanText(text) {
  return String(text ?? '')
    .replace(BREAKS, ' ')
    // Invisible characters would make a task look blank or shove the line about.
    .replace(CONTROL, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, MAX_TEXT);
}

/** Who owns a task. `null` means the streamer's own. */
export function ownerKey(by) {
  return by ? `${by.platform}:${String(by.name || '').toLowerCase()}` : null;
}

function normalizeOwner(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = cleanText(raw.name || raw.displayName).slice(0, 40);
  if (!name) return null;
  return {
    platform: cleanText(raw.platform).slice(0, 30).toLowerCase() || 'unknown',
    name: name.toLowerCase(),
    displayName: cleanText(raw.displayName || raw.name).slice(0, 40),
  };
}

/**
 * Accepts anything a hand-edited file might hold - including a bare string, so
 * a list can be typed as `"tasks": ["first thing", "second thing"]`.
 */
function normalizeTask(raw) {
  if (typeof raw === 'string') {
    const text = cleanText(raw);
    return text ? { text, done: false, by: null, doneAt: null } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const text = cleanText(raw.text);
  if (!text) return null;
  const done = !!raw.done;
  return {
    text,
    done,
    by: normalizeOwner(raw.by),
    doneAt: done ? (Number.isFinite(Number(raw.doneAt)) ? Number(raw.doneAt) : Date.now()) : null,
  };
}

/** A file someone edited by hand must never be able to break the stream. */
export function normalize(raw) {
  const tasks = Array.isArray(raw?.tasks) ? raw.tasks : [];
  return {
    chatCanAdd: !!raw?.chatCanAdd,
    tasks: tasks.map(normalizeTask).filter(Boolean).slice(0, MAX_TASKS),
  };
}

/**
 * @param {{store: object, log?: object, onChange?: Function, linger?: number, watchFile?: boolean}} options
 */
export function createTaskList({ store, log, onChange, linger = DONE_LINGER_MS, watchFile = true } = {}) {
  const serialize = (value) => JSON.stringify({ chatCanAdd: value.chatCanAdd, tasks: value.tasks });

  let data = normalize(store.load('tasks', EMPTY) || EMPTY);
  let lastWritten = serialize(data);
  const timers = new Set();
  let watcher = null;
  let reloadTimer = null;

  function persist() {
    data.tasks = data.tasks.slice(0, MAX_TASKS);
    lastWritten = serialize(data);
    store.save('tasks', { chatCanAdd: data.chatCanAdd, tasks: data.tasks });
  }

  function changed() {
    persist();
    armSweep();
    onChange?.(list.state());
  }

  /** Public shape: the number on screen is the number chat types. */
  function view() {
    return data.tasks.map((t, i) => ({
      n: i + 1,
      text: t.text,
      done: !!t.done,
      by: t.by ? { platform: t.by.platform, name: t.by.name, displayName: t.by.displayName } : null,
    }));
  }

  const at = (n) => {
    const index = Number.parseInt(n, 10) - 1;
    return Number.isInteger(index) && index >= 0 && index < data.tasks.length ? index : -1;
  };

  const no = (message) => ({ ok: false, message });
  const yes = (message, extra = {}) => ({ ok: true, message, ...extra });

  /** A finished viewer task clears itself, so the list doesn't silt up. */
  function sweep() {
    const now = Date.now();
    const before = data.tasks.length;
    data.tasks = data.tasks.filter((t) => !(t.by && t.done && t.doneAt && now - t.doneAt >= linger));
    if (data.tasks.length !== before) changed();
    else armSweep();
  }

  function armSweep() {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    const now = Date.now();
    const due = data.tasks
      .filter((t) => t.by && t.done && t.doneAt)
      .map((t) => t.doneAt + linger - now);
    if (!due.length) return;
    const timer = setTimeout(sweep, Math.max(20, Math.min(...due)));
    timer.unref?.();
    timers.add(timer);
  }

  /** Pick the file back up when the operator edits it in a text editor. */
  function startWatching() {
    if (!watchFile) return;
    let path;
    try {
      path = store.path('tasks');
    } catch {
      return;
    }
    try {
      // The directory, not the file: saves are atomic renames, so a watch on the
      // file itself would follow the replaced one and go deaf after one edit.
      watcher = watch(dirname(path), (_event, filename) => {
        if (filename && filename !== basename(path)) return;
        clearTimeout(reloadTimer);
        // Editors write in bursts; settle first so we read a whole file.
        reloadTimer = setTimeout(() => reloadFromDisk(path), 150);
        reloadTimer.unref?.();
      });
      watcher.unref?.();
      watcher.on?.('error', () => { watcher = null; });
    } catch {
      // No file watching on this platform is fine - the setup page still works.
      log?.debug?.('could not watch the task file; edits there need a restart');
    }
  }

  function reloadFromDisk(path) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      // Half-saved or mistyped: keep what is on screen rather than clearing it.
      log?.warn?.('the task file could not be read just now, keeping the list that is on screen');
      return;
    }
    const next = normalize(parsed);
    if (serialize(next) === lastWritten) return;
    data = next;
    lastWritten = serialize(data);
    log?.info?.(`task file changed on disk - ${data.tasks.length} task(s) reloaded`);
    armSweep();
    onChange?.(list.state());
  }

  const list = {
    state() {
      return {
        chatCanAdd: data.chatCanAdd,
        tasks: view(),
        total: data.tasks.length,
        left: data.tasks.filter((t) => !t.done).length,
      };
    },

    /** Whether chat may keep a task of their own. */
    get chatCanAdd() {
      return data.chatCanAdd;
    },

    setChatCanAdd(on) {
      data.chatCanAdd = !!on;
      changed();
      return yes(data.chatCanAdd ? 'Chat can add their own tasks now - !create <what you are doing>' : 'Chat tasks are off.');
    },

    add(text, by = null) {
      const clean = cleanText(text);
      if (!clean) return no('Add what? Try: !task add tidy the desk');
      if (data.tasks.length >= MAX_TASKS) return no(`The list is full (${MAX_TASKS} tasks).`);
      data.tasks.push({ text: clean, done: false, by: normalizeOwner(by), doneAt: null });
      changed();
      return yes(`${data.tasks.length}. ${clean}`, { n: data.tasks.length });
    },

    check(n, done = true) {
      const i = at(n);
      if (i === -1) return no(`There is no task ${n}.`);
      data.tasks[i].done = !!done;
      data.tasks[i].doneAt = done ? Date.now() : null;
      changed();
      return yes(`${i + 1}. ${data.tasks[i].text}${done ? ' - done' : ' - back on the list'}`);
    },

    remove(n) {
      const i = at(n);
      if (i === -1) return no(`There is no task ${n}.`);
      const [gone] = data.tasks.splice(i, 1);
      changed();
      return yes(`Removed: ${gone.text}`);
    },

    edit(n, text) {
      const i = at(n);
      if (i === -1) return no(`There is no task ${n}.`);
      const clean = cleanText(text);
      if (!clean) return no('Change it to what? Try: !task edit 2 the new wording');
      data.tasks[i].text = clean;
      changed();
      return yes(`${i + 1}. ${clean}`);
    },

    /** Move the task at `n` so that it becomes number `to`. */
    move(n, to) {
      const i = at(n);
      if (i === -1) return no(`There is no task ${n}.`);
      let target = Number.parseInt(to, 10) - 1;
      if (!Number.isInteger(target)) return no('Move it to which number? Try: !task move 3 1');
      target = Math.max(0, Math.min(data.tasks.length - 1, target));
      if (target === i) return yes(`${i + 1}. ${data.tasks[i].text} is already there.`);
      const [moved] = data.tasks.splice(i, 1);
      data.tasks.splice(target, 0, moved);
      changed();
      return yes(`${target + 1}. ${moved.text}`);
    },

    /** `all`, `done` (the ticked ones) or `chat` (everything viewers added). */
    clear(which = 'done') {
      const before = data.tasks.length;
      if (which === 'all') data.tasks = [];
      else if (which === 'chat') data.tasks = data.tasks.filter((t) => !t.by);
      else data.tasks = data.tasks.filter((t) => !t.done);
      const gone = before - data.tasks.length;
      changed();
      if (!gone) return yes('Nothing to clear.');
      return yes(which === 'all' ? 'List cleared.' : `Cleared ${gone} task(s).`);
    },

    /** The task a viewer owns, if they have one. */
    ownedBy(by) {
      const key = ownerKey(normalizeOwner(by));
      if (!key) return null;
      const i = data.tasks.findIndex((t) => ownerKey(t.by) === key);
      return i === -1 ? null : { n: i + 1, task: data.tasks[i] };
    },

    /**
     * One task per viewer: typing it again replaces the one they had, which is
     * also how someone who finished and changed their mind gets back on.
     */
    createForViewer(by, text) {
      if (!data.chatCanAdd) return { ok: false, silent: true, message: 'Chat tasks are switched off.' };
      const owner = normalizeOwner(by);
      if (!owner) return { ok: false, silent: true, message: 'No name on that message.' };
      const clean = cleanText(text);
      if (!clean) return no(`${owner.displayName}: say what you are doing, like !create beating the boss`);

      const existing = list.ownedBy(owner);
      if (existing) {
        existing.task.text = clean;
        existing.task.done = false;
        existing.task.doneAt = null;
        changed();
        return yes(`${owner.displayName} is now: ${clean}`, { n: existing.n, replaced: true });
      }
      if (data.tasks.length >= MAX_TASKS) return no('The list is full right now - try again in a bit.');
      data.tasks.push({ text: clean, done: false, by: owner, doneAt: null });
      changed();
      return yes(`${owner.displayName}: ${clean}`, { n: data.tasks.length });
    },

    /** A viewer finishing: it ticks, everyone sees it, then it clears itself. */
    doneForViewer(by) {
      const owner = normalizeOwner(by);
      const existing = owner && list.ownedBy(owner);
      if (!existing) return { ok: false, silent: true, message: 'No task to finish.' };
      existing.task.done = true;
      existing.task.doneAt = Date.now();
      changed();
      return yes(`${owner.displayName} finished: ${existing.task.text}`, { n: existing.n });
    },

    start() {
      armSweep();
      startWatching();
      return list;
    },

    stop() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      clearTimeout(reloadTimer);
      watcher?.close?.();
      watcher = null;
    },
  };

  return list;
}
