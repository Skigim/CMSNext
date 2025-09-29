import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const interactiveHoverClasses =
  "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-md focus-visible:-translate-y-0.5 focus-visible:shadow-md active:translate-y-0 active:scale-100";
