# CLAUDE.md

## Project
HTML test page (prototype) of an in-game lobby for slot games, built from a Figma design. This is the Launchpad v3 prototype. It is a local test page, not a production app.

## Source of truth: Figma
- The Figma design is the source of truth for layout, spacing, typography, colour and assets.
- Use the Figma MCP connection (`figma-desktop` server: `get_design_context`, `get_screenshot`, `get_variable_defs`, `get_metadata`) to read the design. Do not guess values from memory.
- Before calling `get_design_context`, load the `figma:figma-design-to-code` skill.
- `get_design_context` with a screenshot attached hangs/times out on this file. Call it with `excludeScreenshot: true` and take the visual reference from a separate `get_screenshot` call. Large frames come back sparse, so fetch child nodes one section at a time.
- Asset URLs (`http://localhost:3845/assets/...`) only work while Figma desktop is open. Download them into `assets/` and reference local paths.
- Figma image exports are often full source resolution (e.g. 4000px for a 100px tile). Check dimensions after downloading and downscale anything far larger than ~2× its display size. Don't keep the full-size originals (they can be re-exported from Figma).
- Figma output (often React/Tailwind) is a reference only. Translate it into plain HTML/CSS/JS as described below.
- Map Figma variables to CSS custom properties on `:root` (colours, spacing, radii, type scale) instead of hardcoding values.
- When a design detail is ambiguous or missing, ask the user rather than inventing it. Note any deviation from the design in a comment.
- Figma file: **Launchpad v3** is the source of truth from 2026-11-06 — https://www.figma.com/design/2mgT9IbQUUZ95SE1j88e0A/Launchpad-v3?node-id=5908-195947&m=dev (file key `2mgT9IbQUUZ95SE1j88e0A`). Main frame: page "DevReady", "full - promo - raffle" (node `5908:195948`, 402×874 mobile portrait); node ids carried over from v2.
- Launchpad v2 (https://www.figma.com/design/wos5nRuwBuIw7MwJ4GBkZh/Launchpad-v2) is the old file — don't read from or write to it.
- The `figma-desktop` MCP reads whichever file is the active tab in Figma desktop. The online Figma connector (`use_figma`) needs the v3 file key.

## Tech approach
- Plain HTML, CSS and vanilla JS. No framework or build step unless the user asks for one.
- No new dependencies without asking. If one is needed, use the official registry (npm) and flag that it must go through the organisation's vetting process first.
- No CDN scripts or externally hosted assets in the page. Export Figma assets into a local `assets/` folder. Exception (approved by user): Roboto and Inter load from Google Fonts.
- Keep the page runnable by opening `index.html` directly or via a local static server on the user's machine.

## Suggested structure
```
index.html            # lobby page
icons-animation.html  # user-supplied reference for the animated tab icons (not part of the lobby)
css/                  # styles (tokens.css for Figma variables, then component styles)
js/                   # lobby behaviour (lobby.js), animated tab icons (tab-icons.js + tab-icons-svg.js)
assets/               # images/icons exported from Figma
data/                 # mock game list (JSON)
```
Adjust as the project grows, and update this section when it changes.

## Animated tab icons
- Artwork and animations come from `icons-animation.html`; icons not in it have an animation-ready source in `assets/icons/anim-src/` (Free Games; Trophy from Figma Components "Icon_Trophy" 2750:5250, which replaced the medal everywhere). `js/tab-icons-svg.js` is generated from both — ids became `data-part`, `UID-` ids are made unique per instance, colours became `--ico-*` custom properties with the original colour as fallback. Regenerate it rather than hand-editing. `js/tab-icons.js` holds the shared glow/sparkles and each icon's open animation, triggered by `.tab--active` (same scale-up, glow and sparkles for every icon).
- Icon blues, tab outlines and the "Active & Joined" outline follow the operator theme: `--theme-hue-shift` (css/tokens.css, per `.screen[data-theme]`) rotates each blue's OKLCH hue while keeping its lightness/chroma (relative colour syntax, css/lobby.css). Golds and paper are not themed. The ended raffle tab overrides the colours with greys (`.tab--ended`).

## Lobby conventions
- Game data (titles, thumbnails, tags, RTP, etc.) is mocked in local JSON. Do not call real game or backend services.
- Build the lobby from reusable components (game tile, category row, header, filters) that match Figma components one-to-one where possible.
- Card template = the Raffles card's "Main" in Figma (5908:195999): gold title bar with ✕ (`.card-title`, added to every card by js/lobby.js from `data-title`, kept above the collapsing body), banner with a countdown + stats row on top (`.promo-stats`), then main attraction + buttons (`.promo-info`). New promo cards should follow it.
- Launchpad type (`data-lp-type` on `.screen`, `?type=`, default Floating + Small): **Dropdown** = States 0 (Hidden, `?state=hidden`; the ✕ on State 1 hides, the 38×28 chevron-down tab returns to State 1; the 26px reserved space is dropped so the game moves up)/1/2/3; **Floating** (Figma "launchpad Floating" 7181:18029) = `hidden` / `small` / `3` (Full = State 3). Floating has no timers; chevron toggles Small ↔ Hidden, the rest of Small opens Full, ✕ / swipe-up returns to Small. The `.overlay` element morphs into the floating pill; its content is `.overlay__fl`. Small cycles every 4s through one `.fl-slide` per promo card (icon + number copied from the card's `.promo-stats__cell` named in `data-stat`; logo/background follow `data-promo`); tapping opens Full on that card (`lp:show-card` event → tabCards). Prototype "Triggers" → "Grant Ticket" (`grantTicket` in js/lobby.js): Small shows the Raffles summary (opening from Hidden and closing again after), winBG (`.fl-win`, Figma 7188:52199) fades in, gold particles (`.fl-particle`, WAAPI transform/opacity only) fly into the count, which bounces and goes +1 on the summary and the card. In Dropdown the same trigger pops in State 2 (Figma 5908:195968: logo, centred ticket count, raffle icon; winBG `.s2-win`) from Hidden/State 1, particles fly in from both sides, then it returns. State 2 has no timer any more (the old 8s auto-peek is gone); tapping it opens State 3 on the Raffles card. Dropdown State 1 cycles every 4s through one `.s1-msg` per promo card (campaign name + key stat from the card + icon, promo background via `data-promo`; cross-fade; a "Tap or swipe down to open" hint is last in the rotation), same pattern as the Floating summaries; tapping opens State 3 on that card.
- Full view option (`data-s3` on `.screen`, `?s3=deck`): **Tabs** (default, tab bar + side-by-side card list) or **Card stack** (Figma "launchpad state3 - alt01" 7197:5672): no tab bar; the same cards become an endless deck (`data-stack` 0 = top, 1–2 peek out behind under a black cover, rest hidden), swipe left to advance (top card flies out, goes to the back), swipe right for the exact reverse (previous card comes back from the left); dots (`.deck-dots`) show the top card. Driven by `current`/`select()` in tabCards, so `lp:show-card` works in both views.
- Responsive behaviour should follow the Figma breakpoints/frames. Check both desktop and mobile frames if both exist.
- Accessibility basics: semantic elements, alt text, visible focus states, keyboard navigation for tiles.

## Security and compliance (organisation rules)
- Never hardcode API keys, tokens, passwords or connection strings. If any are needed, keep them in a local `.env` file that is excluded via `.gitignore`.
- Do not suggest public or consumer hosting (Netlify, Vercel, GitHub Pages, etc.). Run locally. For wider internal access, contact the AI Engineering team.
- Install software only from official registries. Check with IT before installing anything on a company device.
- If this folder becomes a git repo, commits made with Claude's help must include the trailer `Co-authored-by: Claude <noreply@anthropic.com>`.

## Working with Claude here
- Compare your result with a Figma screenshot (`get_screenshot`) before calling a component done.
- Make small, focused changes. Do not restructure the whole page for a single-component fix.
- Keep comments sparse and match the existing code style once it exists.
- Update this file when conventions, the Figma link or the structure change.

## Open items
- [ ] Confirm target viewports (desktop / mobile / both)
- [ ] Confirm whether a local dev server or plain file open is preferred
