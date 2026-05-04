import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
const PDFDocument = require('pdfkit/js/pdfkit.js');
import { sendProjectTimesheetReportEmail } from '@/lib/utils/email';

interface TimesheetEntry {
  id: string; date: string; day_type: string; hours_worked: number;
  overtime_hours: number; reason: string;
  employees: { name_en: string; emp_code: string };
}
interface ProjectData { id: string; name: string; description: string; email: string; company_id: string; }
interface CompanyData { name_en: string; address: string; cr_number: string; contact_phone: string; }

async function generateProjectTimesheetPDF(
  project: ProjectData, company: CompanyData, targetDate: string, timesheets: TimesheetEntry[]
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4', layout: 'landscape',
    margin: { top: 30, bottom: 40, left: 20, right: 20 }
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const finished = new Promise<Buffer>((r, rej) => {
    doc.on('end', () => r(Buffer.concat(chunks)));
    doc.on('error', rej);
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
  const rowH = 16, headH = 20, usableHeight = ph - 40 - 30; // bottom margin 40, footer ~30
  const tableBottom = ph - 40 - 30; // stop before footer area

  const dayLabels: Record<string, string> = {
    working_day: 'Working Day', working_holiday: 'Working Holiday',
    absent: 'Absent', half_day: 'Half Day', leave: 'Leave'
  };

  const drawHeader = (yp: number) => {
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

    const name = ts.employees.name_en || 'Unknown';
    const code = ts.employees.emp_code || 'N/A';
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
  // Separator line at bottom of content area
  const footerLineY = ph - 40;
  doc.moveTo(ML, footerLineY).lineTo(MR, footerLineY).lineWidth(0.5).strokeColor(BORDER).stroke();

  doc.end();
  return finished;
}

export async function POST(req: NextRequest) {
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: 'Admin client not available' }, { status: 500 });

  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET_TOKEN;
  if (secret && (!auth || auth !== `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized - invalid cron token' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
  const specificProjectId = searchParams.get('project_id');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
  }

  console.log(`\n=== Daily Project Timesheet Report ===\nDate: ${targetDate}\n`);

  try {
    let q = supabase.from('projects').select(`id, company_id, name, description, email`).not('email', 'is', null);
    if (specificProjectId) q = q.eq('id', specificProjectId);
    const { data: projects, error: projectsError } = await q;
    if (projectsError) throw new Error(`Failed to fetch projects: ${projectsError.message}`);

    const projectsWithEmail = (projects || []).filter((p: any) => p.email && p.email.trim() !== '');
    console.log(`Found ${projectsWithEmail.length} project(s) with email\n`);

    if (projectsWithEmail.length === 0) {
      return NextResponse.json({ success: true, message: 'No projects with email addresses found', date: targetDate, sent: 0, skipped: 0 });
    }

    const projectsByCompany = new Map<string, ProjectData[]>();
    for (const p of projectsWithEmail) {
      if (!projectsByCompany.has(p.company_id)) projectsByCompany.set(p.company_id, []);
      projectsByCompany.get(p.company_id)!.push(p as ProjectData);
    }

    let totalSent = 0, totalSkipped = 0;
    const errors: Array<{project: string; message: string}> = [];

    for (const [companyId, companyProjects] of projectsByCompany.entries()) {
      const { data: company } = await supabase.from('companies')
        .select('id, name_en, address, cr_number, contact_phone').eq('id', companyId).single();
      if (!company) { console.log(`Company not found: ${companyId}, skipping`); continue; }

      console.log(`Company: ${company.name_en}  Projects: ${companyProjects.map(p => p.name).join(', ')}`);

      const projectIds = companyProjects.map(p => p.id);
      const { data: timesheets, error: tsError } = await supabase.from('timesheets')
        .select(`id, company_id, employee_id, project_id, date, day_type, hours_worked, overtime_hours, reason, employees!inner (id, name_en, emp_code)`)
        .eq('date', targetDate).in('project_id', projectIds).order('employee_id');

      if (tsError) { console.error(`Timesheet fetch error: ${tsError.message}`); continue; }

      const timesheetsByProject = new Map<string, typeof timesheets>();
      for (const ts of (timesheets || [])) {
        const pid = ts.project_id;
        if (!timesheetsByProject.has(pid)) timesheetsByProject.set(pid, []);
        timesheetsByProject.get(pid)!.push(ts);
      }

      for (const project of companyProjects) {
        const raw = timesheetsByProject.get(project.id) || [];
        const projectTimesheets: TimesheetEntry[] = raw.map(ts => {
          const emp = Array.isArray(ts.employees) ? ts.employees[0] : ts.employees;
          return {
            id: ts.id, date: ts.date, day_type: ts.day_type,
            hours_worked: Number(ts.hours_worked || 0),
            overtime_hours: Number(ts.overtime_hours || 0),
            reason: ts.reason || '',
            employees: { name_en: emp?.name_en || 'Unknown', emp_code: emp?.emp_code || 'N/A' },
          };
        });

        console.log(`  Project: ${project.name} — ${projectTimesheets.length} timesheet(s)`);
        for (const t of projectTimesheets) {
          console.log(`    → "${t.employees.name_en}" (${t.employees.emp_code})`);
        }

        if (projectTimesheets.length === 0) { totalSkipped++; continue; }

        const simpleCompany: CompanyData = {
          name_en: company.name_en || 'Company', address: company.address || '',
          cr_number: company.cr_number || '', contact_phone: company.contact_phone || '',
        };

        try {
          console.log(`    Generating PDF...`);
          const pdfBuffer = await generateProjectTimesheetPDF(project as ProjectData, simpleCompany, targetDate, projectTimesheets);
          console.log(`    PDF size: ${pdfBuffer.length} bytes`);

          const totalReg = projectTimesheets.reduce((s, t) => s + t.hours_worked, 0);
          const totalOT  = projectTimesheets.reduce((s, t) => s + t.overtime_hours, 0);

          console.log(`    Sending email to ${project.email}...`);
          await sendProjectTimesheetReportEmail({
            projectName: project.name, reportDate: targetDate,
            timesheetCount: projectTimesheets.length,
            totalRegularHours: totalReg, totalOvertimeHours: totalOT,
            employeeCount: projectTimesheets.length, pdfBuffer,
            companyName: simpleCompany.name_en, toEmail: project.email!,
          });

          console.log(`    ✓ Email sent`);
          totalSent++;
        } catch (err: any) {
          console.error(`    ✗ Error: ${err.message}`);
          errors.push({ project: project.name, message: err.message });
        }
      }
    }

    return NextResponse.json({
      success: true, message: 'Daily project timesheet reports processed',
      date: targetDate, sent: totalSent, skipped: totalSkipped,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 200 });

  } catch (error) {
    console.error('Fatal error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}