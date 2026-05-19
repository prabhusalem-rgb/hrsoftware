import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

console.log('Testing basic pdfkit...');

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

doc.fontSize(24).text('Hello World', 100, 100);
doc.end();

doc.on('error', (err) => {
  console.error('PDF error:', err);
  process.exit(1);
});
