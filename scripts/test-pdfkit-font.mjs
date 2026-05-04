import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

console.log('Testing pdfkit with Helvetica font...');

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
