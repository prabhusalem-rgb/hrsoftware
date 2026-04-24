'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import {
  Search, Filter, Calendar as CalendarIcon, CheckCircle, XCircle,
  AlertTriangle, Bug, RefreshCw, Download, Eye, Shield, Activity,
  ChevronDown, MoreHorizontal, MessageSquare, X
} from 'lucide-react';
import { useExceptions, useExceptionStats } from '@/hooks/queries/useExceptions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ExceptionEntry, ErrorSeverity } from '@/hooks/queries/useExceptions';

const severityConfig: Record<ErrorSeverity, { icon: typeof AlertTriangle; color: string; bgColor: string }> = {
  low: { icon: Activity, color: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-100 dark:bg-blue-900/40' },
  medium: { icon: AlertTriangle, color: 'text-amber-700 dark:text-amber-300', bgColor: 'bg-amber-100 dark:bg-amber-900/40' },
  high: { icon: Bug, color: 'text-orange-700 dark:text-orange-300', bgColor: 'bg-orange-100 dark:bg-orange-900/40' },
  critical: { icon: XCircle, color: 'text-rose-700 dark:text-rose-300', bgColor: 'bg-rose-100 dark:bg-rose-900/40' },
};

export default function ExceptionsPage() {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [resolvedFilter, setResolvedFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedException, setSelectedException] = useState<ExceptionEntry | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const { data: exceptionsData, isLoading, refetch } = useExceptions({
    severity: severityFilter !== 'all' ? severityFilter as ErrorSeverity : undefined,
    error_type: typeFilter !== 'all' ? typeFilter as ExceptionEntry['error_type'] : undefined,
    resolved: resolvedFilter !== 'all' ? resolvedFilter === 'true' : undefined,
    start_date: dateRange.from?.toISOString(),
    end_date: dateRange.to?.toISOString(),
    search: search || undefined,
  });

  const { data: statsData } = useExceptionStats();

  // Extract unique error types
  const errorTypes = useMemo(() => {
    if (!exceptionsData?.exceptions) return [];
    const types = new Set(exceptionsData.exceptions.map(e => e.error_type));
    return Array.from(types).sort();
  }, [exceptionsData]);

  // Filter exceptions client-side
  const filteredExceptions = useMemo(() => {
    if (!exceptionsData?.exceptions) return [];
    return exceptionsData.exceptions;
  }, [exceptionsData]);

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Error Type', 'Severity', 'Message', 'Route', 'User', 'IP', 'Resolved'];
    const rows = filteredExceptions.map(ex => [
      ex.created_at,
      ex.error_type,
      ex.severity,
      ex.message.replace(/"/g, '""'),
      ex.route || '',
      ex.user?.full_name || ex.user_id || '',
      ex.ip_address || '',
      ex.resolved ? 'Yes' : 'No',
    ]);

    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exceptions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exceptions exported');
  };

  const handleResolve = async (exceptionId: string, resolved: boolean) => {
    setIsResolving(true);
    try {
      const response = await fetch(`/api/exceptions/${exceptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved, resolution_notes: resolveNotes || undefined }),
      });

      if (!response.ok) {
        throw new Error('Failed to update exception');
      }

      toast.success(`Exception marked as ${resolved ? 'resolved' : 'unresolved'}`);
      setSelectedException(null);
      setResolveNotes('');
      refetch();
    } catch (error) {
      toast.error('Failed to update exception status');
    } finally {
      setIsResolving(false);
    }
  };

  const openException = (exception: ExceptionEntry) => {
    setSelectedException(exception);
    setResolveNotes(exception.resolution_notes || '');
  };

  const criticalCount = statsData?.criticalOpen || 0;
  const openCount = statsData?.open || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bug className="h-6 w-6 text-destructive" />
            <h1 className="text-3xl font-bold tracking-tight">Exceptions</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            System errors and business rule violations requiring attention
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportToCSV} disabled={filteredExceptions.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Alert Banner for Critical Exceptions */}
      {criticalCount > 0 && (
        <Card className="border-rose-500 bg-rose-50 dark:bg-rose-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-rose-600" />
              <div>
                <h3 className="font-semibold text-rose-900 dark:text-rose-100">
                  {criticalCount} Critical Exception{criticalCount > 1 ? 's' : ''} Require Immediate Attention
                </h3>
                <p className="text-sm text-rose-700 dark:text-rose-300">
                  Review and resolve critical exceptions as soon as possible.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Exceptions</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{openCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <XCircle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{criticalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Types</CardTitle>
            <Bug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData?.byType.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Exceptions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsData?.byType.reduce((sum: number, t: { count: number }) => sum + t.count, 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Filter Exceptions</CardTitle>
              <CardDescription>Search and filter error logs</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="self-start"
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Filters
              <ChevronDown className={cn('h-4 w-4 ml-2 transition-transform', showFilters && 'rotate-180')} />
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="border-t pt-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-14">
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="search">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search message..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="severity">Severity</Label>
                <Select value={severityFilter} onValueChange={(v) => v && setSeverityFilter(v)}>
                  <SelectTrigger id="severity">
                    <SelectValue placeholder="All severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All severities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="type">Error Type</Label>
                <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {errorTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="resolved">Status</Label>
                <Select value={resolvedFilter} onValueChange={(v) => v && setResolvedFilter(v)}>
                  <SelectTrigger id="resolved">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="false">Open</SelectItem>
                    <SelectItem value="true">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !dateRange.from && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from ? format(dateRange.from, 'PP') : 'Start'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !dateRange.to && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.to ? format(dateRange.to, 'PP') : 'End'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-end lg:col-span-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch('');
                    setSeverityFilter('all');
                    setTypeFilter('all');
                    setResolvedFilter('all');
                    setDateRange({ from: undefined, to: undefined });
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Exceptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Exception Log</CardTitle>
          <CardDescription>
            {filteredExceptions.length} exception{filteredExceptions.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredExceptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No exceptions found matching your filters.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Error Type</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>User / Route</TableHead>
                    <TableHead className="hidden lg:table-cell">IP</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExceptions.slice(0, 100).map((ex) => {
                    const severity = severityConfig[ex.severity];
                    const Icon = severity.icon;
                    return (
                      <TableRow
                        key={ex.id}
                        className={cn(!ex.resolved && 'bg-amber-50/50 dark:bg-amber-950/10')}
                      >
                        <TableCell className="font-mono text-xs">
                          {format(new Date(ex.created_at), 'PPpp')}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn('gap-1', severity.bgColor, severity.color)}
                            variant="secondary"
                          >
                            <Icon className="h-3 w-3" />
                            {ex.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {ex.error_type}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[300px]">
                            <div className="font-medium truncate" title={ex.message}>
                              {ex.message}
                            </div>
                            {ex.error_code && (
                              <div className="text-xs text-muted-foreground font-mono">
                                {ex.error_code}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            {ex.user && (
                              <div className="flex items-center gap-1">
                                <Shield className="h-3 w-3 text-muted-foreground" />
                                {ex.user.full_name}
                              </div>
                            )}
                            {ex.route && (
                              <div className="flex items-center gap-1">
                                <Activity className="h-3 w-3 text-muted-foreground" />
                                <code className="text-xs truncate max-w-[120px] block">
                                  {ex.http_method} {ex.route}
                                </code>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                          {ex.ip_address || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={ex.resolved ? 'default' : 'secondary'}
                            className={cn(
                              ex.resolved ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : ''
                            )}
                          >
                            {ex.resolved ? 'Resolved' : 'Open'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openException(ex)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleResolve(ex.id, !ex.resolved)}
                                disabled={isResolving}
                              >
                                {ex.resolved ? (
                                  <>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Mark Unresolved
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Mark Resolved
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exception Detail Dialog */}
      <Dialog open={!!selectedException} onOpenChange={(open) => !open && setSelectedException(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedException && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => {
                    const config = severityConfig[selectedException.severity];
                    const Icon = config.icon;
                    return <Icon className={cn('h-5 w-5', config.color)} />;
                  })()}
                  Exception Details
                </DialogTitle>
                <DialogDescription>
                  {selectedException.error_type} - {selectedException.severity.toUpperCase()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Main Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Error Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Message</Label>
                      <p className="text-sm font-medium mt-1">{selectedException.message}</p>
                    </div>
                    {selectedException.error_code && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Error Code</Label>
                        <code className="text-sm block mt-1 bg-muted px-2 py-1 rounded">
                          {selectedException.error_code}
                        </code>
                      </div>
                    )}
                    {selectedException.stack_trace && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Stack Trace</Label>
                        <pre className="text-xs bg-muted p-3 rounded-md mt-1 overflow-x-auto max-h-[200px]">
                          {selectedException.stack_trace}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Context */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Request Context</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Route</Label>
                        <p className="text-sm font-mono">
                          {selectedException.http_method} {selectedException.route || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">IP Address</Label>
                        <p className="text-sm font-mono">{selectedException.ip_address || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">User Agent</Label>
                        <p className="text-sm font-mono text-xs truncate max-w-[250px]" title={selectedException.user_agent || ''}>
                          {selectedException.user_agent || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">User</Label>
                        <p className="text-sm">
                          {selectedException.user?.full_name || selectedException.user_id || 'N/A'}
                        </p>
                      </div>
                    </div>
                    {selectedException.request_body && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Request Body</Label>
                        <pre className="text-xs bg-muted p-3 rounded-md mt-1 overflow-x-auto max-h-[150px]">
                          {JSON.stringify(selectedException.request_body, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selectedException.context && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Additional Context</Label>
                        <pre className="text-xs bg-muted p-3 rounded-md mt-1 overflow-x-auto">
                          {JSON.stringify(selectedException.context, null, 2)}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Resolution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Resolution</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={selectedException.resolved ? 'default' : 'secondary'}>
                        {selectedException.resolved ? 'Resolved' : 'Open'}
                      </Badge>
                      {selectedException.resolved && selectedException.resolver && (
                        <span className="text-sm text-muted-foreground">
                          by {selectedException.resolver.full_name}
                        </span>
                      )}
                    </div>
                    {selectedException.resolved_at && (
                      <div className="text-sm text-muted-foreground">
                        Resolved at: {format(new Date(selectedException.resolved_at), 'PPpp')}
                      </div>
                    )}
                    {selectedException.resolution_notes && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Resolution Notes</Label>
                        <p className="text-sm mt-1 p-3 bg-muted rounded-md">
                          {selectedException.resolution_notes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedException(null)}>
                  Close
                </Button>
                {selectedException.resolved ? (
                  <Button
                    variant="secondary"
                    onClick={() => handleResolve(selectedException.id, false)}
                    disabled={isResolving}
                  >
                    Reopen
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleResolve(selectedException.id, true)}
                    disabled={isResolving}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Resolved
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
