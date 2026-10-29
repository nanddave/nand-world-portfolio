import { existsSync } from 'node:fs';
export const browserPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || ['/opt/pw-browsers/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
