"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "./utils";
import { Label } from "./label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { buttonVariants } from "./button";

type CalendarProps = React.ComponentProps<typeof DayPicker>;
type CaptionLayout = NonNullable<CalendarProps["captionLayout"]>;

const NAV_BUTTON_CLASSES = cn(
  buttonVariants({ variant: "ghost", size: "icon" }),
  "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100",
);

const DAY_BUTTON_CLASSES = cn(
  "h-9 w-9 rounded-md p-0 text-sm font-normal aria-selected:opacity-100",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

const BASE_CLASS_NAMES = {
  root: "space-y-3",
  months: "flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0",
  month: "space-y-4",
  caption: "relative flex items-center justify-center pt-1",
  caption_label: "text-sm font-medium",
  caption_dropdowns: "flex items-center justify-center gap-2",
  nav: "flex items-center space-x-1",
  nav_button: NAV_BUTTON_CLASSES,
  nav_button_previous: "absolute left-1",
  nav_button_next: "absolute right-1",
  table: "w-full border-collapse space-y-1",
  head_row: "flex",
  head_cell: "w-9 rounded-md text-[0.75rem] font-normal text-muted-foreground",
  row: "mt-2 flex w-full",
  cell: cn(
    "relative flex size-9 items-center justify-center text-sm",
    "focus-within:relative focus-within:z-20",
    "[&:has([aria-selected].day-outside)]:text-muted-foreground",
    "[&:has([aria-selected].day-outside)]:opacity-50",
  ),
  day: DAY_BUTTON_CLASSES,
  day_range_start: "day-range-start",
  day_range_end: "day-range-end",
  day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
  day_selected:
    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
  day_today: "bg-accent text-accent-foreground",
  day_outside: "text-muted-foreground opacity-50",
  day_disabled: "text-muted-foreground opacity-50",
  day_hidden: "invisible",
  dropdowns: "flex w-full items-center justify-center gap-2",
  dropdown: "flex items-center gap-1",
  dropdown_month:
    "flex items-center gap-1 rounded-md border border-border bg-popover px-2 py-1 text-sm font-medium capitalize text-popover-foreground shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
  dropdown_year:
    "flex items-center gap-1 rounded-md border border-border bg-popover px-2 py-1 text-sm font-medium text-popover-foreground shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
} satisfies CalendarProps["classNames"];

function Calendar({
  className,
  classNames,
  components,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const mergedClassNames = React.useMemo(
    () => ({
      ...BASE_CLASS_NAMES,
      ...classNames,
    }),
    [classNames],
  );

  const mergedComponents = React.useMemo(
    () => ({
      IconLeft: (iconProps: React.ComponentProps<typeof ChevronLeft>) => (
        <ChevronLeft {...iconProps} className={cn("h-4 w-4", iconProps.className)} />
      ),
      IconRight: (iconProps: React.ComponentProps<typeof ChevronRight>) => (
        <ChevronRight {...iconProps} className={cn("h-4 w-4", iconProps.className)} />
      ),
      ...components,
    }),
    [components],
  );

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={mergedClassNames}
      components={mergedComponents}
      {...props}
    />
  );
}

const CAPTION_LAYOUT_OPTIONS: Array<{ value: CaptionLayout; label: string }> = [
  { value: "dropdown", label: "Month and Year" },
  { value: "dropdown-months", label: "Month Only" },
  { value: "dropdown-years", label: "Year Only" },
];

type CalendarSelectorProps = Omit<CalendarProps, "mode" | "selected" | "onSelect" | "defaultMonth" | "captionLayout">;

interface CalendarWithCaptionLayoutSelectorProps {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  captionLayout?: CaptionLayout;
  onCaptionLayoutChange?: (layout: CaptionLayout) => void;
  className?: string;
  selectorLabel?: string;
  calendarProps?: CalendarSelectorProps & { className?: string };
}

function CalendarWithCaptionLayoutSelector(props: CalendarWithCaptionLayoutSelectorProps) {
  const {
    date: controlledDate,
    onDateChange,
    captionLayout: controlledCaptionLayout,
    onCaptionLayoutChange,
    className,
    selectorLabel = "Caption dropdown",
    calendarProps,
  } = props;

  const isDateControlled = Object.prototype.hasOwnProperty.call(props, "date");
  const isCaptionLayoutControlled = Object.prototype.hasOwnProperty.call(props, "captionLayout");

  const [internalDate, setInternalDate] = React.useState<Date | undefined>(() => {
    if (isDateControlled) {
      return controlledDate;
    }

    return new Date();
  });

  React.useEffect(() => {
    if (isDateControlled) {
      setInternalDate(controlledDate);
    }
  }, [controlledDate, isDateControlled]);

  const selectedDate = isDateControlled ? controlledDate : internalDate;

  const [internalCaptionLayout, setInternalCaptionLayout] = React.useState<CaptionLayout>(() => {
    if (isCaptionLayoutControlled && controlledCaptionLayout) {
      return controlledCaptionLayout;
    }

    return "dropdown";
  });

  React.useEffect(() => {
    if (isCaptionLayoutControlled && controlledCaptionLayout) {
      setInternalCaptionLayout(controlledCaptionLayout);
    }
  }, [controlledCaptionLayout, isCaptionLayoutControlled]);

  const activeCaptionLayout = isCaptionLayoutControlled
    ? controlledCaptionLayout ?? "dropdown"
    : internalCaptionLayout;

  const { className: calendarClassName, ...restCalendarProps } = calendarProps ?? {};

  const handleDateChange = React.useCallback(
    (nextDate?: Date) => {
      if (!isDateControlled) {
        setInternalDate(nextDate);
      }

      onDateChange?.(nextDate);
    },
    [isDateControlled, onDateChange],
  );

  const handleCaptionLayoutChange = React.useCallback(
    (nextLayout: CaptionLayout) => {
      if (!isCaptionLayoutControlled) {
        setInternalCaptionLayout(nextLayout);
      }

      onCaptionLayoutChange?.(nextLayout);
    },
    [isCaptionLayoutControlled, onCaptionLayoutChange],
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Calendar
        mode="single"
        defaultMonth={selectedDate ?? new Date()}
        selected={selectedDate}
        onSelect={handleDateChange}
        captionLayout={activeCaptionLayout}
        className={cn(
          "rounded-md border border-border bg-popover text-popover-foreground shadow-sm",
          calendarClassName,
        )}
        {...restCalendarProps}
      />
      <div className="flex flex-col gap-3">
        <Label htmlFor="calendar-caption-layout" className="px-1">
          {selectorLabel}
        </Label>
        <Select
          value={activeCaptionLayout}
          onValueChange={(value) =>
            handleCaptionLayoutChange(value as CaptionLayout)
          }
        >
          <SelectTrigger
            id="calendar-caption-layout"
            size="sm"
            className="w-full bg-popover text-popover-foreground"
          >
            <SelectValue placeholder="Select layout" />
          </SelectTrigger>
          <SelectContent align="center">
            {CAPTION_LAYOUT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export { Calendar, CalendarWithCaptionLayoutSelector };
export type { CaptionLayout, CalendarSelectorProps };

