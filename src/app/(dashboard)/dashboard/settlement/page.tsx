// ============================================================
// Page: /dashboard/settlement
// Settlement Dashboard — Employee Selection
// Final Settlement Redesign — Phase 2
// ============================================================

'use client';

import { SettlementDashboard } from '@/components/payroll/settlement/SettlementDashboard';
import { FinalSettlementWizard } from '@/components/payroll/FinalSettlementWizard';
import { BatchSettlementModal } from '@/components/payroll/settlement/BatchSettlementModal';
import { useState, Suspense, use } from 'react';
import { useEmployees } from '@/hooks/queries/useEmployees';
import { useCompany } from '@/components/providers/CompanyProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useBatchSettlement, useCreateSettlement } from '@/hooks/queries/useSettlementMutations';
import type { BatchSettlementConfig } from '@/types/settlement';

// Settlement eligibility: only active employees can be settled (per API contract)
const SETTLEMENT_ELIGIBLE_STATUSES = ['active'];

function SettlementPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeCompany, activeCompanyId } = useCompany();
  const batchSettle = useBatchSettlement();
  const createSettlement = useCreateSettlement(activeCompanyId);

  // State
  const [showWizard, setShowWizard] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>();
  const [selectedLeaveRequestId, setSelectedLeaveRequestId] = useState<string | undefined>();
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchEmployeeIds, setBatchEmployeeIds] = useState<string[]>([]);

  // Fetch employees for batch modal
  const { data: employees = [] } = useEmployees({
    companyId: activeCompanyId,
    limit: 500,
    statuses: SETTLEMENT_ELIGIBLE_STATUSES,
  });

  // Check for preselected employee from query params
  useEffect(() => {
    const empId = searchParams.get('employeeId');
    const leaveId = searchParams.get('leaveRequestId');
    if (empId) {
      setSelectedEmployeeId(empId);
      if (leaveId) setSelectedLeaveRequestId(leaveId);
      setShowWizard(true);
    }
  }, [searchParams]);

  // Check for batch IDs from query params
  useEffect(() => {
    const ids = searchParams.get('ids');
    if (ids) {
      const idArray = ids.split(',').filter(Boolean);
      setBatchEmployeeIds(idArray);
      setShowBatchModal(true);
    }
  }, [searchParams]);

  // Handlers
  const handleSettle = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setShowWizard(true);
  };

  const handleBatchSettle = (employeeIds: string[]) => {
    setBatchEmployeeIds(employeeIds);
    setShowBatchModal(true);
  };

  const handleWizardClose = () => {
    setShowWizard(false);
    setSelectedEmployeeId(undefined);
    router.push('/dashboard/settlement');
  };

  const handleBatchModalClose = () => {
    setShowBatchModal(false);
    setBatchEmployeeIds([]);
    router.push('/dashboard/settlement');
  };

  const handleBatchSubmit = async (data: BatchSettlementConfig) => {
    await batchSettle.mutateAsync(data);
    handleBatchModalClose();
  };

  return (
    <div className="flex flex-col h-full">
      <SettlementDashboard
        onSettle={handleSettle}
        onBatchSettle={handleBatchSettle}
      />

      {/* Single Settlement Wizard */}
      {showWizard && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="bg-background w-full max-w-7xl h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col">
              <FinalSettlementWizard
                isOpen={showWizard}
                onClose={handleWizardClose}
                employees={employees}
                onProcess={async (data) => {
                  const apiData = {
                    employeeId: data.employee_id,
                    terminationDate: data.settlement_date,
                    reason: data.reason || 'resignation',
                    noticeServed: data.notice_served !== undefined ? data.notice_served : true,
                    otherAdditions: (data.other_additions || []).map((a: any) => ({
                      label: a.label,
                      amount: Number(a.amount) || 0,
                    })),
                    otherDeductions: (data.other_deductions || []).map((d: any) => ({
                      label: d.label,
                      amount: Number(d.amount) || 0,
                    })),
                    notes: data.notes || '',
                    includePendingLoans: data.includePendingLoans !== undefined ? data.includePendingLoans : true,
                    leave_request_id: data.leave_request_id || null,
                    hr_signature: data.hr_signature || null,
                    gm_signature: data.gm_signature || null,
                  };
                  return createSettlement.mutateAsync(apiData as any);
                }}
                preselectedEmployeeId={selectedEmployeeId}
                preselectedLeaveRequestId={selectedLeaveRequestId}
              />
            </div>
          </div>
        </div>
      )}

      {/* Batch Settlement Modal */}
      {showBatchModal && (
        <BatchSettlementModal
          isOpen={showBatchModal}
          onClose={handleBatchModalClose}
          employeeIds={batchEmployeeIds}
          employees={employees.filter((e) => batchEmployeeIds.includes(e.id))}
          onSubmit={handleBatchSubmit}
        />
      )}
    </div>
  );
}

export default function SettlementPage() {
  return (
    <Suspense fallback={<div className="flex flex-col h-full p-8">Loading settlement dashboard...</div>}>
      <SettlementPageContent />
    </Suspense>
  );
}
