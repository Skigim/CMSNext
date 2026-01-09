/**
 * Template Service
 * ================
 * Stateless service for managing templates in file storage.
 * Handles CRUD operations for the unified Template type.
 */

import type { Template, TemplateCategory } from '@/types/template';
import type { FileStorageService } from './FileStorageService';

export interface TemplateServiceDependencies {
  fileStorage: FileStorageService;
}

export class TemplateService {
  private readonly fileStorage: FileStorageService;

  constructor({ fileStorage }: TemplateServiceDependencies) {
    this.fileStorage = fileStorage;
  }

  /**
   * Get all templates from storage.
   */
  async getAllTemplates(): Promise<Template[]> {
    const data = await this.fileStorage.readFileData();
    return data?.templates ?? [];
  }

  /**
   * Get templates filtered by category.
   */
  async getTemplatesByCategory(category: TemplateCategory): Promise<Template[]> {
    const templates = await this.getAllTemplates();
    return templates.filter((t: Template) => t.category === category);
  }

  /**
   * Get a template by ID.
   */
  async getTemplateById(id: string): Promise<Template | null> {
    const templates = await this.getAllTemplates();
    return templates.find((t: Template) => t.id === id) ?? null;
  }

  /**
   * Get summary section template by section key.
   */
  async getSummaryTemplateBySection(sectionKey: string): Promise<Template | null> {
    const templates = await this.getAllTemplates();
    return templates.find(
      (t: Template) => t.category === 'summary' && t.sectionKey === sectionKey
    ) ?? null;
  }

  /**
   * Add a new template.
   * Creates ID and timestamps automatically.
   * 
   * @param templateData - Template data without ID and timestamps
   * @returns The newly created template
   */
  async addTemplate(
    templateData: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Template> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      throw new Error('No file data available');
    }

    const now = new Date().toISOString();
    const newTemplate: Template = {
      ...templateData,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    const templates = data.templates ?? [];
    const updated = [...templates, newTemplate];

    await this.fileStorage.writeNormalizedData({
      ...data,
      templates: updated,
    });

    return newTemplate;
  }

  /**
   * Update an existing template.
   * 
   * @param id - Template ID to update
   * @param updates - Partial template data to merge
   * @returns The updated template, or null if not found
   */
  async updateTemplate(
    id: string,
    updates: Partial<Omit<Template, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Template | null> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      throw new Error('No file data available');
    }

    const templates = data.templates ?? [];
    const index = templates.findIndex((t: Template) => t.id === id);
    
    if (index === -1) {
      return null;
    }

    const updatedTemplate: Template = {
      ...templates[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const updated = [...templates];
    updated[index] = updatedTemplate;

    await this.fileStorage.writeNormalizedData({
      ...data,
      templates: updated,
    });

    return updatedTemplate;
  }

  /**
   * Delete a template by ID.
   * 
   * @param id - Template ID to delete
   * @returns true if deleted, false if not found
   */
  async deleteTemplate(id: string): Promise<boolean> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      throw new Error('No file data available');
    }

    const templates = data.templates ?? [];
    const originalLength = templates.length;
    const updated = templates.filter((t: Template) => t.id !== id);

    if (updated.length === originalLength) {
      return false; // Template not found
    }

    await this.fileStorage.writeNormalizedData({
      ...data,
      templates: updated,
    });

    return true;
  }

  /**
   * Replace all templates (used for bulk operations).
   */
  async setAllTemplates(templates: Template[]): Promise<Template[]> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      throw new Error('No file data available');
    }

    await this.fileStorage.writeNormalizedData({
      ...data,
      templates,
    });

    return templates;
  }

  /**
   * Upsert a summary section template.
   * If a template exists for the section, update it. Otherwise, create it.
   */
  async upsertSummarySectionTemplate(
    sectionKey: string,
    name: string,
    templateContent: string
  ): Promise<Template[]> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      throw new Error('No file data available');
    }

    const templates = data.templates ?? [];
    const existingIndex = templates.findIndex(
      (t: Template) => t.category === 'summary' && t.sectionKey === sectionKey
    );

    const now = new Date().toISOString();
    let updated: Template[];

    if (existingIndex !== -1) {
      // Update existing
      updated = [...templates];
      updated[existingIndex] = {
        ...updated[existingIndex],
        name,
        template: templateContent,
        updatedAt: now,
      };
    } else {
      // Create new
      const newTemplate: Template = {
        id: crypto.randomUUID(),
        name,
        category: 'summary',
        template: templateContent,
        sectionKey: sectionKey as Template['sectionKey'],
        createdAt: now,
        updatedAt: now,
      };
      updated = [...templates, newTemplate];
    }

    await this.fileStorage.writeNormalizedData({
      ...data,
      templates: updated,
    });

    return updated;
  }

  /**
   * Reorder templates by updating sortOrder for each template in the list.
   * 
   * This is a generic utility that works with any template category (vr, summary, narrative).
   * It performs a single write operation to avoid multiple file changes and prevent
   * infinite re-render loops from cascading state updates.
   * 
   * @param templateIds - Array of template IDs in the desired order (can be any category)
   * @returns true if successful
   * 
   * @example
   * // Reorder VR templates
   * await templateService.reorderTemplates(['vr-id-1', 'vr-id-2', 'vr-id-3']);
   * 
   * // Reorder summary section templates
   * await templateService.reorderTemplates(summarySectionIds);
   */
  async reorderTemplates(templateIds: string[]): Promise<boolean> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      throw new Error('No file data available');
    }

    const templates = data.templates ?? [];
    const now = new Date().toISOString();

    // Create a map of id -> new sortOrder
    const orderMap = new Map(templateIds.map((id, index) => [id, index]));

    // Update sortOrder for templates that are in the reorder list
    const updated = templates.map((template: Template) => {
      const newOrder = orderMap.get(template.id);
      if (newOrder !== undefined) {
        return {
          ...template,
          sortOrder: newOrder,
          updatedAt: now,
        };
      }
      return template;
    });

    await this.fileStorage.writeNormalizedData({
      ...data,
      templates: updated,
    });

    return true;
  }
}
