# ghost-legacy-analytics

Bring your **post-level email analytics back into the Ghost admin** after migrating
to a new Ghost instance (e.g. Ghost(Pro) → self-hosted).

Ghost's import/export moves your content and members, but **not** email engagement —
opens, clicks and signups live in database tables the export doesn't include. So on
the new instance every migrated post shows a wall of `0%`.

This is a tiny, **read-only client-side overlay** that paints your historical numbers
back onto the admin posts list, using the CSV that Ghost itself can export. It changes
no data and is removed by deleting one line.

> ⚠️ **Read the [Caveats](#caveats) first.** This is a pragmatic overlay, not a
> supported feature. It leans on Ghost's current admin markup and is wiped by
> `ghost update` (re-apply with the included script). Treat it as a reference you
> adapt to your setup, not a turnkey product.

<!-- Add your own screenshots:
![Before: migrated posts show 0%](docs/before.png)
![After: historical stats restored](docs/after.png)
-->

## How it works

1. You export **post analytics** from your OLD Ghost as CSV.
2. `build-legacy-analytics.js` converts that CSV into a small JSON lookup keyed by
   post **slug** (slugs survive migration; post IDs don't).
3. You ship that JSON + `legacy-admin-analytics.js` as static theme assets.
4. `inject-admin-overlay.sh` adds one `<script>` line to the admin's `index.html`.
5. In the admin, the script fetches the JSON, maps `post id → slug` via the Admin
   API, and reproduces Ghost's own metric markup on each migrated row — so columns
   align and the native hover tooltips ("Newsletter performance", "New members")
   work for free. Posts genuinely emailed from the new instance are left untouched.

## Requirements

- A self-hosted Ghost where you control the theme and server files (standard
  Ghost-CLI install assumed).
- Node.js (for the build step only — zero dependencies).
- Shell access to the server (for the inject step).

## Setup

### 1. Export the CSV from your old Ghost

Ghost Admin → **Settings → Import/Export → Export post analytics**. Save the CSV.
(See [`example/post-analytics.sample.csv`](example/post-analytics.sample.csv) for the
expected columns.)

### 2. Build the JSON lookup

```bash
node build-legacy-analytics.js post-analytics.2026-05-14.csv legacy-analytics.json
# -> Wrote N posts, skipped M rows without a slug
```

### 3. Ship the two static assets in your active theme

```
<theme>/assets/data/legacy-analytics.json      # the file you just built
<theme>/assets/js/legacy-admin-analytics.js    # from this repo
```

Deploy the theme as you normally would (re-upload the zip, or copy the files up).

### 4. Inject the loader into the admin

On the server:

```bash
bash inject-admin-overlay.sh
# defaults:
#   index  = /var/www/ghost/current/core/built/admin/index.html
#   js     = /var/www/ghost/content/themes/theme/assets/js/legacy-admin-analytics.js
```

Pass custom paths as `bash inject-admin-overlay.sh <admin-index.html> <theme-js-file>`
if your theme folder isn't literally named `theme`.

No restart needed — Ghost serves `index.html` per request. Hard-reload
`/ghost/#/posts` and your migrated posts will show their old open/click rates, the
members count, and the hover breakdowns.

### 5. Re-apply after every Ghost upgrade

`ghost update` rebuilds the admin and wipes the injected tag. Just run
`bash inject-admin-overlay.sh` again (it's idempotent and backs up `index.html`).

## Configuration

- **Asset paths.** The overlay fetches `/assets/data/legacy-analytics.json` and is
  loaded from `/assets/js/legacy-admin-analytics.js`. Change the `JSON_URL` constant
  at the top of `legacy-admin-analytics.js` if you host the data elsewhere (it must
  be same-origin as the admin).
- **Cloudflare Rocket Loader.** The inject script adds `data-cfasync="false"` so
  Rocket Loader doesn't rewrite the tag. Keep it if you're behind Cloudflare.
- **Styling.** Legacy numbers render a hair lighter than native ones so they read as
  imported. Tweak the two rules in `injectStyles()` to taste (or match native).

## Caveats

- **It's an overlay, not real data.** Numbers are painted on by a script; they are
  not in the database and won't appear in Ghost's API, exports, or charts. This is a
  deliberate trade — a reversible cosmetic layer instead of risky DB surgery.
- **Coupled to Ghost's admin markup.** It reuses Ghost's current classes
  (`gh-post-list-metrics`, `gh-post-list-analytics-tooltip`, the fixed 92px columns,
  `data-test-*` attributes). A major admin redesign can break the layout. Tested
  against Ghost 6.x.
- **Wiped by upgrades.** See step 5.
- **Emailed-only posts can't be matched.** Posts whose old URL was `/email/<uuid>/`
  have no public slug to join on, so they're skipped.
- **Light theme.** The styling targets the light admin theme; dark mode falls back to
  native colors.

## Files

| File | What it does |
|------|--------------|
| `build-legacy-analytics.js` | CSV → slug-keyed JSON (zero deps) |
| `legacy-admin-analytics.js` | The admin overlay (served as a theme asset) |
| `inject-admin-overlay.sh`   | Adds/refreshes the `<script>` in admin `index.html` |
| `example/`                  | Sample CSV + the JSON it produces |

## License

[MIT](LICENSE) © Àlex Rodríguez Bacardit
