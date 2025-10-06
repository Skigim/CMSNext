import { format } from "date-fns";
import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "./utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Calendar } from "./calendar";

type CalendarProps = React.ComponentProps<typeof Calendar>;
type PopoverAlign = React.ComponentProps<typeof PopoverContent>["align"];

type DatePickerProps = {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  formatString?: string;
  align?: PopoverAlign;
  className?: string;
  popoverClassName?: string;
  disabled?: boolean;
  calendarProps?: Omit<CalendarProps, "mode" | "selected" | "onSelect">;
};

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Select a date",
  formatString = "PPP",
  align = "end",
  className,
  popoverClassName,
  disabled = false,
  calendarProps,
}: DatePickerProps) {
  const formattedValue = React.useMemo(() => {
    if (!date) {
      return "";
    }

    try {
      return format(date, formatString);
    } catch (error) {
      console.error("Failed to format date", error);
      return "";
    }
  }, [date, formatString]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-9 w-full min-w-0 items-center justify-start gap-2 rounded-md border border-input bg-input-background px-3 text-left text-sm font-normal text-foreground shadow-xs transition-[color,box-shadow] outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "data-[placeholder=true]:text-muted-foreground",
            className,
          )}
          data-placeholder={formattedValue ? "false" : "true"}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">
            {formattedValue || placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn("w-auto p-0", popoverClassName)}
        hidden={disabled}
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={onDateChange}
          initialFocus
          {...calendarProps}
        />
      </PopoverContent>
    </Popover>
  );
}
