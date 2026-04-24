'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAirTicketBalance } from '@/hooks/queries/useAirTicketBalance';
import { useAirTicketMutations } from '@/hooks/queries/useAirTicketMutations';
import { useEmployees } from '@/hooks/queries/useEmployees';
import { useCompany } from '@/components/providers/CompanyProvider';
import { Employee } from '@/types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plane, Ticket, Calendar, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react';
import { format, differenceInMonths } from 'date-fns';

type WizardStep = 'entitlement' | 'availing' | 'issuance' | 'usage' | 'cancellation';

interface BookingWizardProps {
  employeeId?: string; // If set, pre-selects this employee (HR booking on behalf)
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AirTicketBookingWizard({ employeeId, onSuccess, onCancel }: BookingWizardProps) {
  const { activeCompanyId } = useCompany();
  const { data: employees = [] } = useEmployees({ companyId: activeCompanyId });
  const { requestTicket, issueTicket, markAsUsed, cancelTicket } = useAirTicketMutations();

  const [currentStep, setCurrentStep] = useState<WizardStep>('entitlement');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employeeId || '');
  const [requestedQty, setRequestedQty] = useState<number>(1);
  const [purpose, setPurpose] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');

  // Fetch balance for selected employee (only when non-empty)
  const { data: balanceData, refetch: refetchBalance } = useAirTicketBalance(
    selectedEmployeeId || ''
  );

  // Derived state
  const selectedEmployee = useMemo(() => employees.find(e => e.id === selectedEmployeeId), [employees, selectedEmployeeId]);
  const availableBalance = balanceData?.available ?? 0;
  const canRequest = availableBalance >= requestedQty && requestedQty > 0;

  // Pre-select employee if passed as prop
  useEffect(() => {
    if (employeeId) {
      setSelectedEmployeeId(employeeId);
    }
  }, [employeeId]);

