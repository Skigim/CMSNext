"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { Badge } from "./badge";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { cn } from "./utils";

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
  onCloseAutoFocus?: React.ComponentProps<typeof DropdownMenuContent>["onCloseAutoFocus"];
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function focusAdjacentElement(
  currentElement: HTMLElement,
  direction: "next" | "previous",
): void {
  const document = currentElement.ownerDocument;
  const focusableElements = Array.from(
    document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true",
  );

  const currentIndex = focusableElements.indexOf(currentElement);
  if (currentIndex === -1) {
    return;
  }

  const offset = direction === "next" ? 1 : -1;
  const adjacentElement = focusableElements[currentIndex + offset];

  adjacentElement?.focus();
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
      ariaLabel,
      disabled = false,
      className,
      onCloseAutoFocus,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    const shouldSkipCloseAutoFocusRef = React.useRef(false);

    const selectedOptions = React.useMemo(
      () => options.filter((option) => value.includes(option.value)),
      [options, value],
    );

    const triggerLabel = React.useMemo(
      () => getTriggerLabel(selectedOptions, placeholder),
      [placeholder, selectedOptions],
    );
    const triggerAriaLabel = ariaLabel
      ? `${ariaLabel}: ${triggerLabel}`
      : triggerLabel;

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

    const handleTriggerRef = React.useCallback(
      (element: HTMLButtonElement | null) => {
        triggerRef.current = element;

        if (typeof ref === "function") {
          ref(element);
          return;
        }

        if (ref) {
          ref.current = element;
        }
      },
      [ref],
    );

    return (
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={handleTriggerRef}
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-label={triggerAriaLabel}
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
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-52 p-1"
          onKeyDownCapture={(event) => {
            if (event.key === "Tab") {
              shouldSkipCloseAutoFocusRef.current = true;
              event.preventDefault();
              setOpen(false);

              if (triggerRef.current) {
                focusAdjacentElement(
                  triggerRef.current,
                  event.shiftKey ? "previous" : "next",
                );
              }
            }
          }}
          onCloseAutoFocus={(event) => {
            if (shouldSkipCloseAutoFocusRef.current) {
              shouldSkipCloseAutoFocusRef.current = false;
              event.preventDefault();
              return;
            }

            onCloseAutoFocus?.(event);
          }}
        >
          {options.map((option) => {
            const isSelected = value.includes(option.value);

            return (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={isSelected}
                className="gap-3 py-2 text-xs"
                onSelect={(event) => {
                  event.preventDefault();
                  handleSelect(option.value);
                }}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? (
                  <Badge
                    variant="secondary"
                    className="ml-auto h-5 shrink-0 px-1.5 text-[10px] font-medium"
                  >
                    Selected
                  </Badge>
                ) : null}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);

MultiSelect.displayName = "MultiSelect";

export { MultiSelect };
