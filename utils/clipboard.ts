import { toast } from "sonner";

export interface ClickToCopyOptions {
  successMessage?: string;
  errorMessage?: string;
  showToast?: boolean;
  toastApi?: Pick<typeof toast, "success" | "error">;
}

const DEFAULT_SUCCESS_MESSAGE = "Copied to clipboard";
const DEFAULT_ERROR_MESSAGE = "Unable to copy to clipboard";

function canUseNavigatorClipboard(): boolean {
  return typeof navigator !== "undefined" && !!navigator.clipboard?.writeText;
}

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

  document.body.removeChild(textarea);
  return successful;
}

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
