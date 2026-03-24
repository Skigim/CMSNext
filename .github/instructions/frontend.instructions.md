---
description: "Use when changing React components, app shells, or styles. Covers shadcn/ui usage, Tailwind patterns, accessibility, and visual verification."
applyTo: "App.tsx,main.tsx,components/**/*.ts,components/**/*.tsx,styles/**/*.css"
---

# Frontend Instructions

- Keep components UI-focused: do not move business logic into React components when it belongs in hooks, services, or domain functions.
- Build UI with existing shadcn/ui primitives and Tailwind utility classes; prefer theme tokens and existing CSS variables over hard-coded colors.
- Use Sonner toasts for feedback instead of `alert()`, `confirm()`, or custom browser-dialog fallbacks.
- For constrained dropdowns and popovers that need scrolling, use the bounded `ScrollArea` pattern documented in `.github/ui-guide.md`.
- Preserve accessibility requirements such as dialog titles/descriptions, keyboard navigation, and semantic markup.
- When adding or changing interactive UI, add or update React Testing Library coverage and include `jest-axe` checks where the repo already expects them.
- Visually verify UI changes in a supported Chromium-based environment before considering the task complete.
