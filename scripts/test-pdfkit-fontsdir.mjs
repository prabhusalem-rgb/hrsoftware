import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

console.log('Testing pdfkit with fontsDir manipulation...');

// Simulate what the route does
const pdfkitPath = require.resolve('pdfkit');
console.log('pdfkitPath from require.resolve:', pdfkitPath, 'type:', typeof pdfkitPath);

const pdfkitDir = resolve(dirname(pdfkitPath), 'js', 'data');
console.log('pdfkitDir:', pdfkitDir, 'type:', typeof pdfkitDir);

// This is the problematic line
try {
  PDFDocument.prototype.fontsDir = pdfkitDir;
  console.log('Set fontsDir successfully');
} catch (e) {
  console.error('Failed to set fontsDir:', e.message);
}

const doc = new PDFDocument({ size: 'A4' });
const stream = new PassThrough();

doc.pipe(stream);

let size = 0;
stream.on('data', (chunk) => {
  size += chunk.length;
});

doc.on('end', () => {
  console.log('PDF generated successfully! Size:', size, 'bytes');
  process.exit(0);
});

doc.fontSize(24).font('Helvetica').text('Hello World', 100, 100);
doc.end();

doc.on('error', (err) => {
  console.error('PDF error:', err.message);
  console.error(err.stack?.substring(0, 500));
  process.exit(1);
});
