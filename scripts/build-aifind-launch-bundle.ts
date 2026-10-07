// File-only deterministic build from explicit reviewed input; no database query.
import {readFile} from 'node:fs/promises';
import {buildLaunchBundle} from '../modules/aifind/launch/bundle.ts';
const [file,directory]=process.argv.slice(2);if(!file||!directory)throw Error('Usage: node scripts/build-aifind-launch-bundle.ts <input.json> <new-bundle-directory>');
console.log(JSON.stringify(await buildLaunchBundle(JSON.parse(await readFile(file,'utf8')),directory),null,2));
