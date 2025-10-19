/**
 * Enhanced input sanitization utilities for CMSNext
 * Provides comprehensive XSS prevention and input cleaning
 */

// Comprehensive HTML entity encoding map
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

// Dangerous protocol patterns
const DANGEROUS_PROTOCOLS = [
  /^javascript:/i,
  /^data:/i,
  /^vbscript:/i,
  /^file:/i,
  /^ftp:/i,
  /^tel:/i,
  /^mailto:/i
];

// Dangerous attribute patterns
const DANGEROUS_ATTRIBUTES = [
  /^on\w+/i, // Event handlers like onclick, onload, etc.
  /^style$/i, // Style attribute can contain JavaScript
  /^src$/i,   // Source attributes need validation
  /^href$/i,  // Href attributes need validation
];

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
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // Trim whitespace
  sanitized = sanitized.trim();

  // Apply length limit
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }

  // HTML entity encoding
  sanitized = sanitized.replace(/[&<>"'`=/]/g, (match) => HTML_ENTITIES[match] || match);

  // Handle line breaks
  if (options.preserveLineBreaks) {
    // Convert line breaks to safe HTML
    sanitized = sanitized.replace(/\r?\n/g, '<br>');
  } else {
    // Remove line breaks
    sanitized = sanitized.replace(/\r?\n/g, ' ');
  }

  // Remove dangerous patterns
  sanitized = removeDangerousPatterns(sanitized);

  return sanitized;
}

/**
 * Sanitizes HTML content while preserving safe formatting
 * @param html - Raw HTML input
 * @param allowedTags - List of allowed HTML tags
 * @returns Sanitized HTML
 */
export function sanitizeHTML(
  html: string | null | undefined,
  allowedTags: string[] = ['b', 'i', 'em', 'strong', 'br', 'p']
): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let sanitized = html;

  // Remove script tags and content
  sanitized = sanitized.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  
  // Remove style tags and content
  sanitized = sanitized.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  
  // Remove dangerous tags
  const dangerousTags = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta'];
  dangerousTags.forEach(tag => {
    const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gi');
    sanitized = sanitized.replace(regex, '');
  });

  // Remove tags not in allowed list
  if (allowedTags.length > 0) {
    const allowedPattern = allowedTags.join('|');
    const tagRegex = new RegExp(`<(?!/?(?:${allowedPattern})(?:\\s|>))[^>]+>`, 'gi');
    sanitized = sanitized.replace(tagRegex, '');
  }

  // Remove dangerous attributes
  sanitized = sanitized.replace(/<([^>]+)>/g, (_, tagContent) => {
    const parts = tagContent.split(/\s+/);
    const tagName = parts[0];
    const attributes = parts.slice(1);

    const safeAttributes = attributes.filter((attr: string) => {
      const [attrName] = attr.split('=');
      return !DANGEROUS_ATTRIBUTES.some(pattern => pattern.test(attrName));
    });

    return `<${[tagName, ...safeAttributes].join(' ')}>`;
  });

  // Remove dangerous protocols from URLs
  sanitized = sanitized.replace(/(href|src)=["']([^"']+)["']/gi, (match, attrName, url) => {
    if (DANGEROUS_PROTOCOLS.some(pattern => pattern.test(url))) {
      return `${attrName}="#"`;
    }
    return match;
  });

  return sanitized;
}

/**
 * Sanitizes URL input to prevent malicious redirects
 * @param url - Raw URL input
 * @param allowedDomains - List of allowed domains (optional)
 * @returns Sanitized URL or empty string if dangerous
 */
export function sanitizeURL(
  url: string | null | undefined,
  allowedDomains?: string[]
): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  let sanitized = url.trim();

  // Check for dangerous protocols
  if (DANGEROUS_PROTOCOLS.some(pattern => pattern.test(sanitized))) {
    return '';
  }

  // Ensure URL starts with safe protocol
  if (!/^https?:\/\//i.test(sanitized) && !/^\//.test(sanitized)) {
    // Relative URL or missing protocol - make it relative
    sanitized = '/' + sanitized.replace(/^\/+/, '');
  }

  // Validate domain if allowedDomains is provided
  if (allowedDomains && allowedDomains.length > 0) {
    try {
      const urlObj = new URL(sanitized, window.location.origin);
      const hostname = urlObj.hostname;
      
      if (!allowedDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
        return '';
      }
    } catch {
      // Invalid URL
      return '';
    }
  }

  return sanitized;
}

