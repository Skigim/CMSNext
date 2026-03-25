import { toast } from "sonner";

/**
 * Clipboard Utilities
 * ===================
 * Clipboard operations for supported browsers.
 * CMSNext is Chromium-first, so copy uses the modern Clipboard API.
 * 
 * ## Features
 * 
 * - **Modern Clipboard API**: Uses navigator.clipboard when available
 * - **Toast Feedback**: Optional Sonner toast notifications
 * - **Custom Messages**: Configurable success/error messages
 * 
 * ## Browser Support
 * 
 * - Chrome 63+, Edge 79+, and other browsers exposing navigator.clipboard
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
 * Copy text to clipboard with toast notifications.
 * 
 * Uses the modern Clipboard API supported by CMSNext's target browsers.
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

  const success = await writeWithNavigatorClipboard(text);

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
