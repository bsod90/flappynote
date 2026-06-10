import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureFixtures } from './helpers/generate-audio.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function globalSetup() {
  ensureFixtures(path.resolve(__dirname, '../fixtures/audio'));
}
