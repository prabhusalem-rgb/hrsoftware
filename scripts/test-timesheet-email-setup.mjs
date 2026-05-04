/**
 * Quick test script - verifies all prerequisites are met
 * Run: node scripts/test-timesheet-email-setup.mjs
 */

import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

// Load .env
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runTests() {
  console.log('=== Prerequisite Checks ===\n');

  // 1. Check projects table
  console.log('1. Checking projects table schema...');
  try {
    const { data: col } = await supabase
      .from('projects')
      .select('*')
      .limit(1);
    console.log('   ✓ Projects table accessible');
  } catch (e) {
    console.error('   ✗ Error accessing projects:', e.message);
    return;
  }

  // 2. Check for projects with email
  console.log('\n2. Checking for projects with email addresses...');
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, name, email')
    .not('email', 'is', null);

  if (projErr) {
    console.error('   ✗ Error:', projErr.message);
    return;
  }

  const withEmail = (projects || []).filter(p => p.email && p.email.trim() !== '');
  console.log(`   Found ${withEmail.length} project(s) with email`);

  if (withEmail.length === 0) {
    console.log('   ⚠ No projects with email. Add an email to a project first!');
    console.log('   Example SQL: UPDATE projects SET email = "you@example.com" WHERE id = "uuid";');
  } else {
    console.log('   Projects with email:');
    withEmail.forEach(p => console.log(`   - ${p.name}: ${p.email}`));
  }

  // 3. Check for today's timesheets
  console.log('\n3. Checking for today\'s timesheets...');
  const today = new Date().toISOString().split('T')[0];
  const { count, error: countErr } = await supabase
    .from('timesheets')
    .select('*', { count: 'exact', head: true })
    .eq('date', today);

  if (countErr) {
    console.error('   ✗ Error:', countErr.message);
    return;
  }

  console.log(`   Timesheets for today (${today}): ${count || 0}`);

  if ((count || 0) === 0) {
    console.log('   ⚠ No timesheets for today. Reports will be empty!');
    console.log('   Create a timesheet via UI or SQL.');
  }

  // 4. Check Resend API key
  console.log('\n4. Checking Resend configuration...');
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !resendKey.startsWith('re_')) {
    console.log('   ⚠ RESEND_API_KEY not set or invalid in .env');
  } else {
    console.log('   ✓ RESEND_API_KEY configured');
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    console.log('   ⚠ RESEND_FROM_EMAIL not set');
  } else {
    console.log(`   ✓ RESEND_FROM_EMAIL = ${fromEmail}`);
  }

  // 5. Summary
  console.log('\n=== Summary ===');
  const ready = withEmail.length > 0 && (count || 0) > 0;
  console.log(`Ready to send reports: ${ready ? 'YES ✓' : 'NO ✗'}`);
  console.log('\nNext steps:');
  if (withEmail.length === 0) {
    console.log('1. Add email to a project (via UI or SQL)');
  }
  if ((count || 0) === 0) {
    console.log('2. Create a timesheet for today');
  }
  console.log('3. Run: curl -X POST "http://localhost:3000/api/timesheet/projects/daily-report" -H "Authorization: Bearer YOUR_TOKEN"');
  console.log('4. Check your email inbox!\n');
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
