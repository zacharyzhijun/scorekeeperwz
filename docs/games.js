// The list of games on the home page.
//
// To add a game:
//   1. Create a folder next to this file, e.g. ./rummy/, holding its index.html
//      and whatever scripts it needs.
//   2. Add an entry below.
//   3. Add the new folder's files to the SHELL list in sw.js so the game works
//      offline, and bump the CACHE version there.
//
// `progress` is optional. When present it runs on the home page to show what is
// already under way, and it must never throw — storage can be unavailable.

/** Reads a JSON value written by a game, or null if absent or unreadable. */
function readStored(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const GAMES = [
  {
    id: 'phase10',
    name: 'Phase 10',
    tagline: 'Work through ten phases. Lowest score wins.',
    players: '2–8 players',
    badge: '10',
    href: 'phase10/',
    available: true,
    progress() {
      const game = readStored('phase10.game.v1');
      const archive = readStored('phase10.archive.v1');
      const saved = Array.isArray(archive) ? archive.length : 0;

      if (game?.players?.length) {
        const rounds = game.rounds?.length ?? 0;
        return {
          active: true,
          label: rounds === 0
            ? `${game.players.length} players, not started`
            : `In progress · round ${rounds + 1} · ${game.players.join(', ')}`,
        };
      }
      if (saved > 0) {
        return { active: false, label: `${saved} saved game${saved === 1 ? '' : 's'}` };
      }
      return null;
    },
  },

  // A game that is not ready yet still belongs here — it renders greyed out,
  // which is a useful placeholder. Delete this once there is a real one.
  // {
  //   id: 'rummy',
  //   name: 'Rummy',
  //   tagline: 'Melds and runs, scored by hand.',
  //   players: '2–6 players',
  //   badge: 'R',
  //   href: 'rummy/',
  //   available: false,
  // },
];
