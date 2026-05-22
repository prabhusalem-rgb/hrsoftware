import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('__dirname:', __dirname);

try {
  const pdfkitPath = require.resolve('pdfkit');
  console.log('pdfkitPath:', pdfkitPath);
  console.log('pdfkitPath type:', typeof pdfkitPath);

  const pdfkitDir = resolve(dirname(pdfkitPath), 'js', 'data');
  console.log('pdfkitDir:', pdfkitDir);
  console.log('pdfkitDir type:', typeof pdfkitDir);

  console.log('pdfkitDir exists:', existsSync(pdfkitDir));
} catch (e) {
  console.error('Error:', e);
}
