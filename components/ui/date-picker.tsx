import { format } from "date-fns";
import * as React from "react";

import { cn } from "./utils";
import { Input } from "./input";

type InputProps = React.ComponentProps<typeof Input>;

type DatePickerProps = {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  formatString?: string;
} & Omit<InputProps, "type" | "value" | "onChange" | "defaultValue">;

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Select date",
  formatString = "PPP",
  className,
  disabled,
  title,
  ...inputProps
}: DatePickerProps) {
  const isoValue = React.useMemo(() => {
    if (!date) {
      return "";
    }

    try {
      return format(date, "yyyy-MM-dd");
    } catch (error) {
      console.error("Failed to format date", error);
      return "";
    }
  }, [date]);

  const displayTitle = React.useMemo(() => {
    if (!date) {
      return undefined;
    }

    try {
      return format(date, formatString);
    } catch {
      return undefined;
    }
  }, [date, formatString]);

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { value } = event.currentTarget;
      if (!value) {
        onDateChange(undefined);
        return;
      }

      const nextValue = event.currentTarget.valueAsDate;
      if (!nextValue) {
        onDateChange(undefined);
        return;
      }

      // Normalise to midnight to align with case info inputs
      const normalized = new Date(nextValue);
      normalized.setHours(0, 0, 0, 0);
      onDateChange(normalized);
    },
    [onDateChange],
  );

  return (
    <Input
      type="date"
      value={isoValue}
      placeholder={placeholder}
      onChange={handleChange}
      disabled={disabled}
      className={cn(className)}
      title={title ?? displayTitle}
      {...inputProps}
    />
  );
}
