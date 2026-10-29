# Nand's World: an interactive portfolio

Live site: https://nanddave.life

Nand Dave is an applied AI engineer who builds voice agents and data systems. This site tells his career as a trip: fly a yellow car across a real Earth, drop into seven street-level cities, and try small working demos of the work he did in each one. Recruiters can skip the 3D: "Hiring? 30-second version" opens a one-screen summary, and "Read without 3D" shows the full plain résumé.

## The route

| # | City | Chapter | Try it |
|---|------|---------|--------|
| 1 | Nadiad, Gujarat | Where I grew up: Santram Mandir, the family dairy farm, Uttarayan kites | |
| 2 | Bangalore | Mechanical engineering at PES University, then ANA Packaging & Trading (paper cups) | Find a machine's root cause |
| 3 | Boston | Master's at Northeastern; first time living on my own | Train a model live in the browser |
| 4 | Irving, Texas | Data Scientist co-op at 7-Eleven | Sort 300 messy promotional offers |
| 5 | Bellevue | AI Engineer at Centific; two co-authored papers | Catch a PII leak; watch agents argue |
| 6 | San Francisco | Founding AI/ML engineer at Oaklet | Turn a big goal into steps |
| 7 | Bangalore, again | Founder of Brokai Labs: Jarvis, Hapi, a voice receptionist for a US salon | Try Jarvis; call the salon; sketch a project |

## What's in it

- **Globe travel** over a real Earth, with real great-circle distances.
- **Seven city scenes** built on OpenStreetMap streets, each with its own light, weather and sound.
- **Drive mode**: WASD or arrow keys (touch joystick on phones), H horn, C change car, E open a spot, Esc back to orbit. Four cars drawn in code (yellow coupe by default, luxury sedan, hypercar, off-roader) with spinning, steering wheels, body lean, skid marks and props you can knock over.
- **Autopilot tour**: one button travels the whole route and opens each story for a few seconds; any tap stops it.
- **San Francisco loop**: main street, an east avenue, the Embarcadero waterfront and a west avenue past the Painted Ladies, with the Golden Gate, Salesforce Tower, Transamerica, Coit Tower, the Ferry Building, the Bay Bridge and a self-driving taxi.
- **Nine demos** that run entirely in the browser; each says up front what is real and what is illustrative.
- **Project case studies** for Jarvis, Hapi and the salon receptionist (Menu → Projects).
- **Co-pilot**: ask a question and it takes you to the right place (local search, optional voice input).
- **Passport and postcard**: each city stamps a passport; share a postcard at the end.
- **Your city**: add `?yours=City` to make your own city a bonus stop. `?for=Company` personalises the last lot.
- **Links into the story**: `?stop=sf&spot=0`, `?project=hapi`, `?role=recruiter`, `?role=founder`.
- **Trailer**: `?trailer=1` plays a 60-second trailer (`&v=1` for vertical). Record it with `node tools/record-trailer.mjs`.
- **No-3D fallback**: without WebGL or JavaScript the page shows the full readable résumé.

## Run it

```bash
npm ci
npm run dev
```

Build: `npm run build` (site in `dist/`) or `npm run build:single` (one self-contained `dist-single/index.html`).

## Tests

`npm test` runs every check and prints a pass/fail table. `npm test -- <category>` runs one or more categories:

| Category | What it checks |
|---|---|
| build | Both builds succeed |
| content | Chapter text, project records and the readable résumé match |
| layout | Sheets fit phone and desktop screens, labels never cover controls, accessibility basics |
| driving | Keyboard and touch input, collisions, every spot reachable in every city |
| navigation | City changes, deep links, browser Back/Forward, motion settings |
| demos | All nine demos start, finish and reset |
| world | City scenes and the postcard render without errors |
| fallback | The no-WebGL and no-JavaScript pages |
| launch | Page load on desktop and a throttled phone (FCP, LCP, layout shift, bytes), main flows, tap-target size, share tags and links |

`npm run test:launch` also checks outbound links (LinkedIn, GitHub, papers).

## How it's built

Vite and three.js, plain JavaScript, no framework. Every building, car and landmark is drawn in code; there are no downloaded 3D models. Content lives in `src/content/stops.js`; each city is one file in `src/cities/`, each demo one file in `src/missions/`.

Visits are counted with Vercel Web Analytics (no cookies) on the deployed site.

Data credits: © OpenStreetMap contributors (ODbL); weather by Open-Meteo.com (CC BY 4.0); land outline from Natural Earth.
