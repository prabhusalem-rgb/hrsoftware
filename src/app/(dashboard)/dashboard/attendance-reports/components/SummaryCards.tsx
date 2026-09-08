'use client';

// ============================================================
// Summary Cards Component
// Displays key metrics from the attendance report
// ============================================================

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  CalendarCheck,
  Clock,
  TrendingUp,
  Building2,
  FileText,
} from 'lucide-react';
import { ProjectAttendanceReport } from '@/types';

interface Props {
  summary: ProjectAttendanceReport['summary'];
}

const formatNumber = (num: number): string => {
  return num.toLocaleString('en-IN');
};

const formatDecimal = (num: number): string => {
  return num.toFixed(1);
};

export function SummaryCards({ summary }: Props) {
  const cards = [
    {
      title: 'Total Employees',
      value: formatNumber(summary.total_employees),
      icon: Users,
      description: 'Employees in report',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900',
    },
    {
      title: 'Man-Days',
      value: formatDecimal(summary.total_man_days),
      icon: CalendarCheck,
      description: 'Total present days',
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900',
    },
    {
      title: 'Total Hours',
      value: formatDecimal(summary.total_hours),
      icon: Clock,
      description: 'Hours worked',
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900',
    },
    {
      title: 'Billable Hours',
      value: formatDecimal(summary.total_billable_hours),
      icon: FileText,
      description: '8 hrs × billable days',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900',
    },
    {
      title: 'Avg Attendance',
      value: `${summary.average_attendance.toFixed(2)}%`,
      icon: TrendingUp,
      description: 'Company average',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900',
    },
    {
      title: 'Leave Days',
      value: formatNumber(summary.total_leave_days),
      icon: Building2,
      description: 'Approved leaves taken',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, index) => (
        <Card key={index} className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-full ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
