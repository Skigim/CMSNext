/**
 * Input Sanitization Module
 *
 * Pure functions for XSS prevention and input cleaning.
 * No I/O, no side effects.
 *
 * @module domain/common/sanitization
 */

// Comprehensive HTML entity encoding map
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

/**
 * Removes dangerous patterns from text
 */
function removeDangerousPatterns(text: string): string {
  return (
    text
      // Remove potential script injection patterns
      .replaceAll(/javascript:/gi, "")
      .replaceAll(/vbscript:/gi, "")
      .replaceAll(/data:text\/html/gi, "")
      .replaceAll(/data:application\/javascript/gi, "")
      // Remove event handler patterns
      .replaceAll(/on\w+\s*=/gi, "")
      // Remove expression() patterns (IE CSS expressions)
      .replaceAll(/expression\s*\(/gi, "")
      // Remove import statements
      .replaceAll(/@import/gi, "")
      // Remove CSS url() with javascript
      .replaceAll(/url\s*\(\s*["']?javascript:/gi, "")
  );
}

/**
 * Sanitizes text input to prevent XSS attacks
 * @param input - Raw text input
 * @param options - Sanitization options
 * @returns Sanitized text
 */
export function sanitizeText(
  input: string | null | undefined,
  options: {
    allowBasicFormatting?: boolean;
    maxLength?: number;
    preserveLineBreaks?: boolean;
  } = {}
): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  let sanitized = input;

  // Trim whitespace
  sanitized = sanitized.trim();

  // Apply length limit
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }

  // HTML entity encoding
  sanitized = sanitized.replaceAll(
    /[&<>"'`=/]/g,
    (match) => HTML_ENTITIES[match] || match
  );

  // Handle line breaks
  if (options.preserveLineBreaks) {
    // Convert line breaks to safe HTML
    sanitized = sanitized.replaceAll(/\r?\n/g, "<br>");
  } else {
    // Remove line breaks
    sanitized = sanitized.replaceAll(/\r?\n/g, " ");
  }

  // Remove dangerous patterns
  sanitized = removeDangerousPatterns(sanitized);

  return sanitized;
}

/**
 * Sanitizes JSON data recursively
 * @param data - Raw JSON data
 * @param options - Sanitization options
 * @returns Sanitized data
 */
export function sanitizeJSON(
  data: unknown,
  options: {
    maxStringLength?: number;
    maxArrayLength?: number;
    maxObjectKeys?: number;
    preserveLineBreaks?: boolean;
  } = {}
): unknown {
  const {
    maxStringLength = 10000,
    maxArrayLength = 1000,
    maxObjectKeys = 100,
    preserveLineBreaks = false,
  } = options;

  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    return sanitizeText(data, { maxLength: maxStringLength, preserveLineBreaks });
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return data;
  }

  if (Array.isArray(data)) {
    const limitedArray = data.slice(0, maxArrayLength);
    return limitedArray.map((item) => sanitizeJSON(item, options));
  }

  if (typeof data === "object") {
    const sanitized: Record<string, unknown> = {};
    const keys = Object.keys(data as Record<string, unknown>).slice(
      0,
      maxObjectKeys
    );

    for (const key of keys) {
      // Skip dangerous property names
      if (["__proto__", "constructor", "prototype"].includes(key)) {
        continue;
      }

      const sanitizedKey = sanitizeText(key, { maxLength: 100 });
      sanitized[sanitizedKey] = sanitizeJSON(
        (data as Record<string, unknown>)[key],
        options
      );
    }

    return sanitized;
  }

  return data;
}

/**
 * Validates and sanitizes form field input
 * @param value - Raw field value
 * @param fieldType - Type of field for specific validation
 * @returns Sanitized value
 */
export function sanitizeFormField(
  value: unknown,
  fieldType:
    | "text"
    | "email"
    | "phone"
    | "ssn"
    | "number"
    | "textarea"
    | "select" = "text"
): string {
  if (value === null || value === undefined) {
    return "";
  }

  // Handle non-primitive types
  if (typeof value === "object") {
    return "";
  }

  const stringValue = String(value);

  switch (fieldType) {
    case "email":
      // Basic email sanitization
      return sanitizeText(stringValue, { maxLength: 254 }).toLowerCase();

    case "phone":
      // Remove non-numeric characters except parentheses, hyphens, and spaces
      return stringValue.replaceAll(/[^\d\s\-()]/g, "").trim();

    case "ssn":
      // Remove non-numeric characters except hyphens
      return stringValue.replaceAll(/[^\d-]/g, "").trim();

    case "number":
      // Keep only digits, decimal points, and minus signs
      return stringValue.replaceAll(/[^\d.-]/g, "").trim();

    case "textarea":
      return sanitizeText(stringValue, {
        maxLength: 5000,
        preserveLineBreaks: true,
      });

    case "select":
      // For select fields, only allow alphanumeric and basic punctuation
      return stringValue.replaceAll(/[^a-zA-Z0-9\s\-_]/g, "").trim();

    case "text":
    default:
      return sanitizeText(stringValue, { maxLength: 1000 });
  }
}

/**
 * Comprehensive input sanitization for all form data
 * @param formData - Raw form data object
 * @returns Sanitized form data
 */
export function sanitizeFormData(
  formData: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  // Define field types for specific sanitization
  const fieldTypes: Record<
    string,
    "text" | "email" | "phone" | "ssn" | "number" | "textarea" | "select"
  > = {
    email: "email",
    phone: "phone",
    ssn: "ssn",
    amount: "number",
    notes: "textarea",
    content: "textarea",
    description: "textarea",
    status: "select",
    verificationStatus: "select",
    category: "select",
    frequency: "select",
    priority: "select",
  };

  for (const [key, value] of Object.entries(formData)) {
    const fieldType = fieldTypes[key] || "text";

    if (typeof value === "object" && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeFormData(value as Record<string, unknown>);
    } else {
      sanitized[key] = sanitizeFormField(value, fieldType);
    }
  }

  return sanitized;
}
