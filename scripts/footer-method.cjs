const PDFDocument = require('pdfkit/js/pdfkit.js');
const fs = require('fs');

async function test() {
  const doc = new PDFDocument({
    size: 'A4', layout: 'landscape',
    margin: { top: 30, bottom: 40, left: 20, right: 20 }
  });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const finished = new Promise(r => doc.on('end', () => r(Buffer.concat(chunks))));

  const pw = doc.page.width, ph = doc.page.height;
  const ML = 20, CW = pw - 40;

  // Content
  doc.font('Helvetica').fontSize(12).text('Content', ML, 50);

  // Method 1: Absolute positioning (current approach)
  doc.font('Helvetica').fontSize(7);
  doc.text('Footer method 1 - absolute Y', ML, ph - 28, { width: CW, align: 'center' });

  doc.end();
  await finished;

  const buf = Buffer.concat(chunks);
  const pageObjs = buf.toString().match(/\d+\s+0\s+obj\s*<<[^>]*\/Type\s*\/Page\b[^>]*>>/g) || [];
  console.log('Pages:', pageObjs.length);
}
test().catch(console.error);
