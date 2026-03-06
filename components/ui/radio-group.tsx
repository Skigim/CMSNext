"use client";

import * as React from "react";

import { cn } from "./utils";

interface RadioGroupContextValue {
  disabled?: boolean;
  name: string;
  onValueChange?: (value: string) => void;
  value?: string;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  name?: string;
  onValueChange?: (value: string) => void;
  value?: string;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, disabled, name, onValueChange, value, ...props }, ref) => {
    const generatedName = React.useId();
    const contextValue = React.useMemo(
      () => ({
        disabled,
        name: name ?? generatedName,
        onValueChange,
        value,
      }),
      [disabled, generatedName, name, onValueChange, value],
    );

    return (
      <RadioGroupContext.Provider value={contextValue}>
        <div
          ref={ref}
          data-slot="radio-group"
          role="radiogroup"
          className={cn("grid gap-2", className)}
          {...props}
        />
      </RadioGroupContext.Provider>
    );
  },
);

RadioGroup.displayName = "RadioGroup";

interface RadioGroupItemProps
  extends Omit<React.ComponentPropsWithoutRef<"input">, "type" | "value"> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ checked, className, disabled, id, name, onChange, value, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <input
        ref={ref}
        id={inputId}
        type="radio"
        data-slot="radio-group-item"
        name={context?.name ?? name}
        value={value}
        checked={context ? context.value === value : checked}
        disabled={disabled ?? context?.disabled}
        onChange={(event) => {
          if (event.target.checked) {
            context?.onValueChange?.(value);
          }
          onChange?.(event);
        }}
        className={cn(
          "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 size-4 shrink-0 accent-current outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };