import { PHASES, MAX_PLAYERS } from './game.js';
import { LocalStore, requestDurableStorage } from './store.js';

const $ = (sel) => document.querySelector(sel);
const setup = $('#setup');
const gameView = $('#game');
const nameInputs = $('#nameInputs');
const setupError = $('#setupError');
const roundForm = $('#roundForm');
const banner = $('#banner');

const store = new LocalStore();
let state = null;

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

// --- setup screen --------------------------------------------------------

function addNameRow(value = '') {
  const row = document.createElement('div');
  row.className = 'name-row';
  row.innerHTML = `
    <span></span>
    <input type="text" maxlength="20" placeholder="Player name"
           autocapitalize="words" autocomplete="off" enterkeyhint="next" />
    <button class="secondary" type="button" aria-label="Remove player">&times;</button>`;
  row.querySelector('input').value = value;
  row.querySelector('button').addEventListener('click', () => {
    row.remove();
    renumber();
  });
  nameInputs.append(row);
  renumber();
  return row;
}

function renumber() {
  const rows = [...nameInputs.querySelectorAll('.name-row')];
  rows.forEach((row, i) => {
    row.querySelector('span').textContent = `${i + 1}.`;
    row.querySelector('button').disabled = rows.length <= 2;
  });
  $('#addPlayer').disabled = rows.length >= MAX_PLAYERS;
}

$('#addPlayer').addEventListener('click', () => addNameRow().querySelector('input').focus());

$('#startGame').addEventListener('click', async () => {
  const players = [...nameInputs.querySelectorAll('input')].map((i) => i.value.trim());
  setupError.textContent = '';
  try {
    state = await store.newGame(players);
    render();
  } catch (err) {
    setupError.textContent = err.message;
  }
});

nameInputs.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const rows = [...nameInputs.querySelectorAll('.name-row')];
  const idx = rows.findIndex((r) => r.contains(e.target));
  if (idx > -1 && idx < rows.length - 1) rows[idx + 1].querySelector('input').focus();
  else $('#startGame').click();
});

// --- game screen ---------------------------------------------------------

function renderStandings() {
  const body = $('#standings tbody');
  body.replaceChildren();
  const ranked = [...state.standings].sort((a, b) => b.phase - a.phase || a.score - b.score);
  for (const p of ranked) {
    const tr = document.createElement('tr');
    if (p === ranked[0] && state.rounds.length > 0) tr.className = 'leader';
    tr.innerHTML = `<td></td><td class="phase"><b></b><small></small></td><td class="num"></td>`;
    tr.children[0].textContent = p.name;
    tr.children[1].querySelector('b').textContent = p.done ? 'Done' : `Phase ${p.phase}`;
    tr.children[1].querySelector('small').textContent = p.done ? '' : PHASES[p.phase - 1];
    tr.children[2].textContent = p.score;
    body.append(tr);
  }
}

function renderRoundForm() {
  roundForm.replaceChildren();
  const over = Boolean(state.winner);
  for (const p of state.standings) {
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = `
      <div class="who"><small></small></div>
      <input type="number" min="0" max="999" step="5" value="0"
             inputmode="numeric" pattern="[0-9]*" enterkeyhint="done"
             aria-label="Points left in hand" />
      <label class="check">
        <input type="checkbox" /> <span>Made phase</span>
      </label>`;
    div.querySelector('.who').prepend(p.name);
    div.querySelector('small').textContent = p.done
      ? 'Finished all phases'
      : `Phase ${p.phase}: ${PHASES[p.phase - 1]}`;
    const num = div.querySelector('input[type="number"]');
    num.addEventListener('focus', () => num.select());
    div.querySelector('input[type="checkbox"]').disabled = p.done;
    if (over) div.querySelectorAll('input').forEach((i) => (i.disabled = true));
    roundForm.append(div);
  }
  $('#entryHeading').textContent = over ? 'Game over' : `Enter round ${state.rounds.length + 1}`;
  $('#saveRound').disabled = over;
  $('#undoRound').disabled = state.rounds.length === 0;
}

