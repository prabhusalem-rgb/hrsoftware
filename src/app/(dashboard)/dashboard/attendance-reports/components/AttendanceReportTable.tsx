'use client';

// ============================================================
// Attendance Report Table
// TanStack Table-based employee attendance grid with day-wise marks
// ============================================================

import { useMemo, useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  CellContext,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmployeeAttendanceRow } from '@/types';
import { getAttendanceStatusDescription } from '@/lib/attendance-calculations';
import { format } from 'date-fns';

interface Props {
  employees: EmployeeAttendanceRow[];
  month: number;
  year: number;
}

// Simple attendance mark badge component
function AttendanceMarkBadge({ mark }: { mark: string }) {
  if (!mark) return <span className="inline-block w-6 h-6" />;

  const styles: Record<string, string> = {
    P: 'bg-green-500 text-white hover:bg-green-600',
    A: 'bg-red-500 text-white hover:bg-red-600',
    L: 'bg-blue-500 text-white hover:bg-blue-600',
    H: 'bg-yellow-500 text-white hover:bg-yellow-600',
    W: 'bg-gray-400 text-white hover:bg-gray-500',
  };

  return (
    <Badge
      className={`w-6 h-6 flex items-center justify-center text-xs font-bold p-0 ${styles[mark] || 'bg-muted'}`}
      variant="secondary"
    >
      {mark}
    </Badge>
  );
}

