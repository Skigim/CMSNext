import { useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";

interface UseSubmitShortcutOptions {
  onSubmit: () => void | Promise<void>;
  canSubmit?: boolean;
}

/**
 * Standardizes Ctrl/Cmd+Enter submit behavior for modal forms.
 */
export function useSubmitShortcut<T extends HTMLElement>({
  onSubmit,
  canSubmit = true,
}: Readonly<UseSubmitShortcutOptions>) {
  return useCallback(
    (event: ReactKeyboardEvent<T>) => {
      if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey) || !canSubmit) {
        return;
      }

      event.preventDefault();
      void onSubmit();
    },
    [canSubmit, onSubmit],
  );
}
