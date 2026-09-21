/**
 * To-do list module.
 *
 * Self-contained: the list, its file, the chat commands, the overlay, the
 * setup-page card, the guide and the tests all live under packages/modules/todo/.
 * Nothing outside this folder names it.
 */
import { createModuleStore } from '#bridge/store.js';
import { createTaskList, EMPTY } from './tasks.js';
import { createCommands } from './commands.js';

export function createModule({ hub, log }) {
  const store = createModuleStore('todo');
  // Lay the shipped file down once, so "start over" always has something to
  // come back to and the operator can see the shape the file takes.
  store.seed('tasks', EMPTY);

  const tasks = createTaskList({
    store,
    log,
    onChange: (state) => hub.broadcast?.({ type: 'todo', state }),
  });
  const commands = createCommands({ tasks, hub, log });

  const onEvent = (event) => commands.handle(event);

  return {
    async start() {
      tasks.start();
      hub.on('event', onEvent);
      const state = tasks.state();
      log.info(`ready - ${state.total} task(s), chat tasks ${state.chatCanAdd ? 'on' : 'off'}`);
    },

    async stop() {
      hub.off('event', onEvent);
      tasks.stop();
    },

    /** Sent to an overlay the moment it connects, so the list is never blank. */
    hello() {
      return [{ type: 'todo', state: tasks.state() }];
    },

    async routes({ path, method, req, res, sendJSON, readBody }) {
      if (path === '/tasks' && method === 'GET') {
        sendJSON(res, 200, tasks.state());
        return true;
      }

      if (path === '/tasks' && method === 'POST') {
        const body = await readBody(req);
        const result = apply(body);
        sendJSON(res, result.ok ? 200 : 400, { ...result, ...tasks.state() });
        return true;
      }

      return false;
    },

    status() {
      const state = tasks.state();
      return { tasks: state.total, left: state.left, chatCanAdd: state.chatCanAdd };
    },
  };

  /** One place the setup page's buttons meet the same rules chat goes through. */
  function apply(body = {}) {
    switch (body.action) {
      case 'add': return tasks.add(body.text);
      case 'check': return tasks.check(body.n, body.done !== false);
      case 'remove': return tasks.remove(body.n);
      case 'move': return tasks.move(body.n, body.to);
      case 'edit': return tasks.edit(body.n, body.text);
      case 'clear': return tasks.clear(body.which);
      case 'chat': return tasks.setChatCanAdd(!!body.on);
      default: return { ok: false, message: `no such action: ${body.action}` };
    }
  }
}
