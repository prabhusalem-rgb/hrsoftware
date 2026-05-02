'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-slate-200/50 dark:bg-slate-800/50',
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-3xl border-0 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
      <div className="p-5 space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-1/2" />
      </div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-4 px-4 border-b border-slate-100 dark:border-slate-800">
      <Skeleton className="h-10 w-10 rounded-2xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-3 w-1/6" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="h-8 w-8 rounded-xl" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-3xl border-0 shadow-sm bg-white dark:bg-slate-900 p-6">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>

        <div className="rounded-3xl border-0 shadow-sm bg-white dark:bg-slate-900 p-6">
          <Skeleton className="h-5 w-52 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmployeesTableSkeleton() {
  return (
    <div className="border-0 shadow-2xl rounded-3xl overflow-hidden">
      <div className="p-6 space-y-4 border-b border-slate-100">
        <div className="flex gap-4">
          <Skeleton className="h-12 w-40 rounded-2xl" />
          <Skeleton className="h-12 w-40 rounded-2xl" />
          <Skeleton className="h-10 flex-1 max-w-xs rounded-2xl ml-auto" />
        </div>
      </div>
      <div className="p-0">
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="h-4 w-1/6 ml-auto" />
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 10 }).map((_, i) => (
            <TableRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PayrollSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-12 w-36 rounded-2xl" />
          <Skeleton className="h-12 w-36 rounded-2xl" />
        </div>
      </div>

      {/* Month/Year Selector */}
      <div className="rounded-3xl border-0 shadow-sm bg-white dark:bg-slate-900 p-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-40 rounded-2xl" />
          <Skeleton className="h-10 w-32 rounded-2xl" />
          <Skeleton className="h-10 w-48 rounded-2xl" />
        </div>
      </div>

      {/* Recent Runs */}
      <div className="rounded-3xl border-0 shadow-sm bg-white dark:bg-slate-900">
        <div className="p-6 border-b border-slate-100">
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      </div>

      {/* Employee Table */}
      <div className="border-0 shadow-2xl rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    </div>
  );
}