  // Wizard steps configuration
  const steps: { key: WizardStep; label: string; icon: React.ReactNode }[] = [
    { key: 'entitlement', label: 'Entitlement', icon: <Ticket className="w-4 h-4" /> },
    { key: 'availing', label: 'Availing', icon: <Plane className="w-4 h-4" /> },
    { key: 'issuance', label: 'Issuance', icon: <CheckCircle2 className="w-4 h-4" /> },
    { key: 'usage', label: 'Usage', icon: <Calendar className="w-4 h-4" /> },
    { key: 'cancellation', label: 'Cancellation', icon: <AlertCircle className="w-4 h-4" /> },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  // Step A: Entitlement View
  const renderEntitlementStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold">Air Ticket Entitlement</h3>
        <p className="text-muted-foreground">Review employee's current ticket balance</p>
      </div>

      {!selectedEmployee ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select Employee</Label>
            <Select value={selectedEmployeeId} onValueChange={(v) => setSelectedEmployeeId(v || '')}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.filter(e => e.status === 'active').map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name_en} ({emp.emp_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Accrued Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{balanceData?.accrued?.toFixed(2) || '0.00'}</p>
              <p className="text-xs text-muted-foreground">
                {selectedEmployee?.join_date ? `Based on ${Math.floor(differenceInMonths(new Date(), new Date(selectedEmployee.join_date)))} months tenure` : 'Join date not set'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Issued / Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">{balanceData?.issued || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{balanceData?.available.toFixed(2) || '0.00'}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );

  // Step B: Availing Details
  const renderAvailingStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold">Request Air Tickets</h3>
        <p className="text-muted-foreground">Enter the number of tickets to request</p>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="font-medium">Available Balance:</span>
            <span className="text-2xl font-bold text-blue-600">{availableBalance.toFixed(2)} tickets</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="qty">Number of Tickets *</Label>
          <Input
            id="qty"
            type="number"
            min="1"
            max={Math.floor(availableBalance)}
            step="1"
            value={requestedQty}
            onChange={(e) => setRequestedQty(parseFloat(e.target.value) || 0)}
          />
          <p className="text-xs text-muted-foreground">
            You can request up to {availableBalance.toFixed(2)} tickets
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="purpose">Purpose of Travel *</Label>
          <Select value={purpose} onValueChange={(v) => setPurpose(v || '')}>
            <SelectTrigger>
              <SelectValue placeholder="Select purpose" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="annual_leave">Annual Leave</SelectItem>
              <SelectItem value="vacation">Vacation</SelectItem>
              <SelectItem value="family_visit">Family Visit</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
              <SelectItem value="business">Business Trip</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="destination">Destination *</Label>
          <Input
            id="destination"
            placeholder="e.g., Muscat, India, Philippines"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Additional Notes</Label>
          <Textarea
            id="notes"
            placeholder="Preferred travel dates, special requirements..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  // Step C: Issuance (HR only - show ticket number)
  const renderIssuanceStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold">Ticket Issuance</h3>
        <p className="text-muted-foreground">Ticket has been approved and issued</p>
      </div>

      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle>Ticket Issued Successfully</CardTitle>
          <CardDescription>The air ticket request has been approved</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ticket Number:</span>
              <span className="font-mono font-bold text-lg">AT-20260413-0001</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Employee:</span>
              <span>{selectedEmployee?.name_en}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Purpose:</span>
              <span className="capitalize">{purpose.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Destination:</span>
              <span>{destination}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Issued At:</span>
              <span>{format(new Date(), 'dd MMM yyyy, HH:mm')}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            The ticket can now be booked. Mark as "Used" after travel is completed.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  // Step D: Usage Tracking
  const renderUsageStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold">Mark Ticket as Used</h3>
        <p className="text-muted-foreground">Confirm that the employee has completed travel</p>
      </div>

      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Plane className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold">{selectedEmployee?.name_en}</p>
                <p className="text-sm text-muted-foreground">Ticket to {destination}</p>
              </div>
            </div>

            <p className="text-sm bg-yellow-50 text-yellow-800 p-3 rounded">
              ⚠️ This action cannot be undone. The ticket will be marked as used and the balance will be permanently reduced.
            </p>

            <Button
              className="w-full"
              onClick={() => {
                if (!selectedTicketId) {
                  toast.error('Please select a ticket to mark as used');
                  return;
                }
                markAsUsed.mutate(selectedTicketId, {
                  onSuccess: () => {
                    toast.success('Ticket marked as used');
                    setCurrentStep('entitlement');
                    refetchBalance();
                  },
                });
              }}
            >
              Confirm Travel Completed
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Step E: Cancellation
  const renderCancellationStep = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold">Cancel Ticket</h3>
        <p className="text-muted-foreground">Cancel a ticket request and adjust balance if needed</p>
      </div>

      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Select Ticket to Cancel</Label>
            <Select value={selectedTicketId} onValueChange={(v) => setSelectedTicketId(v || '')}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a ticket" />
              </SelectTrigger>
              <SelectContent>
                {/* Would populate from ticket list */}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Cancellation Reason *</Label>
            <Textarea
              id="cancel-reason"
              placeholder="Explain why this ticket is being cancelled..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="bg-red-50 p-3 rounded text-sm text-red-700">
            {selectedTicketId && (
              <p>⚠️ Cancelling a used ticket will restore 1 ticket to the employee's balance.</p>
            )}
          </div>

          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              if (!selectedTicketId) {
                toast.error('Please select a ticket');
                return;
              }
              cancelTicket.mutate({ id: selectedTicketId, reason: notes }, {
                onSuccess: () => {
                  toast.success('Ticket cancelled');
                  setCurrentStep('entitlement');
                  refetchBalance();
                },
              });
            }}
          >
            Cancel Ticket
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 'entitlement': return renderEntitlementStep();
      case 'availing': return renderAvailingStep();
      case 'issuance': return renderIssuanceStep();
      case 'usage': return renderUsageStep();
      case 'cancellation': return renderCancellationStep();
    }
  };

  const handleNext = () => {
    if (currentStep === 'entitlement' && !selectedEmployeeId) {
      toast.error('Please select an employee');
      return;
    }
    if (currentStep === 'availing') {
      if (!canRequest) {
        toast.error('Insufficient balance or invalid quantity');
        return;
      }
      if (!purpose || !destination) {
        toast.error('Purpose and destination are required');
        return;
      }
      // Create the request
      requestTicket.mutate({
        employeeId: selectedEmployeeId,
        purpose,
        destination,
        quantity: requestedQty,
        notes,
      }, {
        onSuccess: () => {
          setCurrentStep('issuance');
        },
      });
      return;
    }
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) setCurrentStep(steps[nextIndex].key);
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) setCurrentStep(steps[prevIndex].key);
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => (
          <div key={step.key} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors
              ${idx === currentStepIndex ? 'bg-primary text-primary-foreground' :
                idx < currentStepIndex ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
              {step.icon}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-8 sm:w-16 h-1 mx-2 rounded ${idx < currentStepIndex ? 'bg-green-500' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {renderStep()}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Close
        </Button>
        <div className="flex gap-2">
          {currentStepIndex > 0 && (
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          {currentStep !== 'issuance' && currentStep !== 'usage' && currentStep !== 'cancellation' && (
            <Button onClick={handleNext}>
              {currentStep === 'entitlement' ? 'Continue' : 'Next'}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
