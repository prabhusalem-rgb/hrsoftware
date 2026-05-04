import { createClient } from '@supabase/supabase-js';
import { renderToBuffer, createElement } from '@react-pdf/renderer';
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
 * Build the PDF document using createElement (no JSX)
 */
function buildProjectTimesheetPDF(project, company, date, timesheets) {
  const { ProjectTimesheetReportPDF } = require('@/components/timesheet/ProjectTimesheetReportPDF');

  // Use createElement to avoid JSX parsing issues
  return createElement(ProjectTimesheetReportPDF, {
    project: {
      id: project.id,
      name: project.name,
      description: project.description || '',
    },
    company: {
      id: company.id,
      name_en: company.name_en,
      address: company.address || '',
      cr_number: company.cr_number || '',
      contact_phone: company.contact_phone || '',
    },
    date: date,
    timesheets: timesheets,
  });
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

    // Dynamically import email function
    const { sendProjectTimesheetReportEmail } = await import('@/lib/utils/email.js', {
      assert: { type: 'json' }
    });

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
          // Generate PDF using renderToBuffer with createElement
          console.log(`     Generating PDF...`);

          // Build React element without JSX
          const pdfElement = buildProjectTimesheetPDF(
            project,
            company,
            reportDate,
            projectTimesheets
          );

          const buffer = await renderToBuffer(pdfElement);

          // Convert to Buffer for email attachment
          const pdfBuffer = Buffer.from(buffer);

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

          console.log(`     ✓ Email sent successfully`);
          totalSent++;
        } catch (err) {
          console.error(`     ✗ Error processing project ${project.name}:`, err);
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
