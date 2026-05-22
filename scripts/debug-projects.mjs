import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load .env
const envPath = join(projectRoot, '.env');
const env = {};
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      env[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
  });
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

console.log('=== Debug: Projects query ===');

const { data: projects, error } = await supabase
  .from('projects')
  .select('id, name, email')
  .not('email', 'is', null);

console.log('Query error:', error);
console.log('Raw results:', JSON.stringify(projects, null, 2));

const withEmail = (projects || []).filter(p => p.email && p.email.trim() !== '');
console.log('\nProjects with non-empty email:', withEmail.length);
withEmail.forEach(p => console.log(`  - ${p.name}: ${p.email}`));
