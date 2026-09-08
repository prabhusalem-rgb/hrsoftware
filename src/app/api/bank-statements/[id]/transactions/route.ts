import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET /api/bank-statements/[id]/transactions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // First verify statement belongs to user's company
    const { data: statement, error: stmtError } = await supabaseAdmin
      .from('bank_statements')
      .select('company_id')
      .eq('id', id)
      .single();

    if (stmtError || !statement) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', session.user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    if (profile.role !== 'super_admin' && profile.company_id !== statement.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: transactions, error } = await supabaseAdmin
      .from('bank_transactions')
      .select(`
        *,
        employee:employee_id(name_en, emp_code, bank_iban, bank_bic),
        payout_item:payout_item_id(
          id,
          payout_status,
          payout_reference,
          paid_amount,
          payroll_item:payroll_item_id(net_salary, employee_id)
        )
      `)
      .eq('bank_statement_id', id)
      .order('transaction_date', { ascending: true });

    if (error) {
      console.error('Error fetching transactions:', error);
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    return NextResponse.json({ transactions: transactions || [] });
  } catch (error) {
    console.error('GET /api/bank-statements/[id]/transactions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/bank-statements/[id]/transactions/bulk
async function handleBulk(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', session.user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const user = profile;
    if (user.role !== 'super_admin' && user.role !== 'company_admin' && user.role !== 'finance') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: statementId } = await params;
    const body = await req.json();
    const { transactions } = body;

    if (!transactions || !Array.isArray(transactions)) {
      return NextResponse.json({ error: 'transactions array is required' }, { status: 400 });
    }

    // Verify statement access
    const { data: statement, error: stmtError } = await supabaseAdmin
      .from('bank_statements')
      .select('company_id')
      .eq('id', statementId)
      .single();

    if (stmtError || !statement) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 });
    }

    // Insert transactions
    const transactionsWithStatement = transactions.map((t: any) => ({
      ...t,
      bank_statement_id: statementId,
      created_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabaseAdmin
      .from('bank_transactions')
      .insert(transactionsWithStatement);

    if (insertError) {
      console.error('Error inserting bank transactions:', insertError);
      return NextResponse.json({ error: 'Failed to insert transactions' }, { status: 500 });
    }

    // Update statement status to processing
    await supabaseAdmin
      .from('bank_statements')
      .update({ status: 'processing' })
      .eq('id', statementId);

    return NextResponse.json({
      message: `${transactions.length} transactions imported successfully`,
      count: transactions.length
    });
  } catch (error) {
    console.error('POST /api/bank-statements/[id]/transactions/bulk error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/bank-statements/[id]/transactions/reconcile
async function handleReconcile(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, company_id, role')
      .eq('id', session.user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const { id: statementId } = await params;
    const body = await req.json();
    const { tolerance } = body;
    const toleranceAmount = tolerance || 0.001;

    // Check statement access
    const { data: statement, error: stmtError } = await supabaseAdmin
      .from('bank_statements')
      .select('company_id')
      .eq('id', statementId)
      .single();

    if (stmtError || !statement) {
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 });
    }

    if (profile.role !== 'super_admin' && profile.company_id !== statement.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all unmatched credit transactions (salary payments)
    const { data: creditTxns } = await supabaseAdmin
      .from('bank_transactions')
      .select('*')
      .eq('bank_statement_id', statementId)
      .eq('credit', { not: 'is', value: null })
      .gt('credit', 0)
      .is('payout_item_id', null);

    if (!creditTxns) {
      return NextResponse.json({ message: 'No transactions to reconcile', matched: 0 });
    }

    let matchedCount = 0;

    for (const txn of creditTxns) {
      // Try to find matching payout items
      // Match by amount (within tolerance), status (pending/processing), and not already paid
      const { data: matchingItems } = await supabaseAdmin
        .from('payout_items')
        .select(`
          id,
          paid_amount,
          payout_status,
          payroll_item:payroll_item_id(employee_id, net_salary)
        `)
        .eq('payout_status', 'pending')
        .gte('paid_amount', txn.credit - toleranceAmount)
        .lte('paid_amount', txn.credit + toleranceAmount)
        .limit(5);

      if (matchingItems && matchingItems.length > 0) {
        // Auto-match the first one (could be improved with more sophisticated matching)
        const match = matchingItems[0];

        const { error: updateError } = await supabaseAdmin.rpc(
          'reconcile_bank_transaction',
          {
            p_bank_transaction_id: txn.id,
            p_payout_item_id: match.id,
            p_user_id: profile.id
          }
        );

        if (!updateError) {
          matchedCount++;
        }
      }
    }

    // Update statement status
    const { data: remainingTxns } = await supabaseAdmin
      .from('bank_transactions')
      .select('id')
      .eq('bank_statement_id', statementId)
      .is('payout_item_id', null)
      .limit(1);

    const newStatus = remainingTxns && remainingTxns.length > 0 ? 'processing' : 'completed';

    await supabaseAdmin
      .from('bank_statements')
      .update({ status: newStatus })
      .eq('id', statementId);

    return NextResponse.json({
      message: `Reconciliation complete`,
      matched: matchedCount,
      status: newStatus
    });
  } catch (error) {
    console.error('POST /api/bank-statements/[id]/transactions/reconcile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const url = new URL(req.url);
  if (url.pathname.endsWith('/reconcile')) {
    return handleReconcile(req, context);
  }
  return handleBulk(req, context);
}
