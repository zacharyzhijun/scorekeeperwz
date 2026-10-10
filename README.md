# Scorekeeper

Score trackers for card games, running entirely in the browser and installable
onto an iPhone or iPad home screen. No accounts, no network calls, no
dependencies.

The home page lists the games; each game lives in its own folder. Phase 10 is
the first.

## Run it

```bash
npm start
```

It prints two addresses:

```
on this Mac   http://localhost:3000
on your phone http://192.168.x.x:3000
```

The Node process only hands over the HTML, CSS and JavaScript. It never sees a
score — every game is stored in the browser that entered it.

## Put it on your iPhone or iPad

1. Put the device on the same Wi-Fi as the Mac.
2. Open the `http://192.168.x.x:3000` address **in Safari** — only Safari can
   install to the home screen on iOS.
3. Share → **Add to Home Screen**.

## Playing

- Add 2–8 players in turn order.
- Each round, enter the points left in each hand and tick **Made phase** for
  anyone who completed theirs.
- Card values: 1–9 = 5 pts, 10–12 = 10 pts, Skip = 15 pts, Wild = 25 pts.
- First to finish phase 10 wins, ties broken by the lowest score. Once someone
  wins, score entry locks.
- **Undo last** rolls back a misentry.
- **New game** ends the current game and files it under **Saved games**.

## Where the scores live, and for how long

Everything sits in this browser's `localStorage`, under two keys:

| Key | Holds |
| --- | --- |
| `phase10.game.v1` | the game currently being played |
| `phase10.archive.v1` | finished games, newest first (most recent 200) |

Both are read once when the app loads and rewritten on every change, so closing
the tab, locking the phone or rebooting loses nothing.

How long it survives depends on how the app was opened:

- **Added to the home screen** — storage is kept indefinitely. Apple's 7-day
  cap on script-writable storage does not apply to home-screen web apps.
- **Opened as an ordinary Safari tab** — iOS deletes the data after **7 days**
  without visiting the site. This is Apple's anti-tracking policy, and it
  applies to every site, not just this one.

Either way the data is erased by deleting the home-screen icon, by Settings →
Safari → Clear History and Website Data, or by a browser's "clear site data".
The app asks for persistent storage on load, which makes eviction under low
disk space less likely, but no browser storage is a permanent archive.

So: **Export backup** writes a `phase10-backup-YYYY-MM-DD.json` file containing
every saved game plus the one in progress. That file is the durable copy — put
it in iCloud Drive or Files and it outlives any browser. **Restore from file**
reads one back, skipping games already present, so importing twice is safe and
cannot overwrite a game in progress.

## Layout

```
server.js                 static file server for local development
docs/                     the whole app — this folder is what gets published
  index.html              home page: the game picker
  home.js                 renders the picker
  games.js                the list of games  ← edit this to add one
  styles.css              shared styles for every page
  sw.js                   offline cache  ← add new files here too
  manifest.webmanifest    home-screen metadata
  icons/                  app icons
  phase10/
    index.html            the Phase 10 scorer
    app.js                its UI
    game.js               its scoring and phase rules
    store.js              its localStorage: current game, saved games, backups
```

## Adding another game

1. Create a folder in `docs/`, say `docs/rummy/`, with its own `index.html`.
   Link the shared stylesheet with `<link rel="stylesheet" href="../styles.css">`
   and add `<a class="back" href="../">‹ All games</a>` at the top.
2. Add an entry to `docs/games.js`. There is a commented-out example showing
   every field, including the optional `progress()` that puts "In progress"
   on the home page card.
3. Add the new files to `SHELL` in `docs/sw.js` and bump `CACHE` to the next
   version, or the game won't work offline.

Prefix its storage keys with the game's name, the way `phase10.*` does, so two
games can never tread on each other's data.

## Running without the Mac

`npm start` is only for development. For an app that opens anywhere, with no
laptop and no signal, put it on a free HTTPS host.

HTTPS is the requirement, not a preference: browsers only allow service workers
on a **secure context**, so offline caching cannot work over a plain-HTTP LAN
address like `http://192.168.x.x:3000`. On HTTPS it works everywhere.

Every path in the app is relative, so it runs correctly from a domain root or
from a subfolder such as `username.github.io/phase-ten/`.

### Netlify Drop — quickest, no account needed to start

```bash
npm run bundle     # writes phase10-site.zip
```

Drag that zip onto <https://app.netlify.com/drop>. You get an HTTPS URL
immediately. Open it in Safari on the phone and Add to Home Screen.

Dragging the `docs` folder itself onto the same page works too.

### GitHub Pages — free and permanent

Use a **new repository**, not the one behind `<you>.github.io`. A project repo
publishes to `https://<you>.github.io/phase-ten/` and leaves a personal site at
`<you>.github.io` completely untouched — they are separate addresses.

```bash
git init && git add . && git commit -m "Phase 10 scorer"
git branch -M main
git remote add origin git@github.com:<you>/phase-ten.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Source: Deploy from a branch →
Branch `main`, folder `/docs` → Save.**

The site is live at `https://<you>.github.io/phase-ten/` a minute or two later.

The app lives in `docs/` because branch-based Pages can only publish from the
repository root or from `/docs` — those are the only two choices GitHub offers.
`docs/.nojekyll` stops Pages running the files through Jekyll.

### Moving your existing scores

Browser storage is per-origin, so games saved under the LAN address do **not**
appear in the app installed from the new HTTPS address. They are two separate
installs. To bring them across: open the old one, **Export backup**, then open
the new one and **Restore from file**.
