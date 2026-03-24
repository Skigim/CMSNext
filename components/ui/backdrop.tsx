"use client";

import * as React from "react";

import { cn } from "./utils";

const Backdrop = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="backdrop"
    className={cn("fixed inset-0", className)}
    {...props}
  />
));
Backdrop.displayName = "Backdrop";

const BackdropLayer = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="backdrop-layer"
    className={cn("absolute inset-0", className)}
    {...props}
  />
));
BackdropLayer.displayName = "BackdropLayer";

const BackdropGlow = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="backdrop-glow"
    className={cn("rounded-full blur-3xl", className)}
    {...props}
  />
));
BackdropGlow.displayName = "BackdropGlow";

export { Backdrop, BackdropGlow, BackdropLayer };