"use client";

import type { CSSProperties } from "react";
import { Toaster as Sonner, ToasterProps } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();
  const toasterTheme = theme.includes('dark') ? 'dark' : 'light';
  const { className, style, toastOptions, ...restProps } = props;

  return (
    <Sonner
      {...restProps}
      theme={toasterTheme as ToasterProps["theme"]}
      className={cn("toaster group", className)}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          ...style,
        } as CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          description: cn(
            "text-muted-foreground",
            toastOptions?.classNames?.description,
          ),
        },
      }}
    />
  );
};

export { Toaster };
