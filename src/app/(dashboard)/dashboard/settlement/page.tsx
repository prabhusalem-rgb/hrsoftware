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
    if (empId) {
      setSelectedEmployeeId(empId);
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

  const handleBatchSubmit = async (data: {
    commonTerminationDate: string;
    commonReason: string;
    commonNoticeServed: boolean;
    includePendingLoans?: boolean;
    items: Array<{
      employeeId: string;
      additionalDeductions?: number;
      notes?: string;
    }>;
    notes?: string;
  }) => {
    await batchSettle.mutateAsync(data as unknown as Parameters<typeof batchSettle.mutateAsync>[0]);
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
                onProcess={createSettlement.mutateAsync}
                preselectedEmployeeId={selectedEmployeeId}
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
