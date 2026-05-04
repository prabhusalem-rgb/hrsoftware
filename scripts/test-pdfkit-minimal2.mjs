import PDFDocument from 'pdfkit';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing pdfkit...');

// Method 1: Try without any fontsDir manipulation
try {
  console.log('\nTest 1: Plain PDFDocument');
  const doc1 = new PDFDocument({ size: 'A4' });
  const chunks = [];
  doc1.on('data', (c) => chunks.push(c));
  doc1.on('end', () => {
    console.log('✓ Test 1 passed! PDF size:', Buffer.concat(chunks).length);
  });
  doc1.fontSize(24).text('Hello World', 100, 100);
  doc1.end();
} catch (e: any) {
  console.error('✗ Test 1 failed:', e.message);
  console.error(e.stack?.substring(0, 300));
}

// Method 2: With fontsDir set on prototype before instantiation
setTimeout(async () => {
  try {
    console.log('\nTest 2: With fontsDir on prototype');
    const pdfkitPath = require.resolve('pdfkit');
    const pdfkitDir = resolve(dirname(pdfkitPath), 'js', 'data');
    console.log('pdfkitDir:', pdfkitDir);
    (PDFDocument as any).prototype.fontsDir = pdfkitDir;

    const doc2 = new PDFDocument({ size: 'A4' });
    const chunks = [];
    doc2.on('data', (c) => chunks.push(c));
    doc2.on('end', () => {
      console.log('✓ Test 2 passed! PDF size:', Buffer.concat(chunks).length);
    });
    doc2.fontSize(24).font('Helvetica').text('Hello World', 100, 100);
    doc2.end();
  } catch (e: any) {
    console.error('✗ Test 2 failed:', e.message);
    console.error(e.stack?.substring(0, 300));
  }
}, 100);
