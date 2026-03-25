"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { Badge } from "./badge";
import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export type MultiSelectOption = {
  label: string;
  value: string;
};

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

function getTriggerLabel(
  selectedOptions: MultiSelectOption[],
  placeholder: string,
): string {
  if (selectedOptions.length === 0) {
    return placeholder;
  }

  if (selectedOptions.length === 1) {
    return selectedOptions[0]?.label ?? placeholder;
  }

  return `${selectedOptions.length} selected`;
}

const MultiSelect = React.forwardRef<HTMLButtonElement, MultiSelectProps>(
  (
    {
      options,
      value,
      onValueChange,
      placeholder = "Select options",
      searchPlaceholder = "Search options...",
      emptyText = "No results found.",
      ariaLabel,
      disabled = false,
      className,
    },
    ref,
  ) => {
    const selectedOptions = React.useMemo(
      () => options.filter((option) => value.includes(option.value)),
      [options, value],
    );

    const triggerLabel = React.useMemo(
      () => getTriggerLabel(selectedOptions, placeholder),
      [placeholder, selectedOptions],
    );

    const handleSelect = React.useCallback(
      (optionValue: string) => {
        if (disabled) {
          return;
        }

        const isSelected = value.includes(optionValue);
        const nextValue = isSelected
          ? value.filter((currentValue) => currentValue !== optionValue)
          : [...value, optionValue];

        onValueChange(nextValue);
      },
      [disabled, onValueChange, value],
    );

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-label={ariaLabel ?? triggerLabel}
            className={cn(
              "h-7 w-full justify-between gap-2 px-2.5 text-xs font-normal shadow-none",
              selectedOptions.length === 0 && "text-muted-foreground",
              className,
            )}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
              <span className="truncate">{triggerLabel}</span>
              {selectedOptions.length > 1 ? (
                <Badge
                  variant="secondary"
                  className="h-5 shrink-0 px-1.5 text-[10px] font-medium"
                >
                  {selectedOptions.length}
                </Badge>
              ) : null}
            </span>
            <ChevronDownIcon className="size-3.5 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-label={ariaLabel ?? placeholder}
          className="w-[var(--radix-popover-trigger-width)] min-w-52 p-0"
        >
          <Command>
            <div className="border-b py-1">
              <CommandInput placeholder={searchPlaceholder} />
            </div>
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = value.includes(option.value);

                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      keywords={[option.label, option.value]}
                      onSelect={handleSelect}
                      className="justify-between gap-3 py-2 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "border-muted-foreground/30 flex size-4 shrink-0 items-center justify-center rounded-sm border",
                            isSelected &&
                              "border-primary bg-primary text-primary-foreground",
                          )}
                        >
                          <CheckIcon
                            className={cn(
                              "size-3",
                              isSelected ? "opacity-100" : "opacity-0",
                            )}
                          />
                        </span>
                        <span className="truncate">{option.label}</span>
                      </span>
                      {isSelected ? (
                        <Badge
                          variant="secondary"
                          className="h-5 shrink-0 px-1.5 text-[10px] font-medium"
                        >
                          Selected
                        </Badge>
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);

MultiSelect.displayName = "MultiSelect";

export { MultiSelect };
