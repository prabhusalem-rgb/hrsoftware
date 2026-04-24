// ============================================================
// SettlementDashboard — Employee List for Settlement Selection
// Final Settlement Redesign — Phase 2
// ============================================================
// Displays a data table of active employees available for settlement.
// Supports:
//  - Search (name, code, department, designation)
//  - Bulk selection (checkboxes)
//  - Sorting (click column headers)
//  - Pagination
//  - Quick actions ("Settle" button per row)
//  - Batch action bar when items selected
// ============================================================

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Settings,
  ChevronDown,
  UserCheck,
  UserX,
  MoreHorizontal,
  FileText,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatOMR } from '@/lib/utils/currency';
import { calculateEOSB } from '@/lib/calculations/eosb';
import type { Employee } from '@/types';
import { useEmployees } from '@/hooks/queries/useEmployees';
import { useCompany } from '@/components/providers/CompanyProvider';

// Settlement eligibility: only active employees can be settled (per API contract)
const SETTLEMENT_ELIGIBLE_STATUSES = ['active'];

// Column definitions
type SortColumn = 'emp_code' | 'name_en' | 'department' | 'join_date' | 'basic_salary';
type SortDirection = 'asc' | 'desc';

interface ColumnDef {
  key: string;
  label: string;
  width?: string;
  sortable: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: 'emp_code', label: 'Code', width: '100px', sortable: true },
  { key: 'name_en', label: 'Name', width: '200px', sortable: true },
  { key: 'department', label: 'Department', width: '140px', sortable: true },
  { key: 'designation', label: 'Designation', width: '160px', sortable: false },
  { key: 'join_date', label: 'Join Date', width: '120px', sortable: true },
  { key: 'basic_salary', label: 'Basic Salary', width: '110px', sortable: true },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

interface SettlementDashboardProps {
  onSettle?: (employeeId: string) => void;
  onBatchSettle?: (employeeIds: string[]) => void;
}

/**
 * SettlementDashboard Component
 *
 * Main dashboard for selecting employees to settle.
 * Uses data table pattern with bulk selection.
 */
