#!/usr/bin/env npx tsx

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

interface ValidationResult {
  file: string;
  exists: boolean;
  readable: boolean;
  error?: string;
}

interface ContextConfig {
  architecture: string[];
  development: string[];
  config: string[];
}

const REQUIRED_FILES: ContextConfig = {
  architecture: [
    'README.md',
    'llms.txt',
    '.github/copilot-instructions.md',
    '.github/instructions/implementation.instructions.md',
    '.github/instructions/frontend.instructions.md',
    '.github/instructions/testing.instructions.md',
    'docs/development/feature-catalogue.md',
    'docs/development/ROADMAP_MAR_2026.md',
  ],
  development: [
    '.github/COMMIT_STYLE.md',
    '.github/implementation-guide.md',
    '.github/ui-guide.md',
    '.github/testing-guide.md',
  ],
  config: [
    'package.json',
    'vite.config.ts',
    'vitest.config.ts',
    'eslint.config.js',
    'components.json',
  ],
};

const OPTIONAL_FILES = [
  '.github/README.md',
  '.github/BRANCHING.md',
  '.github/copilot-prebuild.yml',
  'docs/development/archive/2026/ROADMAP_FEB_2026.md',
];

async function validateFile(filePath: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    file: filePath,
    exists: false,
    readable: false,
  };

  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    await fs.access(fullPath, fs.constants.F_OK);
    result.exists = true;

    await fs.access(fullPath, fs.constants.R_OK);
    result.readable = true;

    const stats = await fs.stat(fullPath);
    if (stats.size === 0) {
      result.error = 'File is empty';
      result.readable = false;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

async function validateSection(
  sectionName: string,
  files: string[],
  required: boolean
): Promise<boolean> {
  console.log(`\n📋 Validating ${sectionName}...`);

  const results = await Promise.all(files.map(validateFile));
  let allValid = true;

  for (const result of results) {
    const icon = getValidationIcon(result.readable, required);
    console.log(`${icon} ${result.file}`);

    if (!result.readable) {
      logValidationIssue(result);

      if (required) {
        allValid = false;
      }
    }
  }

  return allValid;
}

function logValidationIssue(result: ValidationResult): void {
  if (result.exists && result.error) {
    console.log(`   └─ ${result.error}`);
    return;
  }
  if (!result.exists) {
    console.log('   └─ File not found');
  }
}

function getValidationIcon(readable: boolean, required: boolean): string {
  if (readable) {
    return '✅';
  }
  if (required) {
    return '❌';
  }
  return '⚠️';
}

async function checkMCPConfig(): Promise<void> {
  console.log('\n🔌 Checking MCP Configuration...');

  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    console.log('⚠️  Cannot determine home directory');
    return;
  }

  const mcpConfigPath = path.join(homeDir, '.codex', 'config.toml');

  try {
    await fs.access(mcpConfigPath, fs.constants.F_OK);
    const content = await fs.readFile(mcpConfigPath, 'utf-8');

    if (content.includes('[mcp_servers.shadcn]')) {
      console.log('✅ MCP shadcn server configured');
    } else {
      console.log('⚠️  MCP config exists but shadcn server not configured');
      console.log('   Add the following to ~/.codex/config.toml:');
      console.log('   [mcp_servers.shadcn]');
      console.log('   command = "npx"');
      console.log('   args = ["shadcn@latest", "mcp"]');
    }
  } catch {
    console.log('⚠️  MCP config not found at ~/.codex/config.toml');
    console.log('   This is optional but recommended for Codex users');
  }
}

async function validateRequiredSections(): Promise<boolean> {
  const requiredSections: Array<{ name: string; files: string[] }> = [
    { name: 'Architecture Documentation', files: REQUIRED_FILES.architecture },
    { name: 'Development Guidelines', files: REQUIRED_FILES.development },
    { name: 'Configuration Files', files: REQUIRED_FILES.config },
  ];

  let allValid = true;
  for (const section of requiredSections) {
    const isSectionValid = await validateSection(section.name, section.files, true);
    allValid = isSectionValid && allValid;
  }

  return allValid;
}

function logFinalReport(allValid: boolean): void {
  console.log('\n' + '═'.repeat(50));
  if (allValid) {
    console.log('✅ All required agentic context files are valid');
    console.log('\n💡 Next steps:');
    console.log('   1. Review .github/copilot-instructions.md and any matching .github/instructions/*.instructions.md files');
    console.log('   2. Review README.md and .github/README.md for repo entry points and workflow docs');
    console.log('   3. Use conventional commits from .github/COMMIT_STYLE.md');
    return;
  }

  console.log('❌ Some required files are missing or invalid');
  console.log('\n💡 Fix missing files and run this script again');
  process.exit(1);
}

async function generateReport(): Promise<void> {
  console.log('🤖 CMSNext Agentic Context Validation');
  console.log('═'.repeat(50));

  const allValid = await validateRequiredSections();

  // Validate optional files
  await validateSection('Optional Context', OPTIONAL_FILES, false);

  // Check MCP configuration
  await checkMCPConfig();

  logFinalReport(allValid);
}

try {
  await generateReport();
} catch (error) {
  console.error('❌ Validation failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