function renderHistory() {
  const head = $('#history thead tr');
  const body = $('#history tbody');
  head.replaceChildren();
  body.replaceChildren();

  const th = (text, cls = '') => {
    const el = document.createElement('th');
    el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  head.append(th('Round'));
  for (const name of state.players) head.append(th(name, 'num'));

  state.rounds.forEach((round, idx) => {
    const tr = document.createElement('tr');
    const first = document.createElement('td');
    first.textContent = idx + 1;
    tr.append(first);
    for (const entry of round) {
      const td = document.createElement('td');
      td.className = entry.completed ? 'num made' : 'num';
      td.textContent = entry.completed ? `${entry.points} ✓` : `${entry.points}`;
      tr.append(td);
    }
    body.append(tr);
  });

  if (state.rounds.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = state.players.length + 1;
    td.className = 'empty';
    td.textContent = 'No rounds yet.';
    tr.append(td);
    body.append(tr);
  }
}

function renderBanner() {
  if (!state.winner) {
    banner.classList.add('hidden');
    return;
  }
  const { names, score, tie } = state.winner;
  banner.textContent = tie
    ? `Tie — ${names.join(' & ')} finished phase 10 with ${score} points.`
    : `${names[0]} wins with ${score} points!`;
  banner.classList.remove('hidden');
}

// --- past games ----------------------------------------------------------

const dayFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function renderArchive() {
  const list = $('#archiveList');
  const records = store.archive;
  list.replaceChildren();

  $('#archiveCount').textContent = records.length === 1 ? '1 game' : `${records.length} games`;
  $('#clearArchive').disabled = records.length === 0;

  if (records.length === 0) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Finished games are saved here automatically.';
    list.append(p);
    return;
  }

  for (const record of records) {
    const row = document.createElement('div');
    row.className = 'past';

    const title = record.completed && record.winner
      ? (record.winner.tie
          ? `${record.winner.names.join(' & ')} tied`
          : `${record.winner.names[0]} won`)
      : 'Unfinished';

    const when = record.savedAt ? dayFormat.format(new Date(record.savedAt)) : '';
    const scores = [...(record.finalScores ?? [])]
      .sort((a, b) => a.score - b.score)
      .map((p) => `${p.name} ${p.score}`)
      .join(' · ');

    row.innerHTML = `
      <div class="past-main">
        <b></b>
        <small></small>
      </div>
      <button class="icon" type="button" aria-label="Delete this game">&times;</button>`;
    row.querySelector('b').textContent = `${title} — ${when}`;
    row.querySelector('small').textContent =
      `${record.rounds.length} round${record.rounds.length === 1 ? '' : 's'} · ${scores}`;
    row.querySelector('button').addEventListener('click', async () => {
      if (!confirm('Delete this saved game?')) return;
      await store.deleteArchived(record.id);
      renderArchive();
    });
    list.append(row);
  }
}

$('#clearArchive').addEventListener('click', async () => {
  if (!confirm('Delete every saved game? This cannot be undone.')) return;
  await store.clearArchive();
  renderArchive();
});

// --- backup file ---------------------------------------------------------

$('#exportData').addEventListener('click', () => {
  const payload = store.exportData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `phase10-backup-${stamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const result = await store.importData(JSON.parse(await file.text()));
    state = await store.read();
    renderArchive();
    render();
    const parts = [`${result.added} game${result.added === 1 ? '' : 's'} added`];
    if (result.skipped) parts.push(`${result.skipped} already here`);
    if (result.restoredCurrent) parts.push('game in progress restored');
    toast(parts.join(', ') + '.');
  } catch (err) {
    toast(err.message || 'Could not read that file.');
  }
});

// --- render --------------------------------------------------------------

function render() {
  const started = state.players.length > 0;
  setup.classList.toggle('hidden', started);
  gameView.classList.toggle('hidden', !started);
  if (!started) {
    if (nameInputs.children.length === 0) {
      addNameRow();
      addNameRow();
    }
    return;
  }
  $('#roundLabel').textContent = `${state.rounds.length} round${
    state.rounds.length === 1 ? '' : 's'
  }`;
  renderBanner();
  renderStandings();
  renderRoundForm();
  renderHistory();
}

roundForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const entries = [...roundForm.querySelectorAll('.entry')].map((row) => ({
    points: Number(row.querySelector('input[type="number"]').value) || 0,
    completed: row.querySelector('input[type="checkbox"]').checked,
  }));
  try {
    state = await store.addRound(entries);
    render();
    if (navigator.vibrate) navigator.vibrate(12);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    toast(err.message);
  }
});

$('#undoRound').addEventListener('click', async () => {
  if (!confirm('Remove the last round?')) return;
  state = await store.undo();
  render();
});

$('#newGame').addEventListener('click', async () => {
  const played = state.rounds.length > 0;
  const message = played
    ? 'End this game? It will be kept in your saved games.'
    : 'Start over?';
  if (!confirm(message)) return;
  state = await store.reset();
  nameInputs.replaceChildren();
  renderArchive();
  render();
});

const phaseOl = $('#phaseList ol');
for (const phase of PHASES) {
  const li = document.createElement('li');
  li.textContent = phase;
  phaseOl.append(li);
}

// --- boot ----------------------------------------------------------------

state = await store.read();
render();
renderArchive();
requestDurableStorage();

// Caches the app so it opens without a server. Needs a secure context:
// HTTPS, or localhost. Over a plain-HTTP LAN address this simply no-ops.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
