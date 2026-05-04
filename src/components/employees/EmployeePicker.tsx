'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, User, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Employee } from '@/types';

interface EmployeePickerProps {
  employees: Employee[];
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function EmployeePicker({
  employees,
  selectedId,
  onSelect,
  placeholder = "Select employee...",
  className,
  disabled = false,
}: EmployeePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedEmployee = React.useMemo(
    () => employees.find((emp) => emp.id === selectedId),
    [employees, selectedId]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-between h-12 rounded-2xl border-2 focus:border-indigo-600 transition-all font-bold bg-white text-left px-4",
          className
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <User className="w-4 h-4 text-slate-400 shrink-0" />
          {selectedEmployee ? (
            <span className="truncate">
              {selectedEmployee.name_en} — {selectedEmployee.emp_code}
            </span>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent 
        className="w-[calc(var(--radix-popover-trigger-width)-10px)] md:w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl shadow-2xl border-0 overflow-hidden" 
        align="start"
      >
        <Command className="border-0">
          <CommandInput placeholder="Search by name, code, or department..." className="h-12 border-b" />
          <CommandList className="max-h-[300px] overflow-y-auto no-scrollbar">
            <CommandEmpty className="py-6 text-center text-slate-500">No employee found.</CommandEmpty>
            <CommandGroup className="p-1">
              {employees.map((emp) => (
                <CommandItem
                  key={emp.id}
                  value={`${emp.name_en} ${emp.emp_code} ${emp.department}`}
                  onSelect={() => {
                    onSelect(emp.id);
                    setOpen(false);
                  }}
                  className="py-3 px-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-xl transition-colors data-[selected=true]:bg-indigo-50"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900">{emp.name_en}</span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-tighter">
                      {emp.emp_code} • {emp.designation} • {emp.department}
                    </span>
                  </div>
                  <Check
                    className={cn(
                      "h-4 w-4 text-indigo-600 shrink-0",
                      selectedId === emp.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
