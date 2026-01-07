/**
 * Summary Section Migration Utility
 * ==================================
 * Converts legacy CategoryConfig.summaryTemplate section templates
 * to the new unified Template system.
 * 
 * Handles:
 * - Placeholder syntax conversion: {{variable}} → {variable}
 * - Creating Template records with proper metadata
 * - Preserving section order and visibility preferences
 */

import type { Template } from '@/types/template';
import type { SummaryTemplateConfig, SummarySectionKey } from '@/types/categoryConfig';
import { DEFAULT_SUMMARY_SECTION_TEMPLATES } from '@/types/template';

/**
 * Section labels for template names
 */
const SECTION_LABELS: Record<SummarySectionKey, string> = {
  notes: 'Notes',
  caseInfo: 'Case Info',
  personInfo: 'Person Info',
  relationships: 'Relationships',
  resources: 'Resources',
  income: 'Income',
  expenses: 'Expenses',
  avsTracking: 'AVS Tracking',
};

/**
 * Convert legacy double-brace placeholders to single-brace format
 * {{variable}} → {variable}
 */
export function convertPlaceholderSyntax(legacyTemplate: string): string {
  return legacyTemplate.replace(/\{\{(\w+)\}\}/g, '{$1}');
}

/**
 * Create a Template object from a section key and template content
 */
export function createSectionTemplate(
  sectionKey: SummarySectionKey,
  templateContent: string,
  isCustom: boolean = false
): Template {
  const now = new Date().toISOString();
  const name = isCustom 
    ? `${SECTION_LABELS[sectionKey]} (Custom)`
    : `${SECTION_LABELS[sectionKey]} (Default)`;
  
  return {
    id: crypto.randomUUID(),
    name,
    category: 'summary',
    template: convertPlaceholderSyntax(templateContent),
    sectionKey,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Check if a template content differs from the default
 */
export function isCustomTemplate(
  sectionKey: SummarySectionKey,
  templateContent: string
): boolean {
  const defaultTemplate = DEFAULT_SUMMARY_SECTION_TEMPLATES[sectionKey];
  // Convert both to single-brace format for comparison
  const normalizedContent = convertPlaceholderSyntax(templateContent);
  const normalizedDefault = convertPlaceholderSyntax(defaultTemplate);
  
  return normalizedContent !== normalizedDefault;
}

/**
 * Migrate all section templates from CategoryConfig to Template records
 * 
 * @param summaryConfig - The legacy summaryTemplate config
 * @returns Array of Template objects ready to be added to storage
 */
export function migrateSummaryTemplates(
  summaryConfig: SummaryTemplateConfig
): Template[] {
  const templates: Template[] = [];
  const { sectionTemplates } = summaryConfig;
  
  // Create templates for each section that has custom content
  for (const sectionKey of Object.keys(sectionTemplates) as SummarySectionKey[]) {
    const templateContent = sectionTemplates[sectionKey];
    
    if (templateContent) {
      const isCustom = isCustomTemplate(sectionKey, templateContent);
      const template = createSectionTemplate(sectionKey, templateContent, isCustom);
      templates.push(template);
    }
  }
  
  return templates;
}

/**
 * Generate default section templates for all sections
 * Useful for initializing a fresh installation
 */
export function generateDefaultSectionTemplates(): Template[] {
  const templates: Template[] = [];
  
  for (const [sectionKey, templateContent] of Object.entries(DEFAULT_SUMMARY_SECTION_TEMPLATES)) {
    const template = createSectionTemplate(
      sectionKey as SummarySectionKey,
      templateContent,
      false
    );
    templates.push(template);
  }
  
  return templates;
}

/**
 * Merge migrated templates with existing templates
 * Avoids duplicates by checking sectionKey
 * 
 * @param existingTemplates - Templates already in storage
 * @param migratedTemplates - Templates from migration
 * @returns Combined array with no duplicates
 */
export function mergeSectionTemplates(
  existingTemplates: Template[],
  migratedTemplates: Template[]
): Template[] {
  // Find existing summary templates by section key
  const existingSectionKeys = new Set(
    existingTemplates
      .filter(t => t.category === 'summary' && t.sectionKey)
      .map(t => t.sectionKey)
  );
  
  // Only add migrated templates that don't already exist
  const newTemplates = migratedTemplates.filter(
    t => !existingSectionKeys.has(t.sectionKey)
  );
  
  return [...existingTemplates, ...newTemplates];
}

/**
 * Check if migration is needed
 * Returns true if CategoryConfig has custom section templates
 */
export function needsSummaryTemplateMigration(
  summaryConfig: SummaryTemplateConfig
): boolean {
  const { sectionTemplates } = summaryConfig;
  
  // Check if any custom templates exist
  for (const sectionKey of Object.keys(sectionTemplates) as SummarySectionKey[]) {
    const templateContent = sectionTemplates[sectionKey];
    if (templateContent && isCustomTemplate(sectionKey, templateContent)) {
      return true;
    }
  }
  
  return false;
}
