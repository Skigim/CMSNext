/**
 * TEMPORARY MIGRATION SCRIPT
 * ==========================
 * Migrates existing vrScripts from CategoryConfig to the new unified Template system.
 * Run once then delete this file.
 * 
 * Usage: npx tsx scripts/migrateTemplates.ts
 * 
 * This reads from your data file, migrates vrScripts to templates array, and writes back.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface VRScript {
  id: string;
  name: string;
  template: string;
  createdAt: string;
  updatedAt: string;
}

interface Template {
  id: string;
  name: string;
  category: 'vr' | 'summary' | 'narrative';
  template: string;
  sectionKey?: string;
  createdAt: string;
  updatedAt: string;
}

interface FileData {
  categoryConfig?: {
    vrScripts?: VRScript[];
    summaryTemplate?: {
      sectionTemplates?: Record<string, string>;
    };
  };
  templates?: Template[];
  [key: string]: unknown;
}

function migrateTemplates(dataFilePath: string): void {
  console.log(`\nReading data from: ${dataFilePath}`);
  
  const content = readFileSync(dataFilePath, 'utf-8');
  const data: FileData = JSON.parse(content);
  
  const existingTemplates: Template[] = data.templates ?? [];
  const vrScripts: VRScript[] = data.categoryConfig?.vrScripts ?? [];
  const sectionTemplates = data.categoryConfig?.summaryTemplate?.sectionTemplates ?? {};
  
  console.log(`Found ${vrScripts.length} VR scripts to migrate`);
  console.log(`Found ${Object.keys(sectionTemplates).length} summary section templates to migrate`);
  console.log(`Existing templates in new system: ${existingTemplates.length}`);
  
  // Check for duplicates by name to avoid re-migrating
  const existingNames = new Set(existingTemplates.map(t => t.name));
  
  const migratedTemplates: Template[] = [];
  
  // Migrate VR scripts
  for (const script of vrScripts) {
    if (existingNames.has(script.name)) {
      console.log(`  Skipping VR script "${script.name}" - already exists`);
      continue;
    }
    
    migratedTemplates.push({
      id: script.id,
      name: script.name,
      category: 'vr',
      template: script.template,
      createdAt: script.createdAt,
      updatedAt: script.updatedAt,
    });
    console.log(`  Migrated VR script: "${script.name}"`);
  }
  
  // Migrate summary section templates (add as VR for now per user request)
  for (const [sectionKey, templateContent] of Object.entries(sectionTemplates)) {
    const name = `Summary: ${sectionKey}`;
    if (existingNames.has(name)) {
      console.log(`  Skipping summary template "${name}" - already exists`);
      continue;
    }
    
    // Convert {{variable}} syntax to {variable} syntax
    const convertedTemplate = templateContent.replace(/\{\{(\w+)\}\}/g, '{$1}');
    
    migratedTemplates.push({
      id: crypto.randomUUID(),
      name,
      category: 'vr', // Put under VR for now, user will move later
      template: convertedTemplate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`  Migrated summary template: "${name}"`);
  }
  
  if (migratedTemplates.length === 0) {
    console.log('\nNo new templates to migrate.');
    return;
  }
  
  // Merge with existing templates
  data.templates = [...existingTemplates, ...migratedTemplates];
  
  // Write back
  const backupPath = dataFilePath.replace('.json', '.backup.json');
  writeFileSync(backupPath, content, 'utf-8');
  console.log(`\nBackup saved to: ${backupPath}`);
  
  writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Updated data file with ${migratedTemplates.length} new templates.`);
  console.log('\nMigration complete! You can now delete this script.');
}

// Get file path from command line or use default
const dataFilePath = process.argv[2];

if (!dataFilePath) {
  console.log(`
Usage: npx tsx scripts/migrateTemplates.ts <path-to-data-file.json>

Example: npx tsx scripts/migrateTemplates.ts ~/Documents/my-cases.json

This script will:
1. Read your existing data file
2. Extract vrScripts from categoryConfig
3. Extract sectionTemplates from summaryTemplate  
4. Convert them to the new Template format
5. Add them under VR Scripts category
6. Save a backup before writing changes
`);
  process.exit(1);
}

try {
  migrateTemplates(dataFilePath);
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}
