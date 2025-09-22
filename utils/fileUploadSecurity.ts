/**
 * Enhanced file upload security validation
 * Provides comprehensive security checks for file imports
 */

// File size limits (in bytes)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_JSON_DEPTH = 10;
const MAX_ARRAY_LENGTH = 10000;
const MAX_STRING_LENGTH = 10000;
const MAX_OBJECT_KEYS = 1000;

// Dangerous patterns to detect
const DANGEROUS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
  /__proto__/gi,
  /constructor/gi,
  /prototype/gi,
  /function\s*\(/gi,
  /eval\s*\(/gi,
  /setTimeout\s*\(/gi,
  /setInterval\s*\(/gi,
];

// File type validation
const ALLOWED_MIME_TYPES = [
  'application/json',
  'text/plain',
  'text/json'
];

export interface FileSecurityResult {
  isSecure: boolean;
  errors: string[];
  warnings: string[];
  sanitizedData?: any;
}

/**
 * Validates file security before processing
 * @param file - The file to validate
 * @returns Promise<FileSecurityResult>
 */
export async function validateFileUploadSecurity(file: File): Promise<FileSecurityResult> {
  const result: FileSecurityResult = {
    isSecure: true,
    errors: [],
    warnings: []
  };

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    result.errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (50MB)`);
    result.isSecure = false;
  }

  // Check file type
  if (!ALLOWED_MIME_TYPES.includes(file.type) && file.type !== '') {
    result.warnings.push(`Unexpected file type: ${file.type}. Expected JSON file.`);
  }

  // Check file extension
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  if (!['json', 'txt'].includes(fileExtension || '')) {
    result.warnings.push(`Unexpected file extension: .${fileExtension}. Expected .json or .txt`);
  }

  try {
    // Read and validate file content
    const content = await file.text();
    const contentValidation = validateFileContent(content);
    
    result.errors.push(...contentValidation.errors);
    result.warnings.push(...contentValidation.warnings);
    result.sanitizedData = contentValidation.sanitizedData;
    
    if (contentValidation.errors.length > 0) {
      result.isSecure = false;
    }
  } catch (error) {
    result.errors.push('Failed to read file content');
    result.isSecure = false;
  }

  return result;
}

/**
 * Validates and sanitizes JSON content
 * @param content - Raw file content
 * @returns Validation result with sanitized data
 */
function validateFileContent(content: string): Omit<FileSecurityResult, 'isSecure'> & { sanitizedData?: any } {
  const result = {
    errors: [] as string[],
    warnings: [] as string[],
    sanitizedData: undefined as any
  };

  // Check content length
  if (content.length > MAX_FILE_SIZE) {
    result.errors.push('File content exceeds maximum allowed size');
    return result;
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      result.errors.push(`Dangerous content detected: potential script injection`);
      return result;
    }
  }

  // Validate JSON structure
  try {
    const parsedData = JSON.parse(content);
    
    // Check object depth and complexity
    const complexityCheck = validateObjectComplexity(parsedData);
    result.errors.push(...complexityCheck.errors);
    result.warnings.push(...complexityCheck.warnings);
    
    if (complexityCheck.errors.length === 0) {
      // Sanitize the data
      result.sanitizedData = sanitizeObject(parsedData);
    }
    
  } catch (error) {
    result.errors.push('Invalid JSON format');
  }

  return result;
}

/**
 * Validates object complexity to prevent DoS attacks
 * @param obj - Object to validate
 * @param depth - Current recursion depth
 * @returns Validation result
 */
function validateObjectComplexity(obj: any, depth = 0): { errors: string[]; warnings: string[] } {
  const result = { errors: [] as string[], warnings: [] as string[] };

  if (depth > MAX_JSON_DEPTH) {
    result.errors.push(`Object nesting exceeds maximum depth (${MAX_JSON_DEPTH})`);
    return result;
  }

  if (Array.isArray(obj)) {
    if (obj.length > MAX_ARRAY_LENGTH) {
      result.errors.push(`Array length (${obj.length}) exceeds maximum allowed (${MAX_ARRAY_LENGTH})`);
      return result;
    }
    
    for (const item of obj) {
      const itemCheck = validateObjectComplexity(item, depth + 1);
      result.errors.push(...itemCheck.errors);
      result.warnings.push(...itemCheck.warnings);
    }
  } else if (obj && typeof obj === 'object') {
    const keys = Object.keys(obj);
    
    if (keys.length > MAX_OBJECT_KEYS) {
      result.errors.push(`Object has too many keys (${keys.length}), maximum allowed: ${MAX_OBJECT_KEYS}`);
      return result;
    }
    
    for (const key of keys) {
      // Check key security
      if (DANGEROUS_PATTERNS.some(pattern => pattern.test(key))) {
        result.errors.push(`Dangerous property name detected: ${key}`);
        return result;
      }
      
      const value = obj[key];
      if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
        result.warnings.push(`String value too long in property: ${key} (${value.length} chars)`);
      }
      
      const valueCheck = validateObjectComplexity(value, depth + 1);
      result.errors.push(...valueCheck.errors);
      result.warnings.push(...valueCheck.warnings);
    }
  }

  return result;
}

/**
 * Recursively sanitizes an object by removing dangerous properties
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
function sanitizeObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  } else if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Skip dangerous properties
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        continue;
      }
      
      // Sanitize string values
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    
    return sanitized;
  }
  
  return obj;
}

/**
 * Sanitizes string content
 * @param str - String to sanitize
 * @returns Sanitized string
 */
function sanitizeString(str: string): string {
  return str
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/data:text\/html/gi, '') // Remove data HTML
    .replace(/vbscript:/gi, '') // Remove vbscript
    .trim();
}

/**
 * Enhanced validation for imported case data with security checks
 * @param data - Raw imported data
 * @returns Detailed validation result
 */
export function validateImportedCaseDataSecurity(data: any): {
  isValid: boolean;
  isSecure: boolean;
  errors: string[];
  warnings: string[];
  cases: any[];
} {
  const result = {
    isValid: true,
    isSecure: true,
    errors: [] as string[],
    warnings: [] as string[],
    cases: [] as any[]
  };

  try {
    // Ensure data is an array
    const cases = Array.isArray(data) ? data : [data];
    
    if (cases.length === 0) {
      result.errors.push('No case data found');
      result.isValid = false;
      return result;
    }

    if (cases.length > 1000) {
      result.warnings.push(`Large number of cases (${cases.length}). Consider importing in smaller batches.`);
    }

    // Validate each case
    for (let i = 0; i < cases.length; i++) {
      const caseData = cases[i];
      
      // Security validation
      const securityCheck = validateObjectComplexity(caseData);
      if (securityCheck.errors.length > 0) {
        result.errors.push(`Case ${i + 1}: ${securityCheck.errors.join(', ')}`);
        result.isSecure = false;
      }
      result.warnings.push(...securityCheck.warnings.map(w => `Case ${i + 1}: ${w}`));
      
      // Data validation
      const person = caseData.person || caseData;
      if (!person.firstName || typeof person.firstName !== 'string') {
        result.errors.push(`Case ${i + 1}: Missing or invalid firstName`);
        result.isValid = false;
      }
      if (!person.lastName || typeof person.lastName !== 'string') {
        result.errors.push(`Case ${i + 1}: Missing or invalid lastName`);
        result.isValid = false;
      }
      
      // Add sanitized case to results
      result.cases.push(sanitizeObject(caseData));
    }

  } catch (error) {
    result.errors.push('Failed to process case data');
    result.isValid = false;
    result.isSecure = false;
  }

  return result;
}

// Export security constants for reference
export const SECURITY_LIMITS = {
  MAX_FILE_SIZE,
  MAX_JSON_DEPTH,
  MAX_ARRAY_LENGTH,
  MAX_STRING_LENGTH,
  MAX_OBJECT_KEYS,
  ALLOWED_MIME_TYPES
} as const;