import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const input = join(root, 'public', 'share-template.png');
const output = join(root, 'public', 'share-template.png');

const buffer = readFileSync(input);
const result = await sharp(buffer)
  .resize(1200, 630, { fit: 'cover', position: 'center' })
  .png({ compressionLevel: 9 })
  .toBuffer();
writeFileSync(output, result);
console.log('Optimized share-template.png to 1200x630');
