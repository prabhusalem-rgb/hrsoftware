// ============================================================
// Page: /dashboard/settlement/history
// Settlement History List
// Final Settlement Redesign — Phase 3
// ============================================================

'use client';

import { useState, useMemo } from 'react';
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Download,
  Eye,
  Calendar,
  CalendarRange,
  DollarSign,
  X,
  FileDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { formatOMR } from '@/lib/utils/currency';
import JSZip from 'jszip';
import { SettlementHistoryDrawer } from '@/components/payroll/settlement/SettlementHistoryDrawer';
import { useSettlementHistory } from '@/hooks/queries/useSettlementHistory';
import { toast } from 'sonner';
import type { SettlementHistoryEntry } from '@/types/settlement';

type SortColumn = 'processedAt' | 'employeeName' | 'netTotal' | 'reason';
type SortDirection = 'asc' | 'desc';

// SortIndicator component — declared outside render to avoid re-creation
const SortIndicator = ({ column, currentColumn, direction }: { column: SortColumn; currentColumn: SortColumn; direction: SortDirection }) => {
  if (currentColumn !== column) return null;
  return (
    <ChevronDown
      className={`w-4 h-4 inline ml-1 ${direction === 'desc' ? 'rotate-180' : ''}`}
      aria-hidden="true"
    />
  );
};

