import { GAMES } from './games.js';

const list = document.querySelector('#gameList');

function card(game) {
  const available = game.available !== false;
  const el = document.createElement(available ? 'a' : 'div');
  el.className = `game-card${available ? '' : ' unavailable'}`;
  if (available) el.href = game.href;

  el.innerHTML = `
    <span class="game-badge" aria-hidden="true"></span>
    <span class="game-text">
      <b></b>
      <small class="game-tagline"></small>
      <small class="game-meta"></small>
    </span>
    <span class="game-go" aria-hidden="true">${available ? '›' : 'Soon'}</span>`;

  el.querySelector('.game-badge').textContent = game.badge ?? game.name.slice(0, 2);
  el.querySelector('b').textContent = game.name;
  el.querySelector('.game-tagline').textContent = game.tagline ?? '';

  // A game may report what is already under way; a broken one must not take
  // the whole home page down with it.
  let progress = null;
  if (available && typeof game.progress === 'function') {
    try {
      progress = game.progress();
    } catch {
      progress = null;
    }
  }

  const meta = el.querySelector('.game-meta');
  if (progress?.label) {
    meta.textContent = progress.label;
    if (progress.active) meta.classList.add('active');
  } else {
    meta.textContent = game.players ?? '';
  }

  return el;
}

list.replaceChildren(...GAMES.map(card));
document.querySelector('#emptyNote').classList.toggle('hidden', GAMES.length > 0);

// Caches the app so it opens with no connection. Needs a secure context:
// HTTPS, or localhost.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
