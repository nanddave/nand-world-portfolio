import { readFileSync, writeFileSync } from 'node:fs';
const [task,note,next]=process.argv.slice(2); const path='docs/IMPLEMENTATION-STATUS.md';
let s=readFileSync(path,'utf8'); s=s.replace(`| ${task} | NOT STARTED |`,`| ${task} | COMPLETE |`).replace(/Current task: .*/,`Current task: ${next}`); s+=`\n${task}: ${note}\n`; writeFileSync(path,s);