export default function SettlementHistoryPage() {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('processedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Advanced filter state
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch history (fetch larger limit for client-side filtering)
  const { data: historyData, isLoading } = useSettlementHistory({ limit: 1000 });

  // Filter, sort, and paginate
  const processedHistory = useMemo(() => {
    if (!historyData?.items) return [];

    let result = [...historyData.items];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (entry) =>
          entry.employeeName.toLowerCase().includes(query) ||
          entry.employeeCode.toLowerCase().includes(query) ||
          entry.reason.toLowerCase().includes(query)
      );
    }

    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      result = result.filter((entry) => new Date(entry.processedAt) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((entry) => new Date(entry.processedAt) <= toDate);
    }

    // Amount range filter
    if (minAmount) {
      const min = parseFloat(minAmount);
      result = result.filter((entry) => entry.netTotal >= min);
    }
    if (maxAmount) {
      const max = parseFloat(maxAmount);
      result = result.filter((entry) => entry.netTotal <= max);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number = a[sortColumn];
      let bVal: string | number = b[sortColumn];

      if (sortColumn === 'netTotal') {
        aVal = Number(aVal);
        bVal = Number(bVal);
      } else if (sortColumn === 'processedAt') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [historyData, searchQuery, sortColumn, sortDirection, dateFrom, dateTo, minAmount, maxAmount]);

  // Paginate
  const paginated = processedHistory.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const totalPages = Math.ceil(processedHistory.length / pageSize);

  // Handlers
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Selection handlers
  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginated.map((e) => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Bulk PDF download
  const handleBulkDownload = async () => {
    if (selectedIds.size === 0) return;

    toast.info('Preparing PDFs...', { description: `Zipping ${selectedIds.size} settlements` });

    const zip = new JSZip();

    try {
      // Fetch each PDF in parallel
      const fetchPromises = Array.from(selectedIds).map(async (entryId) => {
        const entry = paginated.find((e) => e.id === entryId);
        if (!entry || !entry.payrollItemId) return null;

        const response = await fetch(`/api/settlement/${entry.payrollItemId}/pdf?download=true`);
        if (!response.ok) throw new Error(`Failed to fetch PDF for ${entry.employeeCode}`);

        const blob = await response.blob();
        const filename = `Settlement_${entry.employeeCode}_${format(new Date(entry.processedAt), 'yyyy-MM-dd')}.pdf`;
        return { filename, blob };
      });

      const results = await Promise.all(fetchPromises);

      // Add to zip
      for (const result of results) {
        if (result) {
          zip.file(result.filename, result.blob);
        }
      }

      // Generate zip
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Trigger download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settlements_${format(new Date(), 'yyyy-MM-dd')}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Download started', { description: `${selectedIds.size} PDFs in ZIP` });
      setSelectedIds(new Set());
    } catch (error: unknown) {
      console.error('Bulk PDF error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to generate ZIP', { description: message });
    }
  };

  const handleExportCSV = () => {
    const csv = [
      ['Date', 'Employee Code', 'Employee Name', 'Reason', 'Net Total', 'Processed By'],
      ...processedHistory.map((entry) => [
        format(new Date(entry.processedAt), 'yyyy-MM-dd'),
        entry.employeeCode,
        entry.employeeName,
        entry.reason,
        entry.netTotal.toFixed(3),
        entry.processedBy.name,
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `settlement-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settlement History</h1>
          <p className="text-sm text-muted-foreground">
            Audit trail of all final settlements
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleBulkDownload}
              className="gap-2"
              aria-label={`Download ${selectedIds.size} selected settlement PDFs as ZIP`}
            >
              <FileDown className="w-4 h-4" aria-hidden="true" />
              Download {selectedIds.size} PDF{selectedIds.size > 1 ? 's' : ''}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-2"
            aria-label="Export settlement history as CSV"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b bg-muted/30 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by employee name, code, or reason..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        {/* Reason Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Reason
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setSearchQuery('')}>
              All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSearchQuery('resignation')}>
              Resignation
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSearchQuery('termination')}>
              Termination
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSearchQuery('contract_expiry')}>
              Contract Expiry
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Date From */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            placeholder="From"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="w-auto h-9"
          />
        </div>

        {/* Date To */}
        <div className="flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-muted-foreground" />
          <Input
            type="date"
            placeholder="To"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="w-auto h-9"
          />
        </div>

        {/* Amount Range */}
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-muted-foreground" />
          <Input
            type="number"
            step="0.001"
            placeholder="Min"
            value={minAmount}
            onChange={(e) => {
              setMinAmount(e.target.value);
              setPage(1);
            }}
            className="w-24 h-9"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            step="0.001"
            placeholder="Max"
            value={maxAmount}
            onChange={(e) => {
              setMaxAmount(e.target.value);
              setPage(1);
            }}
            className="w-24 h-9"
          />
        </div>

        {/* Clear filters */}
        {(dateFrom || dateTo || minAmount || maxAmount) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFrom('');
              setDateTo('');
              setMinAmount('');
              setMaxAmount('');
            }}
            className="gap-1"
          >
            <X className="w-3 h-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Stats Bar */}
      {processedHistory.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 py-3 bg-muted/20 border-b">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Settlements</span>
            <span className="text-2xl font-bold">{processedHistory.length}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Payout</span>
            <span className="text-2xl font-bold text-emerald-600 font-mono">
              {processedHistory.reduce((sum, e) => sum + e.netTotal, 0).toFixed(3)} OMR
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Average Settlement</span>
            <span className="text-2xl font-bold text-blue-600 font-mono">
              {(processedHistory.reduce((sum, e) => sum + e.netTotal, 0) / processedHistory.length).toFixed(3)} OMR
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={paginated.length > 0 && selectedIds.size === paginated.length}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort('processedAt')}
                scope="col"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort('processedAt');
                  }
                }}
                aria-sort={sortColumn === 'processedAt' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Date <SortIndicator column="processedAt" currentColumn={sortColumn} direction={sortDirection} />
              </TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort('employeeName')}
                scope="col"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort('employeeName');
                  }
                }}
                aria-sort={sortColumn === 'employeeName' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Employee <SortIndicator column="employeeName" currentColumn={sortColumn} direction={sortDirection} />
              </TableHead>
              <TableHead scope="col">Code</TableHead>
              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort('reason')}
                scope="col"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort('reason');
                  }
                }}
                aria-sort={sortColumn === 'reason' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Reason <SortIndicator column="reason" currentColumn={sortColumn} direction={sortDirection} />
              </TableHead>
              <TableHead
                className="text-right cursor-pointer"
                onClick={() => handleSort('netTotal')}
                scope="col"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSort('netTotal');
                  }
                }}
                aria-sort={sortColumn === 'netTotal' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                Net Total <SortIndicator column="netTotal" currentColumn={sortColumn} direction={sortDirection} />
              </TableHead>
              <TableHead>Processed By</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  No settlement records found
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((entry: SettlementHistoryEntry) => (
                <TableRow
                  key={entry.id}
                  onClick={() => setSelectedEmployeeId(entry.employeeId)}
                  className={`cursor-pointer ${selectedIds.has(entry.id) ? 'bg-muted' : ''}`}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(entry.id)}
                      onCheckedChange={(checked) => handleSelectOne(entry.id, checked as boolean)}
                      aria-label={`Select ${entry.employeeName}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {format(new Date(entry.processedAt), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell className="font-medium">{entry.employeeName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{entry.employeeCode}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {entry.reason.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    <span className="font-bold">{formatOMR(entry.netTotal, 3)}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.processedBy.name}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEmployeeId(entry.employeeId);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {processedHistory.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 border-t bg-background">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, processedHistory.length)} of{' '}
            {processedHistory.length} settlements
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* History Drawer */}
      {selectedEmployeeId && (
        <SettlementHistoryDrawer
          employeeId={selectedEmployeeId}
          isOpen={!!selectedEmployeeId}
          onClose={() => setSelectedEmployeeId(null)}
        />
      )}
    </div>
  );
}
