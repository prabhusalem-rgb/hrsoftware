const PDFDocument = require('pdfkit/js/pdfkit.js');
const fs = require('fs');

// Simulate the generate function with test data
async function testPDF() {
  const doc = new PDFDocument({
    size: 'A4', layout: 'landscape',
    margin: { top: 35, bottom: 45, left: 25, right: 25 }
  });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const finished = new Promise((r) => doc.on('end', () => r(Buffer.concat(chunks))));

  const pw = doc.page.width, ph = doc.page.height;
  const L = 25, R = pw - 25, cw = R - L;
  let y = 35;

  // Header
  doc.font('Helvetica-Bold').fontSize(16).text('TEST COMPANY', L, y);
  y += 22;
  doc.font('Helvetica').fontSize(8).text('Address', L, y);
  y += 12;
  doc.text('CR info', L, y);
  y += 18;
  doc.font('Helvetica-Bold').fontSize(11).text('PROJECT TIMESHEET REPORT', { align: 'center' });
  doc.font('Helvetica').fontSize(9).text('Date: 04 May 2026', { align: 'center' });
  y += 6;

  // Summary
  doc.rect(L, y, cw, 24).fillAndStroke('#f3f4f6', '#e5e7eb');
  doc.font('Helvetica-Bold').fontSize(9).text(`Total Employees : 1`, L + 8, y + 6);
  y += 34;

  // Table header
  const headH = 22, rowH = 18, tableBottom = ph - 50;
  const cName = cw * 0.40, cCode = cw * 0.12, cDay = cw * 0.18, cReg = cw * 0.15, cOT = cw * 0.15;

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
  drawHeader(y);
  y += headH;

  // 1 row
  doc.font('Helvetica').fontSize(8).fillColor('#374151');
  doc.rect(L, y, cw, rowH).fillColor('#f3f4f6').fill();
  doc.moveTo(L, y + rowH).lineTo(R, y + rowH).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
  doc.fillColor('#374151');
  doc.text('Abdul Gani', L + 6, y + 4, { width: cName - 12 });
  y += rowH;

  // Footer
  const footerY = ph - 35;
  doc.moveTo(L, footerY).lineTo(R, footerY).lineWidth(0.5).strokeColor('#e5e7eb').stroke();
  doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
  doc.text('Report footer', L, ph - 22, { width: cw, align: 'center' });
  doc.text('Generated: ' + new Date().toLocaleString('en-GB'), L, ph - 12, { width: cw, align: 'center' });

  doc.end();
  await finished;

  // Count pages by scanning for "Page" references in PDF objects
  const content = chunks.join('');
  const pageMatches = content.toString().match(/\/Type\s*\/Page/g);
  console.log('Number of pages in PDF:', pageMatches ? pageMatches.length : 0);
  console.log('Total size:', Buffer.concat(chunks).length, 'bytes');
  fs.writeFileSync('/tmp/test-no-blank.pdf', Buffer.concat(chunks));
  console.log('Saved to /tmp/test-no-blank.pdf');
}

testPDF().catch(console.error);
