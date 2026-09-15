/**
 * Behaviour for the Game Center setup-page card. Loaded by the panel after the
 * card's markup is inserted; nothing in the shared panel code knows about it.
 */
const API = '/api/m/game-center';

function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(window.__gcToast);
  window.__gcToast = setTimeout(() => el.classList.remove('show'), 2600);
}
function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return res.json().catch(() => ({}));
}
function copy(text, message) {
  navigator.clipboard?.writeText(text).then(() => toast(message), () => toast('Could not copy'));
}

document.getElementById('gamesUrl').value = `${location.origin}/overlays/game-center/games/`;
document.getElementById('copyGames').addEventListener('click', () => {
  copy(document.getElementById('gamesUrl').value, 'Games link copied — add it to OBS as a full-screen Browser Source');
});

async function refreshGames() {
  let status;
  try {
    status = await (await fetch(`${API}/games`)).json();
  } catch {
    return;
  }

  const buttons = document.getElementById('gameButtons');
  if (!buttons.dataset.built) {
    for (const game of status.games) {
      const btn = document.createElement('button');
      btn.className = 'primary';
      btn.textContent = `${game.emoji} Start ${game.label}`;
      btn.title = `Chat joins by typing ${game.joinCommand}`;
      btn.addEventListener('click', async () => {
        const res = await post(`${API}/games`, { game: game.id });
        if (res.error) toast(res.error);
        else toast(`${game.label} started — chat types ${game.joinCommand}`);
        refreshGames();
      });
      buttons.append(btn);
    }
    buttons.dataset.built = '1';
  }

  const pill = document.getElementById('gameStatus');
  const running = status.running;
  pill.innerHTML = `<span class="dot ${running ? 'ok' : ''}"></span>${escape(
    running ? `${status.state.message || 'in progress'} · ${status.state.players?.length || 0} playing` : 'no game running',
  )}`;
  document.getElementById('gameCancel').hidden = !running;
  for (const btn of buttons.children) btn.disabled = running;

  const board = document.getElementById('gameBoard');
  board.replaceChildren();
  if (status.leaderboard?.length) {
    const title = document.createElement('p');
    title.className = 'sub';
    title.style.margin = '0 0 8px';
    title.textContent = 'Coin leaderboard';
    board.append(title);
    const row = document.createElement('div');
    row.className = 'row';
    row.style.flexWrap = 'wrap';
    status.leaderboard.slice(0, 8).forEach((p, i) => {
      const chip = document.createElement('span');
      chip.className = 'pill';
      chip.textContent = `${i + 1}. ${p.name} — ${p.coins}`;
      row.append(chip);
    });
    board.append(row);
  }
}

document.getElementById('gameCancel').addEventListener('click', async () => {
  await post(`${API}/games`, { action: 'cancel' });
  refreshGames();
});

refreshGames();
setInterval(refreshGames, 2000);

