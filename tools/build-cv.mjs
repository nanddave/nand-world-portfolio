// Writes public/cv.html: a static, semantic, printable one-page resume built from src/content/stops.js.
// Usage: node tools/build-cv.mjs   (runs automatically before `npm run build` and in build:single)
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderReadable } from '../src/content/readable.js';

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nand Dave: résumé</title>
<meta name="description" content="Nand Dave: applied AI engineer and founder of Brokai Labs. Plain, fast résumé view.">
<style>
:root{color-scheme:light}
body{margin:0;background:#fff;color:#1a1c2c;font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 20px 48px}
h1{font-size:34px;line-height:1.1;margin:0}
.role{margin:4px 0 8px;font-size:18px;color:#444a66}
.contact{margin:0 0 6px;font-size:15px}
.sum{margin:0 0 10px;max-width:60ch}
ul{margin:4px 0;padding-left:20px}li{margin:2px 0}
a{color:#1d4ed8}
.trip{display:inline-block;margin:10px 0 4px;padding:8px 14px;border-radius:6px;background:#1a1c2c;color:#fff;text-decoration:none;font-weight:600}
h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#555b78;border-bottom:1px solid #d8dae6;padding-bottom:4px;margin:28px 0 10px}
section.stop{margin:0 0 14px}
h3{font-size:17px;margin:0}
h3 small{font-weight:400;color:#555b78;font-size:14px}
article{margin:10px 0 0}
article h4{margin:0;font-size:16px}
article .m{margin:0;color:#444a66;font-size:14px}
p{margin:4px 0}
footer{margin-top:28px;font-size:13px;color:#555b78}
@media print{.trip,.noprint{display:none}main{padding:0;max-width:none}body{font-size:11.5pt}a{color:inherit;text-decoration:none}h2{margin-top:16px}section.stop,article{break-inside:avoid}}
</style></head>
<body><main>
${renderReadable()}
</main></body></html>
`;
mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/cv.html', import.meta.url), html);
console.log('wrote public/cv.html', html.length, 'bytes');
