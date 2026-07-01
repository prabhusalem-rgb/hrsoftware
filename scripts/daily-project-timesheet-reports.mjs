import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit/js/pdfkit.js';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (value && !process.env[key.trim()]) process.env[key.trim()] = value;
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Generate PDF using PDFKit (same layout/design as API route)
 */
async function generateProjectTimesheetPDF(project, company, targetDate, timesheets) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: { top: 30, bottom: 40, left: 20, right: 20 }
  });
  
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const pw = doc.page.width, ph = doc.page.height;
  const ML = 20, MR = pw - 20, CW = MR - ML;
  const PRIMARY = '#1e3a5f', SECONDARY = '#374151', MUTED = '#6b7280', LIGHT = '#f3f4f6', BORDER = '#e5e7eb';

  // Precise Y tracking
  let y = 30; // top margin

  // ── Header ──────────────────────────────────────────────────────
  const fmtDate = new Date(targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  doc.font('Helvetica-Bold').fontSize(14).fillColor(PRIMARY).text(company.name_en.toUpperCase(), ML, y);
  y += 18;
  doc.font('Helvetica').fontSize(7).fillColor(SECONDARY)
     .text(company.address || 'Address', ML, y).text(`CR: ${company.cr_number || 'N/A'}`, ML, y + 9);
  y += 22;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(PRIMARY)
     .text('PROJECT TIMESHEET REPORT', { align: 'center' })
     .text(`Project: ${project.name} | Date: ${fmtDate}`, { align: 'center' });
  y += 5;

  // ── Summary ─────────────────────────────────────────────────────
  doc.rect(ML, y, CW, 22).fillAndStroke(LIGHT, BORDER);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(PRIMARY);
  doc.text(`Employees: ${timesheets.length}`, ML + 6, y + 6);
  doc.text(`Regular: ${timesheets.reduce((s,t)=>s+t.hours_worked,0).toFixed(1)} h`, ML + 120, y + 6);
  doc.text(`Overtime: ${timesheets.reduce((s,t)=>s+t.overtime_hours,0).toFixed(1)} h`, ML + 240, y + 6);
  y += 28;

  // ── Table ───────────────────────────────────────────────────────
  const cName = CW * 0.40, cCode = CW * 0.12, cDay = CW * 0.18, cReg = CW * 0.15, cOT = CW * 0.15;
  const rowH = 16, headH = 20;
  const tableBottom = ph - 40 - 30; // stop before footer area

  const dayLabels = {
    working_day: 'Working Day',
    working_holiday: 'Working Holiday',
    holiday_overtime: 'Holiday Overtime',
    absent: 'Absent',
    half_day: 'Half Day',
    leave: 'Leave'
  };

  const drawHeader = (yp) => {
    doc.rect(ML, yp, CW, headH).fillAndStroke(PRIMARY, PRIMARY);
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff');
    doc.text('Employee Name', ML + 4, yp + 4, { width: cName - 8 });
    doc.text('Code',    ML + cName,     yp + 4, { width: cCode - 4 });
    doc.text('Day',     ML + cName + cCode, yp + 4, { width: cDay - 4 });
    doc.text('Reg',     ML + cName + cCode + cDay, yp + 4, { width: cReg - 4, align: 'right' });
    doc.text('OT',      ML + cName + cCode + cDay + cReg, yp + 4, { width: cOT - 4, align: 'right' });
  };

  // Page break before header if needed
  if (y + headH > tableBottom) {
    doc.addPage(); y = 30;
  }
  drawHeader(y);
  y += headH;

  doc.font('Helvetica').fontSize(7).fillColor(SECONDARY);

  for (let i = 0; i < timesheets.length; i++) {
    const ts = timesheets[i];

    // Page break BEFORE drawing this row
    if (y + rowH > tableBottom) {
      doc.addPage(); y = 30;
      drawHeader(y); y += headH;
    }

    const name = ts.employees?.name_en || 'Unknown';
    const code = ts.employees?.emp_code || 'N/A';
    const day = dayLabels[ts.day_type] || ts.day_type.replace('_', ' ');
    const reg = ts.hours_worked.toFixed(1) + ' h';
    const ot  = ts.overtime_hours.toFixed(1) + ' h';

    // Row background
    doc.rect(ML, y, CW, rowH).fillColor(i % 2 === 0 ? LIGHT : '#ffffff').fill();
    doc.moveTo(ML, y + rowH).lineTo(MR, y + rowH).lineWidth(0.5).strokeColor(BORDER).stroke();

    // Text
    doc.fillColor(SECONDARY);
    doc.text(name, ML + 4, y + 3, { width: cName - 8 });
    doc.text(code, ML + cName, y + 3, { width: cCode - 4 });
    doc.text(day,  ML + cName + cCode, y + 3, { width: cDay - 4 });
    doc.fillColor('#111827');
    doc.text(reg,  ML + cName + cCode + cDay, y + 3, { width: cReg - 4, align: 'right' });
    doc.text(ot,   ML + cName + cCode + cDay + cReg, y + 3, { width: cOT - 4, align: 'right' });
    doc.fillColor(SECONDARY);

    y += rowH;
  }

  // ── Footer ──────────────────────────────────────────────────────
  const footerLineY = ph - 40;
  doc.moveTo(ML, footerLineY).lineTo(MR, footerLineY).lineWidth(0.5).strokeColor(BORDER).stroke();

  doc.end();
  return finished;
}

