/**
 * Check for token formatting issues
 */
require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function checkTokens() {
  const { data: links } = await supabase
    .from('timesheet_links')
    .select('token, is_active')
    .order('created_at', { ascending: false });

  console.log('=== TOKEN FORMAT CHECK ===\n');

  if (!links) {
    console.log('No links found');
    return;
  }

  links.forEach(link => {
    const token = link.token;
    console.log(`Token: "${token}"`);
    console.log(`  Length: ${token.length}`);
    console.log(`  Has leading/trailing whitespace: ${token !== token.trim()}`);
    console.log(`  is_active: ${link.is_active}`);

    // Check for URL-safe characters
    const needsEncoding = /[ /?#]/.test(token);
    if (needsEncoding) {
      console.log(`  WARNING: Token contains characters that need URL encoding!`);
    }
    console.log('');
  });

  // Test exact token match for active token
  const activeLink = links.find(l => l.is_active);
  if (activeLink) {
    console.log('=== EXACT MATCH TEST ===\n');
    const token = activeLink.token;

    // Test 1: exact match
    const { data: exact } = await supabase
      .from('timesheet_links')
      .select('id')
      .eq('token', token)
      .maybeSingle();
    console.log(`Exact match: ${exact ? 'FOUND' : 'NOT FOUND'}`);

    // Test 2: with extra whitespace (should NOT match)
    const { data: withSpace } = await supabase
      .from('timesheet_links')
      .select('id')
      .eq('token', token + ' ')
      .maybeSingle();
    console.log(`With trailing space: ${withSpace ? 'FOUND (BUG!)' : 'NOT FOUND (correct)'}`);

    // Test 3: case sensitivity
    const { data: caseDiff } = await supabase
      .from('timesheet_links')
      .select('id')
      .eq('token', token.toUpperCase())
      .maybeSingle();
    console.log(`Uppercase: ${caseDiff ? 'FOUND' : 'NOT FOUND'}`);
  }
}

checkTokens().catch(console.error);
