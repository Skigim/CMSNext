import { format } from "date-fns";
import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "./utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type CalendarProps = React.ComponentProps<typeof Calendar>;

type PopoverAlign = React.ComponentProps<typeof PopoverContent>["align"];

type DatePickerProps = {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  formatString?: string;
  disabled?: boolean;
  align?: PopoverAlign;
  className?: string;
  popoverClassName?: string;
  calendarProps?: Omit<CalendarProps, "mode" | "selected" | "onSelect">;
};

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  formatString = "PPP",
  disabled = false,
  align = "end",
  className,
  popoverClassName,
  calendarProps,
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={date ? undefined : "true"}
          className={cn(
            "flex w-full min-w-[200px] items-center justify-start gap-2 text-left font-normal",
            "data-[empty=true]:text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 opacity-70" aria-hidden="true" />
          {date ? format(date, formatString) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-auto p-0", popoverClassName)} align={align} hidden={disabled}>
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
