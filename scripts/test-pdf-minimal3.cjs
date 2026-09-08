const PDFDocument = require('pdfkit/js/pdfkit.js');
const fs = require('fs');

console.log('Minimal PDF test...');

const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
const out = fs.createWriteStream('/tmp/minimal.pdf');
doc.pipe(out);

doc.font('Helvetica').fontSize(24).text('TEST: Abdul Gani Name Here', 50, 100);
doc.text('Line 2: Mohammed Khan', 50, 130);
doc.text('Line 3: Rahman Ali', 50, 160);

doc.end();

out.on('finish', () => {
  console.log('PDF written, size:', fs.statSync('/tmp/minimal.pdf').size);
  // Check if text strings are present (they're compressed in the PDF stream)
  console.log('Checking compressed content...');
  const content = fs.readFileSync('/tmp/minimal.pdf');
  console.log('Contains "Abdul":', content.includes(Buffer.from('Abdul')) ? 'YES' : 'no');
  console.log('Contains "Mohammed":', content.includes(Buffer.from('Mohammed')) ? 'YES' : 'no');
});
