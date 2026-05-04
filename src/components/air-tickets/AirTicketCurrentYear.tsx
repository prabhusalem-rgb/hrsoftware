'use client';

import { useMemo, useState } from 'react';
import { useAirTickets } from '@/hooks/queries/useAirTickets';
import { useAirTicketBalance } from '@/hooks/queries/useAirTicketBalance';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO, differenceInMonths } from 'date-fns';
import { TrendingUp, Calendar, Plane, CheckCircle, AlertCircle, Clock, Calculator } from 'lucide-react';
import { getCurrentYearEarned, calculateYearlyBreakdown } from '@/lib/calculations/air_ticket';

interface AirTicketCurrentYearProps {
  employeeId?: string;
  employeeName?: string;
}

export function AirTicketCurrentYear({ employeeId, employeeName }: AirTicketCurrentYearProps) {
  const { data: tickets = [], isLoading, error } = useAirTickets(employeeId);
  const { data: balance, isLoading: balanceLoading } = useAirTicketBalance(employeeId ?? undefined);

  // Calculate yearly breakdown for comprehensive view
  const yearlyBreakdown = useMemo(() => {
    if (!balance?.joinDate) return null;
    return calculateYearlyBreakdown(
      balance.joinDate,
      balance.airTicketCycle || 12,
      balance.openingTickets || 0,
      tickets
    );
  }, [balance, tickets]);

  const currentYear = new Date().getFullYear();
  const cycleMonths = balance?.airTicketCycle || 12;

  // Count tickets by status and year
  const stats = useMemo(() => {
    const yearlyStats: Record<number, {
      requested: number;
      issued: number;
      used: number;
      cancelled: number;
    }> = {};

    tickets.forEach(ticket => {
      const createdYear = ticket.created_at ? new Date(ticket.created_at).getFullYear() : new Date().getFullYear();
      if (!yearlyStats[createdYear]) {
        yearlyStats[createdYear] = { requested: 0, issued: 0, used: 0, cancelled: 0 };
      }

      if (ticket.status === 'requested') {
        yearlyStats[createdYear].requested++;
      } else if (ticket.status === 'issued') {
        yearlyStats[createdYear].issued++;
        if (ticket.issued_at) {
          const issuedYear = new Date(ticket.issued_at).getFullYear();
          if (!yearlyStats[issuedYear]) yearlyStats[issuedYear] = { requested: 0, issued: 0, used: 0, cancelled: 0 };
          yearlyStats[issuedYear].issued++;
        }
      } else if (ticket.status === 'used') {
        if (ticket.used_at) {
          const usedYear = new Date(ticket.used_at).getFullYear();
          if (!yearlyStats[usedYear]) yearlyStats[usedYear] = { requested: 0, issued: 0, used: 0, cancelled: 0 };
          yearlyStats[usedYear].used++;
        }
      } else if (ticket.status === 'cancelled') {
        yearlyStats[createdYear].cancelled++;
      }
    });

    return yearlyStats;
  }, [tickets]);

  const currentYearStats = stats[currentYear] || { requested: 0, issued: 0, used: 0, cancelled: 0 };

  if (!employeeId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No employee selected
        </CardContent>
      </Card>
    );
  }

  if (isLoading || balanceLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i}><CardContent><p className="py-8 text-center text-muted-foreground">Loading...</p></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="py-8 text-center text-red-600">
            Error loading data: {(error as Error).message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!balance?.joinDate) {
    return (
      <Card>
        <CardContent>
          <p className="py-8 text-center text-muted-foreground">
            Employee data incomplete. Please ensure join date and air ticket cycle are set.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate join date anniversary for current year
  const joinDate = parseISO(balance.joinDate);
  const currentYearStart = new Date(currentYear, 0, 1);
  const effectiveAccrualStart = joinDate > currentYearStart ? joinDate : currentYearStart;
  const monthsInCurrentYear = differenceInMonths(new Date(), effectiveAccrualStart);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              Year
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{currentYear}</p>
            <p className="text-xs text-muted-foreground">Current calendar year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Earned This Year
            </CardTitle>
          </CardHeader>
          <CardContent>
            {yearlyBreakdown ? (
              <>
                <p className="text-2xl font-bold text-green-600">
                  {yearlyBreakdown?.currentYearEarned?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Pro-rata: ({monthsInCurrentYear} months ÷ {cycleMonths}) × 2
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Calculating...</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Plane className="w-4 h-4 text-purple-500" />
              Issued
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              {currentYearStats.issued}
            </p>
            <p className="text-xs text-muted-foreground">Tickets booked this year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {currentYearStats.used}
            </p>
            <p className="text-xs text-muted-foreground">Travel completed this year</p>
          </CardContent>
        </Card>
      </div>

      {/* Accrual Details Section */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            Accrual Breakdown
          </CardTitle>
          <CardDescription>
            Join Date: {balance.joinDate ? format(parseISO(balance.joinDate), 'dd MMM yyyy') : 'N/A'} • Cycle: {cycleMonths} months ({cycleMonths === 24 ? 'biennial' : 'annual'})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Formula Display */}
          <div className="bg-white rounded-lg p-4 border">
            <h4 className="text-sm font-semibold mb-3">Accrual Formula</h4>
            <div className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono bg-slate-100 px-2 py-1 rounded">
                  Accrued = (MonthsWorked ÷ {cycleMonths}) × 2 + OpeningBalance
                </span>
              </div>
              {(balance.openingTickets || 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Opening balance of {balance.openingTickets || 0} ticket(s) included from prior system/migration.
                </p>
              )}
            </div>
          </div>

          {/* Current Year Calculation Details */}
          <div className="bg-white rounded-lg p-4 border">
            <h4 className="text-sm font-semibold mb-3">Current Year Accrual ({currentYear})</h4>
            <div className="text-sm space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Join Date:</span>
                <span>{balance.joinDate ? format(parseISO(balance.joinDate), 'dd MMM yyyy') : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Months worked in {currentYear}:</span>
                <span>{monthsInCurrentYear} months</span>
              </div>
              <div className="flex justify-between">
                <span>Eligibility cycle:</span>
                <span>{cycleMonths} months</span>
              </div>
              <div className="flex justify-between">
                <span>Opening balance allocated:</span>
                <span>0 tickets (prior periods)</span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                <span>Earned in {currentYear}:</span>
                <span className="text-green-600">
                  ({monthsInCurrentYear} ÷ {cycleMonths}) × 2 = {yearlyBreakdown?.currentYearEarned.toFixed(2) || '0.00'} tickets
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Yearly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets by Calendar Year</CardTitle>
          <CardDescription>
            Breakdown of ticket activity per calendar year
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!yearlyBreakdown || yearlyBreakdown.byYear.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No ticket activity recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Months Worked</TableHead>
                  <TableHead>Earned (Accrual)</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Cancelled</TableHead>
                  <TableHead className="text-right">Net Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearlyBreakdown.byYear.map((yearData) => {
                  const net = (yearData.ticketsIssued * -1) + yearData.ticketsCancelled;
                  const isCurrentYear = yearData.year === currentYear;
                  return (
                    <TableRow key={yearData.year} className={isCurrentYear ? 'bg-blue-50/50' : ''}>
                      <TableCell className="font-medium">
                        {yearData.year}
                        {isCurrentYear && (
                          <Badge variant="outline" className="ml-2 text-xs">Current</Badge>
                        )}
                      </TableCell>
                      <TableCell>{yearData.monthsInYear}</TableCell>
                      <TableCell className="text-green-600 font-medium">
                        +{(yearData.ticketsEarned || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-purple-600">{yearData.ticketsIssued}</TableCell>
                      <TableCell className="text-green-600">{yearData.ticketsUsed}</TableCell>
                      <TableCell>{yearData.ticketsRequested}</TableCell>
                      <TableCell className="text-red-600">{yearData.ticketsCancelled}</TableCell>
                      <TableCell className={`text-right font-medium ${net < 0 ? 'text-red-600' : net > 0 ? 'text-green-600' : ''}`}>
                        {net !== 0 ? (net > 0 ? '+' : '') + net : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">About Yearly Accruals</p>
              <p>
                Air tickets accrue pro-rata based on tenure: (MonthsWorked ÷ {cycleMonths}) × 2.
                "Earned This Year" shows the portion accrued from January 1 to today.
                Opening balances (if any) are from prior employment/migration and are not re-earned.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
