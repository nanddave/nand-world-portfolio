# Nand's World: interactive portfolio

Working folder for the globe-and-cities portfolio idea. Kept separate from everything else in Job_FInder on purpose.

## The idea in one line

A visitor travels a real Earth with a small yellow car (and a plane for the long hops), and at each city drops into a street-level scene of that place. There they find stories from my work and life, small demos to try, and a co-pilot that answers questions by taking them to the right place.

## Route (in the order it happened)

| # | City | Who I was there | Spots in the scene |
|---|------|-----------------|--------------------|
| 1 | Nadiad, Gujarat | Grew up here | The lane, Santram Mandir, the family farm, Uttarayan kites |
| 2 | Bangalore | Bachelor's, then a year at ANA Packaging & Trading (2020–21) | Engineering college, the cup factory (with the cracked-rim demo), the chai stall |
| 3 | Boston | Master's, Northeastern | Campus, first apartment, the Green Line |
| 4 | Irving, Texas | 7-Eleven Data Scientist co-op (Jun–Dec 2022) | The office (with the offer-grouping demo), the store counter, Texas roads |
| 5 | Bellevue | Centific (May 2024–Aug 2025), research | The office, research desk (with the contradiction demo), badminton court |
| 6 | San Francisco | Oaklet (Sep–Oct 2025) | The garage, the view from the hill (with the goal-to-steps demo) |
| 7 | Bangalore, again | Founder, Brokai Labs (Nov 2025–now) | Brokai office (Jarvis demo), the salon (voice call playback), "Your company here" lot |

Travel legs: Nadiad → Bangalore by road, Bangalore → Boston by air, Boston → Irving → Bellevue → San Francisco by road (a real cross-country drive), San Francisco → Bangalore by air. Distances shown during travel are real great-circle distances.

## What makes each city feel like that city

- **Nadiad:** warm dusty morning, painted houses with wooden balconies, the white temple spires with a saffron flag, a cow shed and hay, kites in the sky. Sound: birds and a distant temple bell.
- **Bangalore:** evening rush with the streetlights coming on, green-and-yellow autos, a blue city bus, black-and-yellow curbs, rain trees and gulmohar, a domed government building in the distance. Sound: traffic and horns.
- **Boston:** snowy night, brownstones with bay windows, the Green Line trolley running down the median, a skyline in the distance. Sound: wind and the trolley bell.
- **Irving:** hot bright afternoon, a six-lane highway with pickups and semis, a glass office campus, the town water tower, a fuel stop. Sound: cicadas and highway whoosh.
- **Bellevue:** rain, fir trees, glass towers, the lake and floating bridge, Mount Rainier in the distance. Sound: rain.
- **San Francisco:** golden hour, painted Victorian houses, a cable car, the red bridge over the bay with fog rolling in. Sound: foghorn and cable-car bell.
- **Bangalore, again:** late night, lit tech parks, the Brokai office sign, a neon salon, and an empty lot with a sign that changes to the visitor's company.

## Things the visitor can do

- Drag to look around any city; tap yellow markers to open a spot.
- **Passport:** each city stamps the passport. A full passport ends with a prompt to contact me.
- **Co-pilot:** ask a question ("has he built voice AI?", "what did he study?") and it travels to the city and opens the right spot. Scripted in the prototype.
- **Voice demo:** a short scripted salon call plays with the browser's built-in voice. No live voice backend, so it costs nothing to run. The final version should play a real recording of the actual agent.
- **Empty lot:** the visitor types what their team builds; three blocks rise on the lot and the sign changes to their company.

## Files

- `prototypes/v1-toy-planet.html`: first working preview (small fantasy planet).
- `prototypes/v2-real-world.html`: current preview (real Earth + seven city scenes). Open it in a browser; it loads three.js from a CDN, so it needs an internet connection.
- `source/v2-src.html`: the same page with a `__MASK__` placeholder where the land data goes.
- `tools/make-land-mask.mjs`: builds the land data from Natural Earth (via the `world-atlas` npm package).

## Facts to confirm before anything goes public

- ANA's location: the preview puts the cup factory in Bangalore.
- The two 2025 papers: placed at Bellevue (Centific era). Move them if they came from Northeastern.
- Bachelor's in mechanical engineering: college name and years still missing.
- The family farm in Nadiad: included as a spot; remove it if you'd rather keep it private.
- Dashed boxes in the cards are placeholders for your own stories. Nothing there has been invented.
- `[your email]` placeholders need your real contact.

## What's still prototype quality

- Buildings and vehicles are simple shapes. The final build should use properly modelled, consistent assets (Blender → GLB), real photos on postcards, and a recorded voice call.
- The co-pilot is keyword-based. The real one would be one serverless AI endpoint grounded in a reviewed fact list, with tools to travel and open spots.
- Performance on phones hasn't been tested on a real device.

## Suggested next steps

1. Lock the look of one city (Bangalore is the richest) to final quality, then roll that standard out to the others.
2. Collect your real material: photos for each city, a recording of the salon agent, short stories for the dashed placeholders.
3. Port to a proper project (Next.js + React Three Fiber) once the experience is agreed.
