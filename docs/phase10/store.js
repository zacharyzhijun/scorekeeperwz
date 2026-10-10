// All game data lives in this browser. Nothing is sent anywhere.
//
// Two keys are used:
//   phase10.game.v1     the game currently being played
//   phase10.archive.v1  previously played games, newest first
//
// Both are small JSON blobs — a 20-round game with 6 players is about 2 KB —
// so localStorage is a comfortable fit and avoids IndexedDB's async ceremony.

import { emptyGame, snapshot, standings, winnerOf, validatePlayers, isValidRound, normalizeRound } from './game.js';

const GAME_KEY = 'phase10.game.v1';
const ARCHIVE_KEY = 'phase10.archive.v1';

/** Plenty for years of play, and still only a fraction of the storage quota. */
const MAX_ARCHIVED = 200;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Private browsing, or the quota is full. The game still works in memory.
    return false;
  }
}

/** crypto.randomUUID needs a secure context, which a plain-HTTP LAN page isn't. */
function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isGameShaped(value) {
  return Boolean(value) && Array.isArray(value.players) && Array.isArray(value.rounds);
}

/** A finished or abandoned game, reduced to what the history list needs. */
function toRecord(game) {
  const table = standings(game);
  const winner = winnerOf(table);
  return {
    id: newId(),
    savedAt: new Date().toISOString(),
    players: game.players,
    rounds: game.rounds,
    completed: Boolean(winner),
    winner,
    finalScores: table.map(({ name, score, phase, done }) => ({ name, score, phase, done })),
  };
}

export class LocalStore {
  #game = emptyGame();
  #archive = [];

  /** Loads whatever is on this device. Call once at startup. */
  async read() {
    const stored = readJSON(GAME_KEY, null);
    this.#game = isGameShaped(stored) ? stored : emptyGame();
    const archive = readJSON(ARCHIVE_KEY, []);
    this.#archive = Array.isArray(archive) ? archive.filter(isGameShaped) : [];
    return snapshot(this.#game);
  }

  #persistGame() {
    writeJSON(GAME_KEY, this.#game);
  }

  #persistArchive() {
    this.#archive = this.#archive.slice(0, MAX_ARCHIVED);
    writeJSON(ARCHIVE_KEY, this.#archive);
  }

  /** Moves the game in progress into the history, if it was ever played. */
  #archiveCurrent() {
    if (this.#game.rounds.length === 0) return;
    this.#archive.unshift(toRecord(this.#game));
    this.#persistArchive();
  }

  async newGame(players) {
    this.#archiveCurrent();
    this.#game = { ...emptyGame(), players: validatePlayers(players) };
    this.#persistGame();
    return snapshot(this.#game);
  }

  async addRound(entries) {
    if (!isValidRound(entries, this.#game.players.length)) {
      throw new Error('Invalid round data.');
    }
    this.#game.rounds.push(normalizeRound(entries));
    this.#persistGame();
    return snapshot(this.#game);
  }

  async undo() {
    this.#game.rounds.pop();
    this.#persistGame();
    return snapshot(this.#game);
  }

  /** Ends the current game, keeping it in the history. */
  async reset() {
    this.#archiveCurrent();
    this.#game = emptyGame();
    this.#persistGame();
    return snapshot(this.#game);
  }

  // --- history ----------------------------------------------------------

  get archive() {
    return this.#archive;
  }

  async deleteArchived(id) {
    this.#archive = this.#archive.filter((record) => record.id !== id);
    this.#persistArchive();
  }

  async clearArchive() {
    this.#archive = [];
    this.#persistArchive();
  }

  // --- backup file ------------------------------------------------------

  /** Everything this device knows, as a plain object ready to be downloaded. */
  exportData() {
    return {
      app: 'phase-ten-scorer',
      version: 1,
      exportedAt: new Date().toISOString(),
      current: this.#game,
      archive: this.#archive,
    };
  }

  /**
   * Merges a backup in. Archived games already present (same id) are skipped,
   * and a game in progress is only restored when there isn't one already, so
   * importing can't silently destroy the game on the table.
   */
  async importData(payload) {
    if (!payload || payload.app !== 'phase-ten-scorer') {
      throw new Error('That file is not a Phase 10 backup.');
    }
    const incoming = Array.isArray(payload.archive) ? payload.archive.filter(isGameShaped) : [];
    const known = new Set(this.#archive.map((record) => record.id));
    const added = incoming.filter((record) => record.id && !known.has(record.id));

    this.#archive = [...this.#archive, ...added].sort(
      (a, b) => new Date(b.savedAt ?? 0) - new Date(a.savedAt ?? 0)
    );
    this.#persistArchive();

    let restoredCurrent = false;
    if (this.#game.players.length === 0 && isGameShaped(payload.current) && payload.current.players.length > 0) {
      this.#game = payload.current;
      this.#persistGame();
      restoredCurrent = true;
    }

    return { added: added.length, skipped: incoming.length - added.length, restoredCurrent };
  }
}

/**
 * Asks the browser to exempt this site from storage eviction. Safari grants it
 * silently for home-screen apps; elsewhere it may decline, which is harmless.
 */
export async function requestDurableStorage() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
