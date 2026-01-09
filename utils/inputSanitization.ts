/**
 * Input Sanitization Utilities
 *
 * All core logic has moved to @/domain/common.
 * This file re-exports for backwards compatibility.
 */

export {
  sanitizeText,
  sanitizeHTML,
  sanitizeURL,
  sanitizeJSON,
  sanitizeFormField,
  sanitizeFormData,
  SANITIZATION_LIMITS,
} from "@/domain/common";
