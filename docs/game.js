// Pure game rules and scoring. No storage, no network — just the maths.

export const PHASES = [
  '2 sets of 3',
  '1 set of 3 + 1 run of 4',
  '1 set of 4 + 1 run of 4',
  '1 run of 7',
  '1 run of 8',
  '1 run of 9',
  '2 sets of 4',
  '7 cards of one color',
  '1 set of 5 + 1 set of 2',
  '1 set of 5 + 1 set of 3',
];

export const MAX_PLAYERS = 8;

export function emptyGame() {
  return { players: [], rounds: [], createdAt: new Date().toISOString() };
}

export function standings(game) {
  return game.players.map((player, i) => {
    let score = 0;
    let phase = 1;
    for (const round of game.rounds) {
      const entry = round[i];
      if (!entry) continue;
      score += entry.points;
      if (entry.completed && phase <= PHASES.length) phase += 1;
    }
    return {
      name: player,
      score,
      phase: Math.min(phase, PHASES.length + 1),
      done: phase > PHASES.length,
    };
  });
}

export function winnerOf(table) {
  const finished = table.filter((p) => p.done);
  if (finished.length === 0) return null;
  const best = Math.min(...finished.map((p) => p.score));
  const tied = finished.filter((p) => p.score === best);
  return { names: tied.map((p) => p.name), score: best, tie: tied.length > 1 };
}

export function snapshot(game) {
  const table = standings(game);
  return {
    players: game.players,
    rounds: game.rounds,
    standings: table,
    winner: winnerOf(table),
  };
}

/** Returns a cleaned player list, or throws with a user-facing message. */
export function validatePlayers(names) {
  const cleaned = (names ?? [])
    .map((n) => String(n).trim())
    .filter(Boolean)
    .slice(0, MAX_PLAYERS);
  if (cleaned.length < 2) throw new Error('Need at least 2 players.');
  if (new Set(cleaned.map((n) => n.toLowerCase())).size !== cleaned.length) {
    throw new Error('Player names must be unique.');
  }
  return cleaned;
}

export function isValidRound(entries, playerCount) {
  if (!Array.isArray(entries) || entries.length !== playerCount) return false;
  return entries.every(
    (e) =>
      e &&
      Number.isFinite(e.points) &&
      e.points >= 0 &&
      e.points <= 999 &&
      typeof e.completed === 'boolean'
  );
}

export function normalizeRound(entries) {
  return entries.map((e) => ({ points: Math.round(e.points), completed: e.completed }));
}
