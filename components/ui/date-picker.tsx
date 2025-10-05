import { format } from "date-fns";
import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "./utils";
import { Button, buttonVariants } from "./button";
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
          data-placeholder={date ? "false" : "true"}
          className={cn(
            buttonVariants({ variant: "outline", size: "default" }),
            "h-9 w-full min-w-0 justify-start gap-2 px-3 text-left text-sm font-normal",
            "rounded-md border border-input bg-input-background shadow-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "data-[placeholder=true]:text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          {date ? format(date, formatString) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-auto p-0", popoverClassName)}
        align={align}
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
