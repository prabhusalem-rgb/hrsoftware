const path = require('path');
const PDFDocument = require('pdfkit');

const __dirname = path.dirname(process.argv[1]);
const pdfkitDir = path.join(__dirname, '..', 'node_modules', 'pdfkit', 'js', 'data');
console.log('pdfkitDir:', pdfkitDir);

const doc = new PDFDocument({ size: 'A4', margin: 30 });
const chunks = [];

doc.on('data', (chunk) => chunks.push(chunk));
doc.on('end', () => {
  console.log('PDF generated, size:', Buffer.concat(chunks).length, 'bytes');
});

// Register a couple fonts
const fontMap = {
  'Helvetica': 'Helvetica.afm',
  'Helvetica-Bold': 'Helvetica-Bold.afm',
};
for (const [name, file] of Object.entries(fontMap)) {
  const fontPath = path.join(pdfkitDir, file);
  console.log(`Registering ${name} from ${fontPath}`);
  try {
    doc.registerFont(name, fontPath);
  } catch (e) {
    console.error(`Failed:`, e.message);
  }
}

// Simple content
doc.fontSize(16).font('Helvetica-Bold').text('Test PDF', { align: 'center' });
doc.fontSize(12).text('Hello World');
doc.end();
