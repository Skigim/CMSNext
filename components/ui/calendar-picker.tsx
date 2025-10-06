"use client";

import { format } from "date-fns";
import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "./button";
import { Calendar, type CalendarProps } from "./calendar";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "./utils";

type PopoverAlign = React.ComponentProps<typeof PopoverContent>["align"];

type CalendarPickerCalendarProps = Omit<CalendarProps, "mode" | "selected" | "onSelect"> & {
  className?: string;
};

type CalendarPickerProps = {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  label?: string;
  id?: string;
  placeholder?: string;
  formatString?: string;
  className?: string;
  buttonClassName?: string;
  popoverClassName?: string;
  align?: PopoverAlign;
  disabled?: boolean;
  calendarProps?: CalendarPickerCalendarProps;
};

export function CalendarPicker({
  date,
  onDateChange,
  label = "Select date",
  id,
  placeholder = "Select date",
  formatString = "PPP",
  className,
  buttonClassName,
  popoverClassName,
  align = "start",
  disabled = false,
  calendarProps,
}: CalendarPickerProps) {
  const generatedId = React.useId();
  const fieldId = id ?? `${generatedId}-calendar-picker`;

  const [open, setOpen] = React.useState(false);

  const isDateControlled = date !== undefined;
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(date);

  const mergedCalendarProps = React.useMemo<CalendarPickerCalendarProps>(() => {
    return {
      captionLayout: "dropdown",
      showOutsideDays: true,
      ...calendarProps,
      className: cn("min-w-[17.5rem]", calendarProps?.className),
    };
  }, [calendarProps]);

  React.useEffect(() => {
    if (isDateControlled) {
      setInternalDate(date);
    }
  }, [date, isDateControlled]);

  const displayDate = isDateControlled ? date : internalDate;

  const formattedValue = React.useMemo(() => {
    if (!displayDate) {
      return "";
    }

    try {
      return format(displayDate, formatString);
    } catch (error) {
      console.error("Failed to format date", error);
      return displayDate.toLocaleDateString();
    }
  }, [displayDate, formatString]);

  const handleSelect = React.useCallback(
    (nextDate?: Date) => {
      if (!isDateControlled) {
        setInternalDate(nextDate);
      }

      onDateChange?.(nextDate);

      if (nextDate) {
        setOpen(false);
      }
    },
    [isDateControlled, onDateChange],
  );

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (disabled) {
        setOpen(false);
        return;
      }

      setOpen(nextOpen);
    },
    [disabled],
  );

  const buttonText = formattedValue || placeholder;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Label htmlFor={fieldId} className="px-1">
        {label}
      </Label>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id={fieldId}
            disabled={disabled}
            variant="outline"
            className={cn(
              "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-input-background px-3 text-left text-sm font-normal text-foreground shadow-xs transition-[color,box-shadow] outline-none",
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "data-[placeholder=true]:text-muted-foreground",
              buttonClassName,
            )}
            data-placeholder={formattedValue ? "false" : "true"}
          >
            <span className="truncate">{buttonText}</span>
            <ChevronDownIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn(
            "w-auto overflow-hidden border border-border bg-popover p-0 shadow-lg",
            popoverClassName,
          )}
          align={align}
          hidden={disabled}
        >
          <Calendar
            mode="single"
            selected={displayDate}
            onSelect={handleSelect}
            initialFocus
            {...mergedCalendarProps}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