export function SettlementDashboard({
  onSettle,
  onBatchSettle,
}: SettlementDashboardProps) {
  const router = useRouter();
  const { activeCompany, activeCompanyId } = useCompany();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<SortColumn>('join_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // Fetch employees with server-side filters
  const { data: employees = [], isLoading } = useEmployees({
    companyId: activeCompanyId,
    searchQuery: searchQuery || undefined,
    department: departmentFilter !== 'all' ? departmentFilter : undefined,
    limit: 500, // Max limit for settlement operations
    statuses: SETTLEMENT_ELIGIBLE_STATUSES,
  });

  // Get unique departments for filter
  const departments = useMemo(() => {
    const depts = new Set(employees.map((e) => e.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [employees]);

  // Filter & sort employees (pagination-only since filters are server-side)
  const processedEmployees = useMemo(() => {
    // Create a copy and sort (non-mutating)
    const sorted = [...employees].sort((a, b) => {
      let aVal: string | number = a[sortColumn];
      let bVal: string | number = b[sortColumn];

      // Handle string sorting
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [employees, sortColumn, sortDirection]);

  // Paginate
  const totalPages = Math.ceil(processedEmployees.length / pageSize);
  const paginatedEmployees = processedEmployees.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // Calculate estimated EOSB for each employee (based on today)
  const getEstimatedEOSB = (employee: Employee): number => {
    return calculateEOSB({
      joinDate: employee.join_date,
      terminationDate: new Date().toISOString().split('T')[0],
      lastBasicSalary: Number(employee.basic_salary),
    }).totalGratuity;
  };

  // Handlers
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(paginatedEmployees.map((e) => e.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedIds(newSelection);
  };

  const handleSettle = (employeeId: string) => {
    if (onSettle) {
      onSettle(employeeId);
    } else {
      router.push(`/dashboard/settlement/new?employeeId=${employeeId}`);
    }
  };

  const handleBatchSettle = () => {
    if (selectedIds.size === 0) return;

    if (onBatchSettle) {
      onBatchSettle(Array.from(selectedIds));
    } else {
      // Navigate to batch page with selected IDs
      const idsParam = Array.from(selectedIds).join(',');
      router.push(`/dashboard/settlement/batch?ids=${idsParam}`);
    }
  };

  const isAllSelected =
    paginatedEmployees.length > 0 &&
    paginatedEmployees.every((e) => selectedIds.has(e.id));
  const isIndeterminate =
    paginatedEmployees.some((e) => selectedIds.has(e.id)) && !isAllSelected;

  // Render sort indicator
  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null;
    return (
      <ChevronDown
        className={`w-4 h-4 inline ml-1 ${
          sortDirection === 'desc' ? 'rotate-180' : ''
        }`}
      />
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 p-6 border-b bg-background">
        {/* Top row: Title + Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Final Settlement</h1>
            <p className="text-sm text-muted-foreground">
              Process end-of-service benefits for departing employees
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              data-testid="export-csv-btn"
              aria-label="Export employee list as CSV"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Export CSV
            </Button>

            {selectedIds.size > 0 && (
              <Button
                onClick={handleBatchSettle}
                className="gap-2 bg-primary hover:bg-primary/90"
                data-testid="batch-settle-btn"
                aria-label={`Batch settle ${selectedIds.size} selected employees`}
              >
                <UserCheck className="w-4 h-4" aria-hidden="true" />
                Batch Settle ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>

        {/* Bottom row: Search + Filters */}
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, department..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-10"
              data-testid="search-input"
            />
          </div>

          {/* Department Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md border border-input bg-background h-10 px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground gap-2"
            >
              <Filter className="w-4 h-4" />
              Department: {departmentFilter === 'all' ? 'All' : departmentFilter}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDepartmentFilter('all')}>
                All Departments
              </DropdownMenuItem>
              {departments.map((dept) => (
                <DropdownMenuItem
                  key={dept}
                  onClick={() => setDepartmentFilter(dept)}
                >
                  {dept}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Page Size */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md border border-input bg-background h-10 px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground gap-2"
            >
              <Settings className="w-4 h-4" />
              {pageSize} rows
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <DropdownMenuItem
                  key={size}
                  onClick={() => {
                    setPageSize(size);
                    setPage(1);
                  }}
                >
                  {size} rows
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto">
        <Table aria-label="Employee settlement list">
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  indeterminate={isIndeterminate}
                  aria-label="Select all rows"
                  data-testid="select-all-checkbox"
                />
              </TableHead>
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  style={{ width: col.width }}
                  className={`cursor-pointer hover:bg-muted/50 ${
                    col.sortable ? '' : 'pointer-events-none'
                  }`}
                  onClick={() => col.sortable && handleSort(col.key as SortColumn)}
                  data-testid={`sort-${col.key}`}
                  scope="col"
                  tabIndex={col.sortable ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (col.sortable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleSort(col.key as SortColumn);
                    }
                  }}
                  aria-sort={sortColumn === col.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center">
                    {col.label}
                    {col.sortable && <SortIndicator column={col.key as SortColumn} />}
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-right" scope="col">Service</TableHead>
              <TableHead className="text-right" scope="col">Basic (OMR)</TableHead>
              <TableHead className="text-right" scope="col">Est. EOSB</TableHead>
              <TableHead className="w-24 text-right" scope="col">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow aria-live="polite" aria-atomic="true">
                <TableCell colSpan={COLUMNS.length + 4} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground" role="status">
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" aria-hidden="true" />
                    <span>Loading employees...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedEmployees.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMNS.length + 4}
                  className="text-center py-12 text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <UserX className="w-12 h-12 opacity-20" aria-hidden="true" />
                    <p>No active employees found</p>
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search filter"
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedEmployees.map((employee) => {
                const estimatedEOSB = getEstimatedEOSB(employee);
                const isSelected = selectedIds.has(employee.id);

                return (
                  <TableRow
                    key={employee.id}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                    }`}
                    data-testid={`employee-row-${employee.id}`}
                    onClick={() => handleSettle(employee.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSettle(employee.id);
                      }
                    }}
                    aria-label={`Select ${employee.name_en} for settlement`}
                  >
                    <TableCell
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`row-checkbox-${employee.id}`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleSelectRow(employee.id, checked as boolean)
                        }
                        aria-label={`Select ${employee.name_en}`}
                      />
                    </TableCell>

                    <TableCell className="font-mono text-sm">
                      {employee.emp_code}
                    </TableCell>

                    <TableCell className="font-medium">
                      {employee.name_en}
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="font-normal text-xs">
                        {employee.department || '-'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {employee.designation || '-'}
                    </TableCell>

                    <TableCell className="font-mono text-sm">
                      {employee.join_date
                        ? new Date(employee.join_date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '-'}
                    </TableCell>

                    <TableCell className="font-mono text-sm text-right">
                      {formatOMR(employee.basic_salary, 3)}
                    </TableCell>

                    <TableCell className="font-mono text-sm text-right">
                      <span className="text-emerald-600 dark:text-emerald-500">
                        {formatOMR(estimatedEOSB, 3)}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <div
                        className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                        role="group"
                        aria-label={`Actions for ${employee.name_en}`}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSettle(employee.id)}
                          className="h-8 px-2 text-xs"
                          data-testid={`settle-btn-${employee.id}`}
                          aria-label={`Process settlement for ${employee.name_en}`}
                        >
                          <FileText className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                          Settle
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="h-8 w-8 p-0 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                            aria-label={`More options for ${employee.name_en}`}
                          >
                            <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/employees/${employee.id}`)}
                            >
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                // Copy to clipboard
                                navigator.clipboard.writeText(employee.emp_code);
                                toast.success('Employee code copied');
                              }}
                            >
                              Copy Code
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      {processedEmployees.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 border-t bg-background" role="navigation" aria-label="Pagination">
          <div className="text-sm text-muted-foreground" aria-live="polite">
            Showing {(page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, processedEmployees.length)} of{' '}
            {processedEmployees.length} employees
            {selectedIds.size > 0 && (
              <span className="ml-2 font-medium text-foreground">
                ({selectedIds.size} selected)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Previous</span>
            </Button>

            <div className="flex items-center gap-1" role="group" aria-label="Page numbers">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                    className="w-8 h-8 p-0"
                    aria-label={`Page ${pageNum}`}
                    aria-current={page === pageNum ? 'page' : undefined}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Next page"
            >
              <span className="sr-only">Next</span>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

SettlementDashboard.displayName = 'SettlementDashboard';

export default SettlementDashboard;
