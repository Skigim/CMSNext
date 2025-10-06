"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./utils";
import { buttonVariants } from "./button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const resolvedCaptionLayout = captionLayout ?? "dropdown";

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={resolvedCaptionLayout}
      className={cn(
        "rounded-xl border border-border bg-card p-4 text-foreground shadow-sm",
        className,
      )}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-4",
        caption: "flex items-center justify-between relative pt-1 px-1",
        caption_label: "text-sm font-medium",
        caption_dropdowns: "flex items-center gap-2",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        table: "w-full border-collapse",
  head_row: "w-full",
  head_cell: "w-9 text-center text-muted-foreground font-normal text-[0.8rem]",
  row: "w-full mt-2",
        cell: "h-9 w-9 p-0 text-center text-sm relative focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_range_end:
          "day-range-end aria-selected:bg-primary aria-selected:text-primary-foreground",
        day_selected:
          "bg-primary text-primary-foreground rounded-md hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground rounded-md",
        day_outside: "text-muted-foreground opacity-50",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }: any) => (
          <ChevronLeft className={cn("size-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }: any) => (
          <ChevronRight className={cn("size-4", className)} {...props} />
        ),
      } as any}
      {...props}
    />
  );
}

export { Calendar };
