const PDFDocument = require('pdfkit/js/pdfkit.js');
const fs = require('fs');

async function test() {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: { top: 35, bottom: 45, left: 25, right: 25 } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const finished = new Promise((r) => doc.on('end', () => r(Buffer.concat(chunks))));

  const pw = doc.page.width, ph = doc.page.height;
  const L = 25, R = pw - 25, cw = R - L;
  let y = 35;

  // Header (simplified)
  doc.font('Helvetica-Bold').fontSize(16).text('COMPANY', L, y); y += 22;
  doc.font('Helvetica').fontSize(8).text('Address', L, y); y += 12;
  doc.text('CR info', L, y); y += 18;
  doc.font('Helvetica-Bold').fontSize(11).text('PROJECT TIMESHEET REPORT', { align: 'center' });
  y += 6;

  // Summary
  doc.rect(L, y, cw, 24).fillAndStroke('#f3f4f6', '#e5e7eb');
  y += 34;

  // Table setup
  const cName = cw * 0.40, cCode = cw * 0.12, cDay = cw * 0.18, cReg = cw * 0.15, cOT = cw * 0.15;
  const rowH = 18, headH = 22, tableBottom = ph - 50;

  const drawHeader = (yp) => {
    doc.rect(L, yp, cw, headH).fillAndStroke('#1e3a5f', '#1e3a5f');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    doc.text('Employee Name', L + 6, yp + 5, { width: cName - 12 });
    doc.text('Emp Code', L + cName, yp + 5, { width: cCode - 6 });
    doc.text('Day Type', L + cName + cCode, yp + 5, { width: cDay - 6 });
    doc.text('Regular', L + cName + cCode + cDay, yp + 5, { width: cReg - 6, align: 'right' });
    doc.text('Overtime', L + cName + cCode + cDay + cReg, yp + 5, { width: cOT - 6, align: 'right' });
  };

  if (y + headH > tableBottom) { doc.addPage(); y = 35; }
  drawHeader(y); y += headH;

  doc.font('Helvetica').fontSize(8).fillColor('#374151');

  // Generate 30 rows to test pagination
  for (let i = 0; i < 30; i++) {
    if (y + rowH > tableBottom) {
      console.log(`Page break before row ${i} at y=${y.toFixed(1)}`);
      doc.addPage(); y = 35;
      drawHeader(y); y += headH;
    }

    const bg = (i % 2 === 0) ? '#f3f4f6' : '#ffffff';
    doc.rect(L, y, cw, rowH).fillColor(bg).fill();
    doc.moveTo(L, y + rowH).lineTo(R, y + rowH).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
    doc.fillColor('#374151');
    doc.text(`Employee Name ${i + 1}`, L + 6, y + 4, { width: cName - 12 });
    y += rowH;
  }

  // Footer
  doc.moveTo(L, ph - 35).lineTo(R, ph - 35).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
  doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
  doc.text('Footer text', L, ph - 22, { width: cw, align: 'center' });
  doc.text('Generated date', L, ph - 12, { width: cw, align: 'center' });

  doc.end();
  await finished;

  const buf = Buffer.concat(chunks);
  const pageCount = (buf.toString().match(/\/Type\s*\/Page/g) || []).length;
  console.log(`Pages: ${pageCount}, Size: ${buf.length} bytes`);
  fs.writeFileSync('/tmp/test-multi.pdf', buf);
}
test().catch(console.error);
