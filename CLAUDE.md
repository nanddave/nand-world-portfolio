# Nand's World — working rules

Interactive 3D portfolio: a real Earth for travel, a street-level scene per city, and real in-browser demos ("missions") that show Nand's skills.

## Hard constraints
- **Zero cost.** No paid tools, services, APIs or assets. No Blender, no model downloads, no external 3D files. Everything is procedural three.js geometry, canvas textures and plain JS.
- **No new npm dependencies** without the lead's approval. Allowed: `three` (0.160.0, including `three/examples/jsm/...`). Missions are dependency-free JS.
- **Truth.** Never invent facts about Nand (metrics, titles, dates, stories). Content lives in `src/content/stops.js`. Anything scripted or illustrative is labelled as such in the UI.
- **Runs offline in one file.** `npm run build:single` must produce a working self-contained `dist-single/index.html` (no runtime fetches except Google Fonts).

## Layout and ownership (agents edit ONLY their own files)
| Area | Files | Owner |
|---|---|---|
| Shared kit + city API | `src/kit/*`, `src/content/*`, `src/core/visitor.js`, `src/core/landmask.js`, `src/ui/worklog.js`, `src/styles/tokens.css`, harnesses, `tools/*`, configs | lead |
| App shell + globe | `index.html`, `src/main.js`, `src/core/*` (except visitor/landmask), `src/ui/*` (except worklog.js), `src/styles/app.css` | shell agent |
| Cities | `src/cities/<id>.js` (one file per city) | city agents |
| Missions | `src/missions/<id>.js`, `src/missions/missions.css` | missions agent |

Do not edit files you don't own. If you need a change in a shared file, write the request in your final report instead.
Do not run `git commit`/`git push`; the lead commits.

## Contracts
- City module: `export function build()` returns `newCity(cfg)` from `src/kit/city.js`, filled with geometry. Call `C.spot(x,y,z)` once per spot, **in the same order as that city's `spots` in `src/content/stops.js`**. Put the hero car with `C.hero(x,z,ry)`. Optional extras the app will call if present: `C.raiseLot(name)` (brokai), `C.onEnter()`.
- Mission module: `export function mount(el, ctx)` returns `{ unmount() }`. See `src/missions/index.js` for `ctx`. Log every real step with `ctx.work.step(title, detail, {ms})` — this feeds the "Show your work" panel.
- Visitor personalisation: `import { VISITOR } from '../core/visitor.js'` (`VISITOR.company` or null).

## Scale and style
1 unit ≈ 1 m. Road along x through the origin. Camera orbits the origin at ~60 m. Landmarks should be recognisable from silhouette (use `lathe`, `extrude`, `tube` in `src/kit/kit.js`). Distant landmarks can be large and far (e.g. 150–300 m away) with `mat(color,{fog:false})` so they read through fog. Keep each city under ~2,000 meshes. No brand logos or trademarks text.

## Checking your work (cheap, do it)
- City: `node tools/shot.mjs "/city.html?c=<id>" shots/<id>.png 5000` and with `&yaw=1.2&pitch=0.3`, `&spot=0` etc. Look at the PNG with the Read tool. The info bar shows spot count vs content.
- Mission: `node tools/shot.mjs "/mission.html?m=<id>" shots/m-<id>.png 3000 1440 900 --click "<selector>"`.
- `npx vite build` must pass. Keep screenshots in `shots/` (git-ignored). Two or three looks per item is enough; don't loop.

## Reference
The previous single-file prototype is `source/v2-src.html` (city builders, sound, globe, UI). Reuse freely.

## Phase 1+ contracts
- `C.colliders`: optional array of `{minX,maxX,minZ,maxZ}` (XZ boxes, metres) added to drive collisions. `userData.noCollide = true` on an object (or its parent) excludes it from auto-colliders.
- `C.driveRadius` (default 140), `C.credit` (string shown small in the city HUD, e.g. OSM attribution).
- `src/kit/collide.js`: `autoColliders(C)`, `makeGrid(boxes, cell)`, `overlaps(a,b,m)`, `resolveCircle(grid,x,z,r)`.
- `src/kit/osm.js`: `addOSM(C, data, opts)` renders baked OSM JSON from `src/data/osm/<id>.json` (built by `node tools/osm-bake.mjs <id>` from `data/osm-raw/<id>.json`, which the lead fetches on Nand's Mac).
- `src/core/drive.js`: drive mode (shell-owned). `Sound.horn(cityId)` in `src/core/sound.js`.
