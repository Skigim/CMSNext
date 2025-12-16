/**
 * VR (Verification Request) Generator Utility
 * 
 * Renders VR templates by substituting placeholders with actual data
 * from financial items and case records.
 */

import type { FinancialItem, StoredCase, Person } from "@/types/case";
import type { VRScript, VRRenderContext, RenderedVR, VRPlaceholderField } from "@/types/vr";
import { VR_PLACEHOLDER_FIELDS } from "@/types/vr";
import { formatPhoneNumber } from "@/utils/phoneFormatter";

/**
 * Format a date string for display in VR templates.
 */
function formatDate(dateString?: string): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

/**
 * Format currency for display in VR templates.
 */
function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format an address object as a single string.
 */
function formatAddress(person?: Person): string {
  if (!person?.address) return "";
  const { street, city, state, zip } = person.address;
  const parts = [street, city, state, zip].filter(Boolean);
  return parts.join(", ");
}

/**
 * Get the most recent amount history entry.
 */
function getLatestHistoryEntry(item: FinancialItem) {
  if (!item.amountHistory?.length) return null;
  return [...item.amountHistory].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  )[0];
}

/**
 * Build the render context from a financial item and case data.
 */
export function buildRenderContext(
  item: FinancialItem,
  itemType: "resources" | "income" | "expenses",
  storedCase: StoredCase
): VRRenderContext {
  const { caseRecord, person } = storedCase;
  const latestHistory = getLatestHistoryEntry(item);

  // Get the date to use for "last updated" - prefer history entry date
  const lastUpdatedDate = latestHistory?.startDate || item.dateAdded;
  
  // Get verification date from history if available
  const lastVerifiedDate = latestHistory?.verificationSource 
    ? latestHistory.startDate 
    : undefined;

  return {
    // Financial item fields
    description: item.description || "",
    accountNumber: item.accountNumber || "",
    amount: item.amount,
    location: item.location || "",
    owner: item.owner || "",
    frequency: item.frequency || "",
    verificationStatus: item.verificationStatus || "",
    verificationSource: item.verificationSource || "",
    dateAdded: item.dateAdded || "",
    itemNotes: item.notes || "",
    itemType: itemType.charAt(0).toUpperCase() + itemType.slice(1, -1), // "resources" -> "Resource"
    
    // Amount history fields
    lastUpdated: lastUpdatedDate || "",
    lastVerified: lastVerifiedDate || "",
    historyVerificationSource: latestHistory?.verificationSource || "",
    
    // Case fields
    caseName: person ? `${person.firstName} ${person.lastName}`.trim() : "",
    caseNumber: caseRecord?.mcn || "",
    caseType: caseRecord?.caseType || "",
    applicationDate: caseRecord?.applicationDate || "",
    caseStatus: caseRecord?.status || "",
    
    // Person fields
    clientFirstName: person?.firstName || "",
    clientLastName: person?.lastName || "",
    clientPhone: person?.phone ? formatPhoneNumber(person.phone) : "",
    clientEmail: person?.email || "",
    clientSSN: person?.ssn || "",
    clientDOB: person?.dateOfBirth || "",
    clientAddress: formatAddress(person),
    
    // System
    currentDate: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
}

/**
 * Render a VR template by substituting placeholders with context values.
 * 
 * Placeholders are in the format {fieldName}.
 * Unknown placeholders are left as-is.
 */
export function renderTemplate(template: string, context: VRRenderContext): string {
  return template.replace(/\{(\w+)\}/g, (match, fieldName) => {
    const key = fieldName as VRPlaceholderField;
    
    // Check if it's a valid placeholder
    if (!(key in VR_PLACEHOLDER_FIELDS)) {
      return match; // Leave unknown placeholders as-is
    }
    
    const value = context[key as keyof VRRenderContext];
    
    // Format based on field type
    if (value === undefined || value === null) {
      return "";
    }
    
    // Special formatting for specific fields
    if (key === "amount") {
      return formatCurrency(value as number);
    }
    
    if (key.toLowerCase().includes("date") || key === "lastUpdated" || key === "lastVerified") {
      return formatDate(value as string);
    }
    
    return String(value);
  });
}

/**
 * Render a VR for a specific financial item using a script template.
 */
export function renderVR(
  script: VRScript,
  item: FinancialItem,
  itemType: "resources" | "income" | "expenses",
  storedCase: StoredCase
): RenderedVR {
  const context = buildRenderContext(item, itemType, storedCase);
  const text = renderTemplate(script.template, context);
  
  return {
    itemId: item.id,
    scriptId: script.id,
    text,
  };
}

/**
 * Render multiple VRs and combine them with a separator.
 */
export function renderMultipleVRs(
  script: VRScript,
  items: Array<{ item: FinancialItem; type: "resources" | "income" | "expenses" }>,
  storedCase: StoredCase
): string {
  const renderedVRs = items.map(({ item, type }) => 
    renderVR(script, item, type, storedCase)
  );
  
  return renderedVRs.map(vr => vr.text).join("\n\n-----\n\n");
}

/**
 * Get a list of all available placeholder fields grouped by category.
 */
export function getPlaceholdersByCategory(): Record<string, Array<{ field: VRPlaceholderField; label: string }>> {
  const grouped: Record<string, Array<{ field: VRPlaceholderField; label: string }>> = {};
  
  for (const [field, config] of Object.entries(VR_PLACEHOLDER_FIELDS)) {
    const { category, label } = config;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push({ field: field as VRPlaceholderField, label });
  }
  
  return grouped;
}

/**
 * Create a default VR script.
 */
export function createDefaultVRScript(name: string, template: string = ""): VRScript {
  return {
    id: crypto.randomUUID(),
    name,
    template,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
