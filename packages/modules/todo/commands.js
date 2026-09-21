/**
 * Chat commands for the to-do list.
 *
 * Two audiences, and the difference matters:
 *
 *   the streamer  runs the whole list with !task ... - and is recognised by the
 *                 broadcaster badge the platform itself puts on their messages,
 *                 so there is nothing to configure and nobody can borrow it.
 *   everybody     !create keeps one task of their own, !done finishes it, and
 *                 only while the streamer has switched chat tasks on.
 *
 * The list on stream is the real answer to every command - a chat reply only
 * happens when a platform is signed in, which most of the time it is not.
 */

const VIEWER_COOLDOWN_MS = 8000;

/** Platforms mark the channel owner themselves; that is who "me" is. */
export const isStreamer = (event) => (event?.user?.roles || []).includes('broadcaster');

const VERBS = {
  add: 'add', new: 'add', '+': 'add',
  done: 'done', check: 'done', tick: 'done', finish: 'done', x: 'done',
  undone: 'undone', uncheck: 'undone', undo: 'undone', back: 'undone',
  remove: 'remove', delete: 'remove', del: 'remove', rm: 'remove', drop: 'remove',
  move: 'move', order: 'move',
  edit: 'edit', rename: 'edit', change: 'edit',
  clear: 'clear', reset: 'clear',
  chat: 'chat', viewers: 'chat',
  help: 'help',
  list: 'list', show: 'list',
};

export const HELP = '!task add <thing> · !task done 2 · !task move 3 1 · !task edit 2 <thing> · !task remove 2 · !task clear done · !task chat on';

export function createCommands({ tasks, hub, log }) {
  const lastUse = new Map();

  function onCooldown(key, now) {
    const last = lastUse.get(key) || 0;
    if (now - last < VIEWER_COOLDOWN_MS) return true;
    lastUse.set(key, now);
    // A long stream would otherwise grow this map without bound.
    if (lastUse.size > 500) {
      for (const [k, t] of lastUse) if (now - t > VIEWER_COOLDOWN_MS * 4) lastUse.delete(k);
    }
    return false;
  }

  /** Best effort: says it in chat if a platform is signed in, silent if not. */
  function say(event, result) {
    if (!result || result.silent || !result.message) return;
    hub?.say?.(event.platform, result.message)?.catch?.(() => {});
  }

  /** A one-line summary of the list, for !tasks where the bot can talk. */
  function summary() {
    const { tasks: rows } = tasks.state();
    if (!rows.length) return 'Nothing on the list yet.';
    return rows
      .slice(0, 8)
      .map((t) => `${t.n}. ${t.done ? `${t.text} (done)` : t.text}${t.by ? ` - ${t.by.displayName}` : ''}`)
      .join(' · ');
  }

  function runStreamerVerb(verb, rest) {
    const [first, ...tail] = rest.split(/\s+/).filter(Boolean);
    switch (verb) {
      case 'add':
        return tasks.add(rest);
      case 'done':
        return tasks.check(first, true);
      case 'undone':
        return tasks.check(first, false);
      case 'remove':
        return tasks.remove(first);
      case 'move':
        return tasks.move(first, tail[0]);
      case 'edit':
        return tasks.edit(first, tail.join(' '));
      case 'clear': {
        const which = ['all', 'chat', 'done'].includes((first || '').toLowerCase()) ? first.toLowerCase() : 'done';
        return tasks.clear(which);
      }
      case 'chat': {
        const word = (first || '').toLowerCase();
        if (word === 'on' || word === 'off') return tasks.setChatCanAdd(word === 'on');
        return { ok: true, message: tasks.chatCanAdd ? 'Chat tasks are on. !task chat off to stop them.' : 'Chat tasks are off. !task chat on to allow them.' };
      }
      case 'help':
        return { ok: true, message: HELP };
      case 'list':
      default:
        return { ok: true, message: summary() };
    }
  }

  return {
    /** @returns {boolean} whether this message was a to-do command. */
    handle(event) {
      if (event?.type !== 'chat') return false;
      const text = String(event.data?.text || '').trim();
      if (!text.startsWith('!')) return false;

      const [word, ...rest] = text.split(/\s+/);
      const command = word.toLowerCase();
      const args = rest.join(' ').trim();
      const now = Date.now();
      const user = event.user || {};
      const by = { platform: event.platform, name: user.name || user.displayName, displayName: user.displayName || user.name };

      // ---- the streamer's own controls ------------------------------------
      if (command === '!task' || command === '!todo') {
        if (!isStreamer(event)) {
          // Chat typing !task is asking to see the list, not to change it.
          if (!onCooldown(`${event.platform}:${by.name}:list`, now)) say(event, { ok: true, message: summary() });
          return true;
        }
        const [maybeVerb, ...tail] = args.split(/\s+/).filter(Boolean);
        const verb = VERBS[(maybeVerb || '').toLowerCase()];
        // "!task tidy the desk" means add it - a verb they have to remember
        // first is a worse command than one that does the obvious thing.
        const result = verb
          ? runStreamerVerb(verb, tail.join(' '))
          : args ? tasks.add(args) : { ok: true, message: summary() };
        if (!result.ok) log?.debug?.(`!task: ${result.message}`);
        say(event, result);
        return true;
      }

      if (command === '!tasks' || command === '!todos') {
        if (!onCooldown(`${event.platform}:${by.name}:list`, now)) say(event, { ok: true, message: summary() });
        return true;
      }

      // ---- what everybody in chat can do ----------------------------------
      if (command === '!create') {
        if (!tasks.chatCanAdd) return true;
        if (onCooldown(`${event.platform}:${by.name}:create`, now)) return true;
        say(event, tasks.createForViewer(by, args));
        return true;
      }

      if (command === '!done') {
        // The streamer typing !done means their own chat task, if they made one
        // with !create; their list tasks are finished by number.
        if (!tasks.chatCanAdd && !tasks.ownedBy(by)) return true;
        if (onCooldown(`${event.platform}:${by.name}:done`, now)) return true;
        say(event, tasks.doneForViewer(by));
        return true;
      }

      return false;
    },
  };
}
