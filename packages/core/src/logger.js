/** Tiny leveled logger. Keeps bridge output readable for a non-technical operator. */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const COLORS = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET = '\x1b[0m';

let threshold = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

export function setLogLevel(level) {
  threshold = LEVELS[level] ?? threshold;
}

export function createLogger(scope) {
  const emit = (level, args) => {
    if (LEVELS[level] < threshold) return;
    const time = new Date().toTimeString().slice(0, 8);
    const tint = process.stdout.isTTY ? COLORS[level] : '';
    const reset = process.stdout.isTTY ? RESET : '';
    console[level === 'debug' ? 'log' : level](`${tint}${time} ${scope}${reset}`, ...args);
  };
  return {
    debug: (...a) => emit('debug', a),
    info: (...a) => emit('info', a),
    warn: (...a) => emit('warn', a),
    error: (...a) => emit('error', a),
    child: (sub) => createLogger(`${scope}:${sub}`),
  };
}
