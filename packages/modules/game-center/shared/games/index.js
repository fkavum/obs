import { race } from './race.js';
import { boss } from './boss.js';
import { heist } from './heist.js';

export { race, boss, heist };
export const GAMES = { race, boss, heist };
export const GAME_LIST = [race, boss, heist];
export * from './engine.js';
