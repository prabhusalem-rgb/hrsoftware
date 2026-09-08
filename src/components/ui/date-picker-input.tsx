"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface DatePickerInputProps extends Omit<React.ComponentProps<"input">, "value"> {
  value?: string // Expects YYYY-MM-DD
  error?: string
}

export const DatePickerInput = React.forwardRef<HTMLInputElement, DatePickerInputProps>(
  ({ className, value, onChange, placeholder = "DD/MM/YYYY", ...props }, ref) => {
    const [inputValue, setInputValue] = React.useState("")
    const [isOpen, setIsOpen] = React.useState(false)
    const [isFocused, setIsFocused] = React.useState(false)

    // Sync external value (YYYY-MM-DD) to internal display state (DD/MM/YYYY)
    React.useEffect(() => {
      if (value && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split("-")
        const formatted = `${day}/${month}/${year}`
        if (inputValue !== formatted) {
          setInputValue(formatted)
        }
      } else if (!value) {
        if (!isFocused) {
          setInputValue("")
        }
      }
    }, [value, isFocused])

    // Helper to trigger standard change events
    const triggerChange = (isoValue: string) => {
      if (onChange) {
        const event = {
          target: {
            name: props.name,
            value: isoValue,
          },
        } as React.ChangeEvent<HTMLInputElement>
        onChange(event)
      }
    }

    // Handle typing input smoothly without forced format on every keystroke
    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const targetVal = e.target.value
      setInputValue(targetVal)

      const cleanDigits = targetVal.replace(/\D/g, "")
      
      // Only notify parent when we have a complete 8-digit date string
      if (cleanDigits.length === 8) {
        const parsed = parse(cleanDigits, "ddMMyyyy", new Date())
        if (isValid(parsed)) {
          const isoStr = format(parsed, "yyyy-MM-dd")
          triggerChange(isoStr)
        } else {
          triggerChange("invalid-date")
        }
      } else if (targetVal === "") {
        triggerChange("")
      } else {
        triggerChange("")
      }
    }

    const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      props.onBlur?.(e)
      
      // Format to DD/MM/YYYY on blur if we have a valid 8-digit date
      const cleanDigits = inputValue.replace(/\D/g, "")
      if (cleanDigits.length === 8) {
        const parsed = parse(cleanDigits, "ddMMyyyy", new Date())
        if (isValid(parsed)) {
          const day = cleanDigits.slice(0, 2)
          const month = cleanDigits.slice(2, 4)
          const year = cleanDigits.slice(4, 8)
          setInputValue(`${day}/${month}/${year}`)
        }
      }
    }

    // Handle calendar selection
    const handleCalendarSelect = (selectedDate: Date | undefined) => {
      if (selectedDate) {
        const isoStr = format(selectedDate, "yyyy-MM-dd")
        triggerChange(isoStr)
        setIsOpen(false)
      }
    }

    // Parse current value for calendar active date representation
    const calendarDate = React.useMemo(() => {
      if (value && typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const parsed = parse(value, "yyyy-MM-dd", new Date())
        return isValid(parsed) ? parsed : undefined
      }
      return undefined
    }, [value])

    return (
      <div className="flex relative items-center w-full">
        <Input
          {...props}
          ref={ref}
          type="text"
          value={inputValue}
          onChange={handleTextChange}
          onFocus={(e) => {
            setIsFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className={cn("pr-10 font-mono", className)}
        />
        
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={props.disabled}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <CalendarIcon className="h-4 w-4" />
              <span className="sr-only">Toggle calendar</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-50 bg-white shadow-xl rounded-xl border border-gray-100" align="end">
            <Calendar
              mode="single"
              selected={calendarDate}
              onSelect={handleCalendarSelect}
              initialFocus
              captionLayout="dropdown"
              startMonth={new Date(1950, 0)}
              endMonth={new Date(new Date().getFullYear() + 20, 11)}
            />
          </PopoverContent>
        </Popover>
      </div>
    )
  }
)

DatePickerInput.displayName = "DatePickerInput"
