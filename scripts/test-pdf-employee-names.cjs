const PDFDocument = require('pdfkit/js/pdfkit.js');
const fs = require('fs');

console.log('Testing PDF generation with employee name...');

const doc = new PDFDocument({
  size: 'A4',
  margin: { top: 40, bottom: 50, left: 30, right: 30 },
  layout: 'landscape'
});

const chunks = [];
doc.on('data', (c) => chunks.push(c));
doc.on('end', () => {
  fs.writeFileSync('/tmp/test-employee.pdf', Buffer.concat(chunks));
  console.log('PDF saved: /tmp/test-employee.pdf  Size:', Buffer.concat(chunks).length);
  process.exit(0);
});

const pageW = doc.page.width, pageH = doc.page.height;
const left = 30, right = pageW - 30, contentW = right - left;
const PRIMARY = '#1e3a5f', SECONDARY = '#374151', LIGHT = '#f3f4f6', BORDER = '#e5e7eb';

// Header
doc.font('Helvetica-Bold').fontSize(18).fillColor(PRIMARY).text('TEST COMPANY', left, 40);
doc.font('Helvetica').fontSize(9).fillColor(SECONDARY).text('Test Address', left, 58);
doc.font('Helvetica-Bold').fontSize(12).fillColor(PRIMARY)
   .text('PROJECT TIMESHEET REPORT', { align: 'center' })
   .text('Project: TEST PROJECT', { align: 'center' });
doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('Date: 04 May 2026', { align: 'center' });
doc.moveDown(1.5);

// Table
const tableY = doc.y;
const cEmpName = contentW * 0.40;
const cEmpCode = contentW * 0.12;
const cDayType = contentW * 0.18;
const cReg     = contentW * 0.15;
const cOT      = contentW * 0.15;
const rowH     = 20, headH = 24, tableBottom = pageH - 60;

// Header
doc.rect(left, tableY, contentW, headH).fillAndStroke(PRIMARY, PRIMARY);
doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
doc.text('Employee Name', left + 8, tableY + 7, { width: cEmpName - 16 });
doc.text('Emp Code',    left + cEmpName,     tableY + 7, { width: cEmpCode - 8 });
doc.text('Day Type',    left + cEmpName + cEmpCode, tableY + 7, { width: cDayType - 8 });
doc.text('Regular',     left + cEmpName + cEmpCode + cDayType, tableY + 7, { width: cReg - 8, align: 'right' });
doc.text('Overtime',    left + cEmpName + cEmpCode + cDayType + cReg, tableY + 7, { width: cOT - 8, align: 'right' });

let y = tableY + headH + 2;
doc.font('Helvetica').fontSize(9).fillColor(SECONDARY);

// Sample data
const employees = [
  { name: 'Abdul Gani', code: '21', day: 'Working Day', reg: '8.0', ot: '0.0' },
  { name: 'Mohammed Khan', code: '22', day: 'Working Holiday', reg: '6.0', ot: '2.0' },
  { name: 'Rahman Ali', code: '23', day: 'Absent', reg: '0.0', ot: '0.0' },
  { name: 'Very Long Employee Name That Should Be Fully Visible Without Truncation', code: '24', day: 'Working Day', reg: '7.5', ot: '0.5' },
];

for (const emp of employees) {
  if (y + rowH > tableBottom) {
    doc.addPage(); y = 40;
    doc.rect(left, y, contentW, headH).fillAndStroke(PRIMARY, PRIMARY);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
    doc.text('Employee Name', left + 8, y + 7, { width: cEmpName - 16 });
    doc.text('Emp Code',    left + cEmpName,     y + 7, { width: cEmpCode - 8 });
    doc.text('Day Type',    left + cEmpName + cEmpCode, y + 7, { width: cDayType - 8 });
    doc.text('Regular',     left + cEmpName + cEmpCode + cDayType, y + 7, { width: cReg - 8, align: 'right' });
    doc.text('Overtime',    left + cEmpName + cEmpCode + cDayType + cReg, y + 7, { width: cOT - 8, align: 'right' });
    y += headH + 2;
    doc.font('Helvetica').fontSize(9).fillColor(SECONDARY);
  }

  const bg = (Math.floor(y) % 40 < 20) ? LIGHT : '#ffffff';
  doc.rect(left, y, contentW, rowH).fillColor(bg).fill();
  doc.moveTo(left, y + rowH).lineTo(right, y + rowH).lineWidth(0.5).strokeColor(BORDER).stroke();

  doc
    .text(emp.name, left + 8, y + 5, { width: cEmpName - 16 })
    .text(emp.code, left + cEmpName, y + 5, { width: cEmpCode - 8 })
    .text(emp.day, left + cEmpName + cEmpCode, y + 5, { width: cDayType - 8 })
    .fillColor('#111827')
    .text(emp.reg + ' h', left + cEmpName + cEmpCode + cDayType, y + 5, { width: cReg - 8, align: 'right' })
    .text(emp.ot + ' h', left + cEmpName + cEmpCode + cDayType + cReg, y + 5, { width: cOT - 8, align: 'right' })
    .fillColor(SECONDARY);

  y += rowH;
}

// Footer
doc.moveTo(left, pageH - 30).lineTo(right, pageH - 30).lineWidth(0.5).strokeColor(BORDER).stroke();
doc.moveDown(0.3).font('Helvetica').fontSize(8).fillColor('#6b7280')
   .text('This is an automatically generated timesheet report.', { align: 'center' })
   .text('Generated: ' + new Date().toLocaleString('en-GB'), { align: 'center' });

doc.end();
