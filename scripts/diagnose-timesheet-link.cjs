/**
 * Diagnostic script to check timesheet_links table
 * Run with: node scripts/diagnose-timesheet-link.cjs
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function diagnose() {
  console.log('=== TIMESHEET LINK DIAGNOSTIC ===\n');

  // Check all timesheet links
  const { data: links, error: linkErr } = await supabase
    .from('timesheet_links')
    .select('*')
    .order('created_at', { ascending: false });

  if (linkErr) {
    console.error('Error fetching links:', linkErr);
    return;
  }

  console.log(`Found ${links?.length || 0} timesheet link(s):\n`);

  if (links && links.length > 0) {
    links.forEach((link, i) => {
      console.log(`[${i + 1}] ID: ${link.id}`);
      console.log(`    Token: ${link.token}`);
      console.log(`    Company ID: ${link.company_id}`);
      console.log(`    Active: ${link.is_active}`);
      console.log(`    Created: ${link.created_at}`);
      console.log(`    Created By: ${link.created_by || 'N/A'}`);
      console.log('');
    });
  } else {
    console.log('No timesheet links found in database!\n');
  }

  // Check companies to verify foreign keys
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name_en, name_ar')
    .in('id', links?.map(l => l.company_id) || []);

  console.log('=== COMPANY VERIFICATION ===\n');
  if (companies) {
    companies.forEach(company => {
      const relatedLinks = links?.filter(l => l.company_id === company.id) || [];
      console.log(`Company: ${company.name_en} (${company.id})`);
      console.log(`  Related links: ${relatedLinks.length}`);
      relatedLinks.forEach(l => {
        console.log(`    - Token: ${l.token.substring(0, 20)}... Active: ${l.is_active}`);
      });
      console.log('');
    });
  }

  // Test token lookup for each active link
  console.log('=== TOKEN LOOKUP TEST ===\n');
  const activeLinks = links?.filter(l => l.is_active) || [];

  for (const link of activeLinks) {
    const { data: found, error: err } = await supabase
      .from('timesheet_links')
      .select('id, token, is_active')
      .eq('token', link.token)
      .maybeSingle();

    if (err) {
      console.error(`Token ${link.token.substring(0, 20)}... - LOOKUP ERROR:`, err.message);
    } else if (!found) {
      console.error(`Token ${link.token.substring(0, 20)}... - NOT FOUND (even though it should exist!)`);
    } else {
      console.log(`Token ${link.token.substring(0, 20)}... - OK (active: ${found.is_active})`);
    }
  }

  console.log('\n=== EXPECTED PUBLIC URLS ===\n');
  if (activeLinks.length > 0) {
    activeLinks.forEach(link => {
      console.log(`Public URL: ${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/timesheet/${link.token}`);
    });
  } else {
    console.log('No active links to generate URLs for.\n');
  }
}

diagnose().catch(console.error);
