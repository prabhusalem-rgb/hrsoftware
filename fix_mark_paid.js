const fs = require('fs');

const path = 'src/app/api/payouts/route.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `        const updates = item_ids.map((id: string, idx: number) => {
          const item = items.find((i: any) => i.id === id);
          const itemPaidAmount = paid_amount?.[idx] || paid_amount?.[id] || item.net_salary;

          return {
            id,
            payout_status: 'paid',
            payout_date: payout_date || now,
            payout_method,
            payout_reference,
            paid_amount: itemPaidAmount,
            payout_notes: notes,
            hold_reason: null,
            hold_authorized_by: null,
            hold_placed_at: null,
          };
        });

        const { error: updateError } = await supabase
          .from('payroll_items')
          .upsert(updates, { onConflict: 'id' });

        if (updateError) {
          console.error("Mark Paid failed:", updateError);
          return NextResponse.json(
            { error: updateError.message || 'Failed to mark items as paid' },
            { status: 500 }
          );
        }
        updatedCount = updates.length;`;

const replacement = `        let failedUpdateError: any = null;
        for (let i = 0; i < item_ids.length; i++) {
          const id = item_ids[i];
          const item = items.find((itm: any) => itm.id === id);
          if (!item) continue;
          
          const itemPaidAmount = paid_amount?.[i] || paid_amount?.[id] || item.net_salary;

          const { error } = await supabase
            .from('payroll_items')
            .update({
              payout_status: 'paid',
              payout_date: payout_date || now,
              payout_method,
              payout_reference,
              paid_amount: itemPaidAmount,
              payout_notes: notes,
              hold_reason: null,
              hold_authorized_by: null,
              hold_placed_at: null,
            })
            .eq('id', id);

          if (error) {
            failedUpdateError = error;
            break;
          }
          updatedCount++;
        }

        const updates = item_ids.map((id: string, idx: number) => {
          const item = items.find((i: any) => i.id === id);
          const itemPaidAmount = paid_amount?.[idx] || paid_amount?.[id] || item?.net_salary;
          return { id, paid_amount: itemPaidAmount, payout_date: payout_date || now };
        });

        if (failedUpdateError) {
          console.error("Mark Paid failed:", failedUpdateError);
          return NextResponse.json(
            { error: failedUpdateError.message || 'Failed to mark items as paid' },
            { status: 500 }
          );
        }`;

if (content.includes(target)) {
  fs.writeFileSync(path, content.replace(target, replacement));
  console.log("Success");
} else {
  console.log("Target not found");
}
