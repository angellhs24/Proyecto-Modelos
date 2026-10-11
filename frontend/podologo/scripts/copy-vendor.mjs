// Copia FullCalendar (build global) a js/vendor para servirlo sin CDN ni bundler.
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'js/vendor');
mkdirSync(out, { recursive: true });

for (const file of ['index.global.min.js', 'locales-all.global.min.js']) {
  copyFileSync(resolve(root, 'node_modules/fullcalendar', file), resolve(out, `fullcalendar.${file}`));
  console.log(`vendor: ${file} -> js/vendor/fullcalendar.${file}`);
}