/**
 * Sanitizes JSON data recursively
 * @param data - Raw JSON data
 * @param options - Sanitization options
 * @returns Sanitized data
 */
export function sanitizeJSON(
  data: any,
  options: {
    maxStringLength?: number;
    maxArrayLength?: number;
    maxObjectKeys?: number;
    preserveLineBreaks?: boolean;
  } = {}
): any {
  const {
    maxStringLength = 10000,
    maxArrayLength = 1000,
    maxObjectKeys = 100,
    preserveLineBreaks = false
  } = options;

  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return sanitizeText(data, { maxLength: maxStringLength, preserveLineBreaks });
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    const limitedArray = data.slice(0, maxArrayLength);
    return limitedArray.map(item => sanitizeJSON(item, options));
  }

  if (typeof data === 'object') {
    const sanitized: any = {};
    const keys = Object.keys(data).slice(0, maxObjectKeys);
    
    for (const key of keys) {
      // Skip dangerous property names
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        continue;
      }
      
      const sanitizedKey = sanitizeText(key, { maxLength: 100 });
      sanitized[sanitizedKey] = sanitizeJSON(data[key], options);
    }
    
    return sanitized;
  }

  return data;
}

/**
 * Removes dangerous patterns from text
 * @param text - Input text
 * @returns Cleaned text
 */
function removeDangerousPatterns(text: string): string {
  return text
    // Remove potential script injection patterns
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/data:application\/javascript/gi, '')
    // Remove event handler patterns
    .replace(/on\w+\s*=/gi, '')
    // Remove expression() patterns (IE CSS expressions)
    .replace(/expression\s*\(/gi, '')
    // Remove import statements
    .replace(/@import/gi, '')
    // Remove CSS url() with javascript
    .replace(/url\s*\(\s*["']?javascript:/gi, '');
}

/**
 * Validates and sanitizes form field input
 * @param value - Raw field value
 * @param fieldType - Type of field for specific validation
 * @returns Sanitized value
 */
export function sanitizeFormField(
  value: any,
  fieldType: 'text' | 'email' | 'phone' | 'ssn' | 'number' | 'textarea' | 'select' = 'text'
): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  switch (fieldType) {
    case 'email':
      // Basic email sanitization
      return sanitizeText(stringValue, { maxLength: 254 }).toLowerCase();
      
    case 'phone':
      // Remove non-numeric characters except parentheses, hyphens, and spaces
      return stringValue.replace(/[^\d\s\-()]/g, '').trim();
      
    case 'ssn':
      // Remove non-numeric characters except hyphens
      return stringValue.replace(/[^\d-]/g, '').trim();
      
    case 'number':
      // Keep only digits, decimal points, and minus signs
      return stringValue.replace(/[^\d.-]/g, '').trim();
      
    case 'textarea':
      return sanitizeText(stringValue, { 
        maxLength: 5000, 
        preserveLineBreaks: true 
      });
      
    case 'select':
      // For select fields, only allow alphanumeric and basic punctuation
      return stringValue.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
      
    case 'text':
    default:
      return sanitizeText(stringValue, { maxLength: 1000 });
  }
}

/**
 * Comprehensive input sanitization for all form data
 * @param formData - Raw form data object
 * @returns Sanitized form data
 */
export function sanitizeFormData(formData: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  // Define field types for specific sanitization
  const fieldTypes: Record<string, 'text' | 'email' | 'phone' | 'ssn' | 'number' | 'textarea' | 'select'> = {
    email: 'email',
    phone: 'phone',
    ssn: 'ssn',
    amount: 'number',
    notes: 'textarea',
    content: 'textarea',
    description: 'textarea',
    status: 'select',
    verificationStatus: 'select',
    category: 'select',
    frequency: 'select',
    priority: 'select'
  };

  for (const [key, value] of Object.entries(formData)) {
    const fieldType = fieldTypes[key] || 'text';
    
    if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeFormData(value);
    } else {
      sanitized[key] = sanitizeFormField(value, fieldType);
    }
  }

  return sanitized;
}

// Export sanitization constants for reference
export const SANITIZATION_LIMITS = {
  MAX_TEXT_LENGTH: 1000,
  MAX_TEXTAREA_LENGTH: 5000,
  MAX_EMAIL_LENGTH: 254,
  MAX_JSON_STRING_LENGTH: 10000,
  MAX_JSON_ARRAY_LENGTH: 1000,
  MAX_JSON_OBJECT_KEYS: 100
} as const;