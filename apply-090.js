const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()]; })
);

const sql = `CREATE OR REPLACE FUNCTION hold_loan_installments(
  p_loan_id UUID,
  p_installment_numbers INTEGER[],
  p_reason TEXT,
  p_hold_months INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_installment_no INTEGER;
BEGIN
  v_user_id := auth.uid();
  SELECT company_id INTO v_company_id FROM loans WHERE id = p_loan_id;

  FOR v_installment_no IN SELECT unnest(p_installment_numbers)
  LOOP
    UPDATE loan_schedule
    SET is_held = TRUE, hold_reason = p_reason, hold_months = p_hold_months,
        held_by = v_user_id, held_at = NOW(), updated_at = NOW()
    WHERE loan_id = p_loan_id AND installment_no = v_installment_no
      AND status IN ('pending', 'scheduled');
  END LOOP;

  INSERT INTO loan_history (loan_id, company_id, action, field_name, old_value, new_value, changed_by, change_reason)
  SELECT ls.loan_id, v_company_id, 'installment_held', 'is_held',
    jsonb_build_object('is_held', ls.is_held, 'hold_reason', ls.hold_reason, 'hold_months', ls.hold_months),
    jsonb_build_object('is_held', TRUE, 'hold_reason', p_reason, 'hold_months', p_hold_months, 'held_by', v_user_id, 'held_at', NOW()),
    v_user_id, p_reason
  FROM loan_schedule ls
  WHERE ls.loan_id = p_loan_id AND ls.installment_no = ANY(p_installment_numbers)
    AND ls.status IN ('pending', 'scheduled')
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION unhold_loan_installments(
  p_loan_id UUID,
  p_installment_numbers INTEGER[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_installment_no INTEGER;
BEGIN
  v_user_id := auth.uid();
  SELECT company_id INTO v_company_id FROM loans WHERE id = p_loan_id;

  FOR v_installment_no IN SELECT unnest(p_installment_numbers)
  LOOP
    UPDATE loan_schedule
    SET is_held = FALSE, hold_reason = NULL, hold_months = NULL,
        held_by = NULL, held_at = NULL, updated_at = NOW()
    WHERE loan_id = p_loan_id AND installment_no = v_installment_no
      AND is_held = TRUE;
  END LOOP;

  INSERT INTO loan_history (loan_id, company_id, action, field_name, old_value, new_value, changed_by, change_reason)
  SELECT ls.loan_id, v_company_id, 'installment_unheld', 'is_held',
    jsonb_build_object('is_held', ls.is_held, 'hold_reason', ls.hold_reason, 'hold_months', ls.hold_months),
    jsonb_build_object('is_held', FALSE, 'hold_reason', NULL, 'hold_months', NULL, 'held_by', NULL, 'held_at', NULL),
    v_user_id, 'Hold removed'
  FROM loan_schedule ls
  WHERE ls.loan_id = p_loan_id AND ls.installment_no = ANY(p_installment_numbers)
    AND ls.is_held = TRUE
  ON CONFLICT DO NOTHING;
END;
$$;`;

async function run() {
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  try {
    // Try exec_sql RPC
    const { error } = await sb.rpc('exec_sql', { sql });
    if (!error) { console.log('✅ Functions created!'); return; }
  } catch (e) {}
  console.log('Manual SQL required. Copy and run in Supabase Dashboard > SQL Editor:');
  console.log('---');
  console.log(sql);
}
run().catch(console.error);
