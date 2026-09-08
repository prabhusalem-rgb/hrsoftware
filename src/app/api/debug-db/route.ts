import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

// TEMP: Public access for debugging
export async function GET() {
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Admin client not available', env: { url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0,30), hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY } }, { status: 500 });
  }

  const { data: links, error: linkErr } = await supabase
    .from('timesheet_links')
    .select('*');

  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .limit(3);

  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('id, name_en')
    .limit(3);

  const { data: migrations, error: migErr } = await supabase
    .from('migration_log')
    .select('*')
    .order('migration_name');

  return NextResponse.json({
    timesheet_links: { count: links?.length ?? 0, rows: links, error: linkErr?.message },
    profiles: { count: profiles?.length ?? 0, rows: profiles, error: profErr?.message },
    companies: { count: companies?.length ?? 0, rows: companies, error: compErr?.message },
    migration_log: { count: migrations?.length ?? 0, rows: migrations, error: migErr?.message },
    env: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 40),
      keyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 30),
      keyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length,
    }
  });
}
