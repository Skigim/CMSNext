import { toast } from "sonner";

/**
 * Clipboard Utilities
 * ===================
 * Cross-browser clipboard operations with fallback support.
 * Handles both modern Clipboard API and legacy execCommand approach.
 * 
 * ## Features
 * 
 * - **Modern Clipboard API**: Uses navigator.clipboard when available
 * - **Legacy Fallback**: Falls back to execCommand for older browsers
 * - **Toast Feedback**: Optional Sonner toast notifications
 * - **Custom Messages**: Configurable success/error messages
 * 
 * ## Browser Support
 * 
 * - Modern: Chrome 63+, Firefox 53+, Safari 13.1+, Edge 79+
 * - Legacy: IE 9+ via execCommand fallback
 * 
 * ## Usage Example
 * 
 * ```typescript
 * const success = await clickToCopy("Copy this text", {
 *   successMessage: "MCN copied!",
 *   showToast: true
 * });
 * ```
 * 
 * @module clipboard
 */

export interface ClickToCopyOptions {
  successMessage?: string;
  errorMessage?: string;
  showToast?: boolean;
  toastApi?: Pick<typeof toast, "success" | "error">;
}

const DEFAULT_SUCCESS_MESSAGE = "Copied to clipboard";
const DEFAULT_ERROR_MESSAGE = "Unable to copy to clipboard";

/**
 * Check if the modern Clipboard API is available.
 * @private
 */
function canUseNavigatorClipboard(): boolean {
  return typeof navigator !== "undefined" && !!navigator.clipboard?.writeText;
}

/**
 * Write to clipboard using the modern Clipboard API.
 * @private
 */
async function writeWithNavigatorClipboard(text: string): Promise<boolean> {
  if (!canUseNavigatorClipboard()) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write to clipboard using legacy execCommand (fallback).
 * Creates a temporary textarea, selects it, and executes copy command.
 * 
 * @private
 * @param {string} text - Text to copy
 * @returns {boolean} True if copy succeeded
 */
function writeWithExecCommand(text: string): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);
  textarea.select();

  let successful = false;
  try {
    successful = document.execCommand("copy");
  } catch {
    successful = false;
  }

  textarea.remove();
  return successful;
}

/**
 * Copy text to clipboard with automatic fallback and toast notifications.
 * 
 * Tries modern Clipboard API first, then falls back to execCommand if needed.
 * Automatically shows success/error toasts unless disabled.
 * 
 * @param {string} text - Text to copy to clipboard
 * @param {ClickToCopyOptions} [options] - Configuration options
 *   - successMessage: Custom success message (default: "Copied to clipboard")
 *   - errorMessage: Custom error message (default: "Unable to copy to clipboard")
 *   - showToast: Enable/disable toast notifications (default: true)
 *   - toastApi: Custom toast implementation (default: Sonner toast)
 * @returns {Promise<boolean>} True if copy succeeded, false otherwise
 */
export async function clickToCopy(
  text: string,
  options: ClickToCopyOptions = {}
): Promise<boolean> {
  const {
    successMessage = DEFAULT_SUCCESS_MESSAGE,
    errorMessage = DEFAULT_ERROR_MESSAGE,
    showToast = true,
    toastApi = toast,
  } = options;

  const usingNavigator = await writeWithNavigatorClipboard(text);

  const success =
    usingNavigator || (!usingNavigator && writeWithExecCommand(text));

  if (success) {
    if (showToast) {
      toastApi?.success?.(successMessage);
    }
    return true;
  }

  if (showToast) {
    toastApi?.error?.(errorMessage);
  }
  return false;
}
