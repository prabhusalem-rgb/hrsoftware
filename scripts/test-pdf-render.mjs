import { renderToBuffer } from '@react-pdf/renderer';
import { ProjectTimesheetReportPDF } from './src/components/timesheet/ProjectTimesheetReportPDF';

// Minimal test data matching what the API passes
const testData = {
  project: {
    id: '973714e0-4388-4c92-942c-6c3aea9fe88a',
    name: 'THE ROYAL OFFICE PROJECT',
    description: '',
  },
  company: {
    name_en: 'BRIGHT FLOWERS TRADING LLC',
    address: 'Muscat',
    cr_number: '1156761',
    contact_phone: '95286499',
  },
  date: '2026-05-04',
  timesheets: [
    {
      id: 'bc948209-5517-4076-b731-8695647cc847',
      date: '2026-05-04',
      day_type: 'working_day',
      hours_worked: 8,
      overtime_hours: 0,
      reason: '',
      employees: {
        id: 'some-id',
        name_en: 'Abdul Gani',
        emp_code: '21',
      }
    }
  ]
};

console.log('Rendering PDF with test data...');
try {
  const buffer = await renderToBuffer(
    <ProjectTimesheetReportPDF
      project={testData.project}
      company={testData.company}
      date={testData.date}
      timesheets={testData.timesheets}
    />
  );
  console.log('✓ PDF rendered successfully!');
  console.log('Buffer size:', buffer.length, 'bytes');
  console.log('First 10 bytes:', buffer.slice(0, 10));
} catch (err: any) {
  console.error('✗ Error:', err.message);
  console.error('Stack:', err.stack);
}