// Employee details popover
function EmployeeDetailsPopover({ employee }: { employee: EmployeeAttendanceRow }) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Eye className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-semibold text-primary">
                {employee.name_en.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium text-sm">{employee.name_en}</p>
              <p className="text-xs text-muted-foreground">{employee.emp_code}</p>
            </div>
          </div>
          <div className="text-sm space-y-1 pt-2 border-t">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Designation</span>
              <span className="font-medium">{employee.designation || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Join Date</span>
              <span className="font-medium">{employee.join_date || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Exit Date</span>
              <span className="font-medium">{employee.exit_date || 'Active'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Allocation</span>
              <span className="font-medium">{employee.allocation_percentage}%</span>
            </div>
          </div>
          {employee.remarks && (
            <div className="pt-2 border-t">
              <p className="text-xs text-amber-600 font-medium">Note: {employee.remarks}</p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Day column header component
function DayColumnHeader({ day, date }: { day: number; date: Date }) {
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 5; // Friday is weekend (day 5)

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{day}</span>
      <span className={`text-[10px] ${isWeekend ? 'text-red-500' : 'text-muted-foreground'}`}>
        {['S','M','T','W','T','F','S'][dayOfWeek]}
      </span>
    </div>
  );
}

export function AttendanceReportTable({ employees, month, year }: Props) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([]);

  // Defensive: ensure employees is always an array
  const safeEmployees = useMemo(() => {
    if (!employees) {
      console.warn('AttendanceReportTable: employees prop is undefined, using empty array');
      return [];
    }
    return Array.isArray(employees) ? employees : [];
  }, [employees]);

  // Get days in month
  const daysInMonth = useMemo(() => {
    return new Date(year, month, 0).getDate();
  }, [month, year]);

  // Generate date objects for each day
  const monthDates = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month - 1, i + 1));
  }, [daysInMonth, month, year]);

  // Define columns
  const columns = useMemo<ColumnDef<EmployeeAttendanceRow>[]>(
    () => [
      {
        accessorKey: 'emp_code',
        header: 'Emp Code',
        size: 100,
        cell: ({ row }: CellContext<EmployeeAttendanceRow, unknown>) => (
          <span className="font-mono text-sm font-medium">{row.original.emp_code}</span>
        ),
      },
      {
        accessorKey: 'name_en',
        header: 'Employee Name',
        size: 180,
        cell: ({ row }: CellContext<EmployeeAttendanceRow, unknown>) => (
          <span className="font-medium">{row.original.name_en}</span>
        ),
      },
      {
        accessorKey: 'designation',
        header: 'Designation',
        size: 140,
        cell: ({ row }: CellContext<EmployeeAttendanceRow, unknown>) => (
          <span className="text-sm text-muted-foreground">
            {row.original.designation || '-'}
          </span>
        ),
      },
      // Dynamic day columns
      ...Array.from({ length: daysInMonth }, (_, i) => {
        const dayDate = monthDates[i];
        const dateKey = format(dayDate, 'yyyy-MM-dd');
        return {
          accessorKey: `day_${i + 1}`,
          id: `day_${i + 1}`,
          header: () => <DayColumnHeader day={i + 1} date={dayDate} />,
          size: 50,
          cell: ({ row }: CellContext<EmployeeAttendanceRow, unknown>) => {
            const marks = row.original.daily_marks;
            const mark = marks[dateKey] || '';
            return <AttendanceMarkBadge mark={mark} />;
          },
        };
      }),
      // Totals
      {
        accessorKey: 'total_present',
        header: 'Present',
        size: 80,
        cell: ({ row }: CellContext<EmployeeAttendanceRow, unknown>) => (
          <span className="font-medium text-green-600 text-center block">
            {row.original.total_present}
          </span>
        ),
      },
      {
        accessorKey: 'total_absent',
        header: 'Absent',
        size: 80,
        cell: ({ row }: CellContext<EmployeeAttendanceRow, unknown>) => (
          <span className="font-medium text-red-600 text-center block">
            {row.original.total_absent}
          </span>
        ),
      },
      {
        accessorKey: 'total_leave',
        header: 'Leave',
        size: 80,
        cell: ({ row }: CellContext<EmployeeAttendanceRow, unknown>) => (
          <span className="font-medium text-blue-600 text-center block">
            {row.original.total_leave}
          </span>
        ),
      },
      {
        accessorKey: 'total_hours_worked',
        header: 'Hours',
        size: 80,
        cell: ({ row }: CellContext<EmployeeAttendanceRow, unknown>) => (
          <span className="font-mono text-sm text-center block">
            {row.original.total_hours_worked?.toFixed(1) || '0.0'}
          </span>
        ),
      },
      {
        accessorKey: 'attendance_percentage',
        header: 'Att %',
        size: 80,
        cell: ({ row }: CellContext<EmployeeAttendanceRow, unknown>) => {
          const pct = row.original.attendance_percentage;
          const color = pct >= 90 ? 'text-green-600' : pct >= 75 ? 'text-amber-600' : 'text-red-600';
          return (
            <span className={`font-bold text-center block ${color}`}>
              {pct.toFixed(2)}%
            </span>
          );
        },
      },
      {
        accessorKey: 'remarks',
        header: 'Remarks',
        size: 120,
        cell: ({ row }: CellContext<EmployeeAttendanceRow, unknown>) => (
          <span className="text-xs text-muted-foreground italic">
            {row.original.remarks || '-'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        size: 60,
        cell: ({ row }: CellContext<EmployeeAttendanceRow, unknown>) => <EmployeeDetailsPopover employee={row.original} />,
      },
    ],
    [daysInMonth, monthDates]
  );

  // Add daily marks to row data
  const enhancedData = useMemo(() => {
    return safeEmployees.map(emp => {
      const dailyMarks = emp.daily_marks || {};
      const rowData = {
        ...emp,
        ...Object.fromEntries(
          monthDates.map((date, idx) => [
            `day_${idx + 1}`,
            dailyMarks[format(date, 'yyyy-MM-dd')] || ''
          ])
        )
      };
      return rowData as unknown as EmployeeAttendanceRow;
    });
  }, [safeEmployees, monthDates]);

  // Create table instance
  const table = useReactTable({
    data: enhancedData,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting as any,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Legend for attendance marks
  const legend = [
    { mark: 'P', label: 'Present', color: 'bg-green-500' },
    { mark: 'A', label: 'Absent', color: 'bg-red-500' },
    { mark: 'L', label: 'Leave', color: 'bg-blue-500' },
    { mark: 'H', label: 'Holiday', color: 'bg-yellow-500' },
    { mark: 'W', label: 'Weekend', color: 'bg-gray-400' },
  ];

  return (
    <div className="space-y-4">
      {/* Global search */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search employees..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Sort <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSorting([{ id: 'emp_code', desc: false }])}>
              Emp Code (A-Z)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSorting([{ id: 'emp_code', desc: true }])}>
              Emp Code (Z-A)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSorting([{ id: 'attendance_percentage', desc: true }])}>
              Attendance % (High to Low)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSorting([{ id: 'attendance_percentage', desc: false }])}>
              Attendance % (Low to High)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="font-medium">Legend:</span>
        {legend.map(item => (
          <div key={item.mark} className="flex items-center gap-1">
            <Badge className={`${item.color} text-white text-xs px-1.5 py-0`}>
              {item.mark}
            </Badge>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="bg-muted/50"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={`flex items-center gap-1 ${
                          header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getIsSorted() === 'asc' && (
                          <ChevronUp className="h-4 w-4" />
                        )}
                        {header.column.getIsSorted() === 'desc' && (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {employees.length === 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <p>No employees found for the selected criteria.</p>
                      <p className="text-xs">
                        Possible reasons: no project assignments, no timesheets for this month, or all employees have exited.
                      </p>
                    </div>
                  ) : (
                    'No employees match your search.'
                  )}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  className="hover:bg-muted/50"
                >
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="text-center align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {safeEmployees.length} employee{safeEmployees.length !== 1 ? 's' : ''}
        </span>
        <span>
          {daysInMonth} days in {new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
      </div>
    </div>
  );
}