/**
 * Send project timesheet report email using Resend
 */
async function sendProjectTimesheetReportEmail(data) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@yourcompany.com';

  if (!apiKey) {
    console.log('[Email] Resend API key not configured. Would send email to:', data.toEmail);
    return;
  }

  const formattedDate = new Date(data.reportDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const subject = `Daily Timesheet Report — ${data.projectName} — ${formattedDate}`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1e293b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; }
          .summary { margin: 20px 0; }
          .summary table { width: 100%; border-collapse: collapse; }
          .summary th, .summary td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
          .summary th { color: #6b7280; font-weight: 600; font-size: 13px; text-transform: uppercase; }
          .footer { background: #f1f5f9; padding: 16px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; text-align: center; }
          .note { font-size: 12px; color: #6b7280; margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0;">Daily Timesheet Report</h2>
          <p style="margin: 4px 0 0; opacity: 0.8;">${data.companyName || 'HR & Payroll System'}</p>
        </div>
        <div class="content">
          <p>Please find attached the daily timesheet summary for the following project:</p>

          <div class="summary">
            <table>
              <tr><th>Project</th><td>${data.projectName}</td></tr>
              <tr><th>Report Date</th><td>${formattedDate}</td></tr>
              <tr><th>Employees</th><td>${data.employeeCount} worker(s)</td></tr>
              <tr><th>Timesheet Entries</th><td>${data.timesheetCount} entry(ies)</td></tr>
              <tr><th>Total Regular Hours</th><td>${data.totalRegularHours.toFixed(1)} hours</td></tr>
              <tr><th>Total Overtime Hours</th><td>${data.totalOvertimeHours.toFixed(1)} hours</td></tr>
            </table>
          </div>

          <div class="note">
            <strong>Note:</strong> This report includes all timesheet entries submitted for the project on ${formattedDate}.
            The attached PDF contains detailed breakdowns for each employee including hours worked, overtime, and reasons.
          </div>

          <p style="margin-top: 20px; font-size: 13px; color: #6b7280;">
            This is an automated notification from the HR & Payroll system.
            For any queries, please contact the HR department.
          </p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} — ${data.companyName || 'HR & Payroll System'}
        </div>
      </body>
    </html>
  `;

  const textBody = `
Daily Timesheet Report — ${data.projectName}

Project: ${data.projectName}
Report Date: ${formattedDate}
Employees: ${data.employeeCount}
Timesheet Entries: ${data.timesheetCount}
Total Regular Hours: ${data.totalRegularHours.toFixed(1)} hours
Total Overtime Hours: ${data.totalOvertimeHours.toFixed(1)} hours

The detailed timesheet report is attached as a PDF.

---
This is an automated notification from the HR & Payroll system.
  `;

  const pdfBase64 = data.pdfBuffer.toString('base64');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: data.toEmail ? [data.toEmail] : ['hr@company.com'],
      subject,
      html: htmlBody,
      text: textBody,
      attachments: [
        {
          filename: `timesheet-report-${data.projectName.replace(/\s+/g, '-').toLowerCase()}-${data.reportDate}.pdf`,
          content: pdfBase64,
          type: 'application/pdf',
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Email] Failed to send project timesheet report:', response.status, errorData);
    throw new Error(`Resend API failed: ${response.status} ${JSON.stringify(errorData)}`);
  } else {
    console.log('[Email] Project timesheet report sent to:', data.toEmail || 'hr@company.com', '| Project:', data.projectName);
  }
}

/**
 * Main function to send daily project timesheet reports
 * @param {string} targetDate - Date in YYYY-MM-DD format, defaults to today
 */
async function sendDailyProjectTimesheetReports(targetDate) {
  const reportDate = targetDate || new Date().toISOString().split('T')[0];
  console.log(`\n=== Daily Project Timesheet Report - ${reportDate} ===\n`);

  try {
    // Step 1: Fetch all projects that have an email address
    console.log('1. Fetching projects with email addresses...');
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, company_id, name, description, email')
      .not('email', 'is', null);

    if (projectsError) {
      throw new Error(`Failed to fetch projects: ${projectsError.message}`);
    }

    const projectsWithEmail = (projects || []).filter(p => p.email && p.email.trim() !== '');
    console.log(`   Found ${projectsWithEmail.length} project(s) with email addresses\n`);

    if (projectsWithEmail.length === 0) {
      console.log('No projects with email addresses found. Exiting.');
      return { sent: 0, skipped: 0 };
    }

    // Group projects by company to minimize queries
    const projectsByCompany = new Map();
    for (const project of projectsWithEmail) {
      if (!projectsByCompany.has(project.company_id)) {
        projectsByCompany.set(project.company_id, []);
      }
      projectsByCompany.get(project.company_id).push(project);
    }

    // Step 2: For each company, fetch company data and timesheets
    console.log('2. Fetching timesheet data...\n');

    let totalSent = 0;
    let totalSkipped = 0;

    for (const [companyId, companyProjects] of projectsByCompany.entries()) {
      // Fetch company details
      const { data: company } = await supabase
        .from('companies')
        .select('id, name_en, address, cr_number, contact_phone')
        .eq('id', companyId)
        .single();

      if (!company) {
        console.log(`   ⚠ Company not found for ID: ${companyId}, skipping...`);
        continue;
      }

      console.log(`   Processing company: ${company.name_en}`);
      console.log(`   Projects: ${companyProjects.map(p => p.name).join(', ')}`);

      // Fetch timesheets for all projects on the report date
      const projectIds = companyProjects.map(p => p.id);
      const { data: timesheets, error: timesheetsError } = await supabase
        .from('timesheets')
        .select(`
          id,
          company_id,
          employee_id,
          project_id,
          date,
          day_type,
          hours_worked,
          overtime_hours,
          reason,
          created_at,
          employees!inner (
            id,
            name_en,
            emp_code
          )
        `)
        .eq('date', reportDate)
        .in('project_id', projectIds)
        .order('employee_id');

      if (timesheetsError) {
        console.error(`   Error fetching timesheets: ${timesheetsError.message}`);
        continue;
      }

      // Group timesheets by project
      const timesheetsByProject = new Map();
      for (const ts of (timesheets || [])) {
        const projectId = ts.project_id;
        if (!timesheetsByProject.has(projectId)) {
          timesheetsByProject.set(projectId, []);
        }
        timesheetsByProject.get(projectId).push(ts);
      }

      // Process each project
      for (const project of companyProjects) {
        const projectTimesheets = timesheetsByProject.get(project.id) || [];

        console.log(`\n   Project: ${project.name}`);
        console.log(`     Timesheets: ${projectTimesheets.length} entry(ies)`);

        if (projectTimesheets.length === 0) {
          console.log(`     No timesheets to report, skipping email.`);
          totalSkipped++;
          continue;
        }

        try {
          // Generate PDF using PDFKit
          console.log(`     Generating PDF...`);
          const pdfBuffer = await generateProjectTimesheetPDF(
            project,
            company,
            reportDate,
            projectTimesheets
          );

          // Calculate totals
          const totalRegularHours = projectTimesheets.reduce((sum, t) => sum + Number(t.hours_worked || 0), 0);
          const totalOvertimeHours = projectTimesheets.reduce((sum, t) => sum + Number(t.overtime_hours || 0), 0);

          // Send email
          console.log(`     Sending email to ${project.email}...`);
          await sendProjectTimesheetReportEmail({
            projectName: project.name,
            reportDate,
            timesheetCount: projectTimesheets.length,
            totalRegularHours,
            totalOvertimeHours,
            employeeCount: projectTimesheets.length,
            pdfBuffer,
            companyName: company.name_en,
            toEmail: project.email,
          });

          // Update database status
          await supabase.from('projects').update({
            email_status: 'sent',
            email_sent_at: new Date().toISOString(),
            email_error: null
          }).eq('id', project.id);

          console.log(`     ✓ Email sent successfully`);
          totalSent++;
        } catch (err) {
          console.error(`     ✗ Error processing project ${project.name}:`, err);
          const errorMessage = err instanceof Error ? err.message : String(err);
          // Update database failure status
          await supabase.from('projects').update({
            email_status: 'failed',
            email_error: errorMessage
          }).eq('id', project.id);
        }
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total emails sent: ${totalSent}`);
    console.log(`Projects skipped (no timesheets): ${totalSkipped}`);
    console.log(`Date: ${reportDate}`);
    console.log(`================\n`);

    return { sent: totalSent, skipped: totalSkipped };

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const targetDate = args[0]; // Optional: YYYY-MM-DD format

// Run the script
sendDailyProjectTimesheetReports(targetDate).then(result => {
  if (result) {
    console.log(`\nCompleted: ${result.sent} emails sent, ${result.skipped} skipped`);
  }
}).catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
