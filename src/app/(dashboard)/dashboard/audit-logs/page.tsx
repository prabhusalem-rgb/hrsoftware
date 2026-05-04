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
import { Calendar } from '@/components/ui/calendar';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import {
  Search, Filter, Calendar as CalendarIcon, Download,
  FileText, Activity, Shield, ChevronDown, Eye, MoreHorizontal,
  X, RefreshCw, User, Building2
} from 'lucide-react';
import { useAuditLogs, useAuditStats } from '@/hooks/queries/useAuditLogs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const actionColors: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  delete: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  process: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  export: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  approve: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  reject: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  login: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  logout: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  hold: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  release: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  mark_paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  mark_failed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  bulk_operation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  default: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
};

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data: logsData, isLoading, refetch } = useAuditLogs({
    action: actionFilter !== 'all' ? actionFilter : undefined,
    entity_type: entityTypeFilter !== 'all' ? entityTypeFilter : undefined,
    user_id: userFilter !== 'all' ? userFilter : undefined,
    start_date: dateRange.from?.toISOString(),
    end_date: dateRange.to?.toISOString(),
    search: search || undefined,
  });

  const { data: statsData } = useAuditStats();

  // Extract unique entity types and users for filters
  const entityTypes = useMemo(() => {
    if (!logsData?.logs) return [];
    const types = new Set(logsData.logs.map(l => l.entity_type));
    return Array.from(types).sort();
  }, [logsData]);

  const users = useMemo(() => {
    if (!logsData?.logs) return [];
    const userMap = new Map<string, string>();
    logsData.logs.forEach(l => {
      if (l.profile) {
        userMap.set(l.user_id, l.profile.full_name || l.profile.email);
      }
    });
    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
  }, [logsData]);

  // Filter logs client-side
  const filteredLogs = useMemo(() => {
    if (!logsData?.logs) return [];
    return logsData.logs;
  }, [logsData]);

  const formatJson = (obj: Record<string, unknown> | null): string => {
    if (!obj) return '-';
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'User', 'Entity Type', 'Entity ID', 'Action', 'IP Address', 'Route'];
    const rows = filteredLogs.map(log => [
      log.created_at,
      log.profile?.full_name || log.user_id,
      log.entity_type,
      log.entity_id,
      log.action,
      log.ip_address || '',
      log.route || '',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Audit logs exported');
  };

  const totalAudits = statsData?.last7Days || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Comprehensive activity tracking for all system operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportToCSV} disabled={filteredLogs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logs (7d)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAudits}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entity Types</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData?.byEntity.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Action Types</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData?.byAction.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Filters</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(actionFilter !== 'all' ? 1 : 0) + (entityTypeFilter !== 'all' ? 1 : 0) + (userFilter !== 'all' ? 1 : 0) + (dateRange.from ? 1 : 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Filter Logs</CardTitle>
              <CardDescription>Search and filter audit activity</CardDescription>
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
                    placeholder="Search logs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="action">Action</Label>
                <Select value={actionFilter} onValueChange={(v) => v && setActionFilter(v)}>
                  <SelectTrigger id="action">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                    <SelectItem value="process">Process</SelectItem>
                    <SelectItem value="export">Export</SelectItem>
                    <SelectItem value="approve">Approve</SelectItem>
                    <SelectItem value="reject">Reject</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="logout">Logout</SelectItem>
                    <SelectItem value="hold">Hold</SelectItem>
                    <SelectItem value="release">Release</SelectItem>
                    <SelectItem value="mark_paid">Mark Paid</SelectItem>
                    <SelectItem value="bulk_operation">Bulk Operation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="entity">Entity Type</Label>
                <Select value={entityTypeFilter} onValueChange={(v) => v && setEntityTypeFilter(v)}>
                  <SelectTrigger id="entity">
                    <SelectValue placeholder="All entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All entities</SelectItem>
                    {entityTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="user">User</Label>
                <Select value={userFilter} onValueChange={(v) => v && setUserFilter(v)}>
                  <SelectTrigger id="user">
                    <SelectValue placeholder="All users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
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
                      {dateRange.from ? format(dateRange.from, 'PP') : 'Start date'}
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
                      {dateRange.to ? format(dateRange.to, 'PP') : 'End date'}
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
                    setActionFilter('all');
                    setEntityTypeFilter('all');
                    setUserFilter('all');
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

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            {filteredLogs.length} log entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs found matching your filters.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="hidden md:table-cell">IP / Route</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.slice(0, 100).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(log.created_at), 'PPpp')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{log.profile?.full_name || 'Unknown'}</div>
                            <div className="text-xs text-muted-foreground">{log.profile?.role}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <Badge variant="outline" className="font-mono">
                            {log.entity_type}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1 font-mono truncate max-w-[120px]">
                            {log.entity_id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            'font-normal capitalize',
                            actionColors[log.action] || actionColors.default
                          )}
                        >
                          {log.action.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {log.old_values && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Before:</span>{' '}
                              <pre className="inline font-mono bg-muted px-1 rounded text-xs">
                                {formatJson(log.old_values)}
                              </pre>
                            </div>
                          )}
                          {log.new_values && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">After:</span>{' '}
                              <pre className="inline font-mono bg-muted px-1 rounded text-xs">
                                {formatJson(log.new_values)}
                              </pre>
                            </div>
                          )}
                          {log.error_code && (
                            <Badge variant="secondary" className="text-xs">
                              {log.error_code}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-xs space-y-1">
                          {log.ip_address && (
                            <div className="font-mono text-muted-foreground">{log.ip_address}</div>
                          )}
                          {log.route && (
                            <div className="font-mono text-muted-foreground truncate max-w-[150px]">
                              {log.http_method} {log.route}
                            </div>
                          )}
                        </div>
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
                            <DropdownMenuItem onClick={() => {
                              navigator.clipboard.writeText(log.id);
                              toast.success('Log ID copied');
                            }}>
                              Copy ID
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(log, null, 2));
                              toast.success('Log data copied');
                            }}>
                              Copy full JSON
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {logsData && logsData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 py-4">
              <p className="text-sm text-muted-foreground">
                Page {logsData.pagination.page} of {logsData.pagination.totalPages}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Action Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(actionColors).map(([action, className]) => (
              <Badge key={action} variant="outline" className={cn('capitalize', className)}>
                {action.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
