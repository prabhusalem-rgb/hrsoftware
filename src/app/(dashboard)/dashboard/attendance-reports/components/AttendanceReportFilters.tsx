'use client';

// ============================================================
// Attendance Report Filters Component
// Month/Year selector, Project multi-select, Generate button
// ============================================================

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Loader2, Calendar as CalendarIcon, AlertCircle, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AttendanceReportFilters, Project, Company } from '@/types';
import { useProjects } from '@/hooks/queries/useProjects';
import { useCompanies } from '@/hooks/queries/useCompanies';

interface Props {
  filters: AttendanceReportFilters & { company_id?: string };
  onChange: (filters: Partial<AttendanceReportFilters & { company_id?: string }>) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  isSuperAdmin?: boolean;
  activeCompanyId?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function AttendanceReportFilters({
  filters,
  onChange,
  onGenerate,
  isGenerating,
  isSuperAdmin = false,
  activeCompanyId,
}: Props) {
  const [projectOpen, setProjectOpen] = useState(false);

  // Ensure project_ids is always an array for safe operations
  const safeProjectIds = useMemo(() => Array.isArray(filters.project_ids) ? filters.project_ids : [], [filters.project_ids]);

  // Determine which company ID to use for project filtering
  // Super admin: uses selected company from filters; others: use their activeCompanyId
  const projectFilterCompanyId = isSuperAdmin ? (filters.company_id || undefined) : activeCompanyId;

  // Fetch projects - for super admin, filter by selected company; for others, by their active company
  const { data: projects = [], isLoading: projectsLoading } = useProjects(projectFilterCompanyId);

  // Fetch companies for super admin
  const { data: companies = [] } = useCompanies();

  // Prepare project options
  const projectOptions = useMemo(() => {
    return projects.map((p: Project) => ({
      value: p.id,
      label: p.name,
    }));
  }, [projects]);

  // Selected project labels
  const selectedProjectLabels = useMemo(() => {
    return safeProjectIds
      .map(id => projectOptions.find(o => o.value === id)?.label)
      .filter(Boolean) as string[];
  }, [safeProjectIds, projectOptions]);

  // Year range (current year - 5 to current year + 1)
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => currentYear - 5 + i);
  }, [currentYear]);

  // Toggle project selection
  const toggleProject = (projectId: string) => {
    const currentIds = Array.isArray(filters.project_ids) ? filters.project_ids : [];
    const newSelection = currentIds.includes(projectId)
      ? currentIds.filter(id => id !== projectId)
      : [...currentIds, projectId];
    onChange({ project_ids: newSelection });
  };

  // Clear all filters
  const clearFilters = () => {
    onChange({
      project_ids: [],
      employee_ids: [],
      ...(isSuperAdmin && { company_id: undefined }),
    });
  };

  // Handle company change for super admin
  const handleCompanyChange = (companyId: string | null) => {
    onChange({ company_id: companyId || undefined, project_ids: [] }); // Reset projects when company changes
  };

  return (
    <CardContent className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Company Selector - Only for Super Admin */}
        {isSuperAdmin && (
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Select
              value={filters.company_id || ''}
              onValueChange={handleCompanyChange}
            >
              <SelectTrigger id="company">
                <SelectValue placeholder="Select company">
                  {filters.company_id && companies.length > 0
                    ? companies.find(c => c.id === filters.company_id)?.name_en || 'Select company'
                    : 'Select company'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {companies.map((company: Company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Month Selector */}
        <div className="space-y-2">
          <Label htmlFor="month">Month</Label>
          <Select
            value={String(filters.month)}
            onValueChange={(value) => {
              if (value) onChange({ month: parseInt(value) });
            }}
          >
            <SelectTrigger id="month">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((month, index) => (
                <SelectItem key={month} value={String(index + 1)}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Year Selector */}
        <div className="space-y-2">
          <Label htmlFor="year">Year</Label>
          <Select
            value={String(filters.year)}
            onValueChange={(value) => {
              if (value) onChange({ year: parseInt(value) });
            }}
          >
            <SelectTrigger id="year">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Project Multi-Select */}
        <div className="space-y-2">
          <Label>Projects</Label>
          <Popover open={projectOpen} onOpenChange={setProjectOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={projectOpen}
                className="w-full justify-between h-10"
                disabled={isSuperAdmin && !filters.company_id}
              >
                {safeProjectIds.length > 0
                  ? `${selectedProjectLabels.length} project${selectedProjectLabels.length > 1 ? 's' : ''} selected`
                  : 'Select projects...'}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Search projects..." />
                <CommandList>
                  <CommandEmpty>No projects found.</CommandEmpty>
                  <CommandGroup>
                    {projectOptions.map(option => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => {
                          toggleProject(option.value);
                          setProjectOpen(true);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            safeProjectIds.includes(option.value)
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
              {safeProjectIds.length > 0 && (
                <div className="border-t p-2 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {safeProjectIds.length} selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange({ project_ids: [] })}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          {selectedProjectLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedProjectLabels.slice(0, 3).map((label, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {label}
                </Badge>
              ))}
              {selectedProjectLabels.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{selectedProjectLabels.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Include Exited Toggle */}
        <div className="space-y-2">
          <Label>Options</Label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.include_exited || false}
                onChange={(e) => onChange({ include_exited: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              Include exited employees
            </label>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-4 border-t">
        <Button
          onClick={onGenerate}
          disabled={
            isGenerating ||
            safeProjectIds.length === 0 ||
            !filters.month ||
            !filters.year ||
            (isSuperAdmin && !filters.company_id)
          }
          className="gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <CalendarIcon className="h-4 w-4" />
              Generate Report
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={clearFilters}
          disabled={isGenerating}
        >
          Clear Filters
        </Button>

        {safeProjectIds.length === 0 && (
          <span className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            Select at least one project
          </span>
        )}
        {isSuperAdmin && !filters.company_id && (
          <span className="text-sm text-amber-600 flex items-center gap-1">
            <Building2 className="h-4 w-4" />
            Select a company
          </span>
        )}
      </div>
    </CardContent>
  );
}
