#!/usr/bin/env npx tsx

import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';

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
    '.github/copilot-instructions.md',
    'docs/development/feature-catalogue.md',
    'docs/development/actionable-roadmap.md',
  ],
  development: [
    '.github/COMMIT_STYLE.md',
    'docs/development/testing-infrastructure.md',
  ],
  config: [
    'vite.config.ts',
    'vitest.config.ts',
    'eslint.config.js',
    'tailwind.config.js',
  ],
};

const OPTIONAL_FILES = [
  'docs/development/claude-codex-workflow.md',
  'docs/development/performance-metrics.md',
  '.github/copilot-prebuild.yml',
  '.github/AGENTIC_PROMPTS_GUIDE.md',
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
    const icon = result.readable ? '✅' : required ? '❌' : '⚠️';
    console.log(`${icon} ${result.file}`);

    if (!result.readable) {
      if (result.exists && result.error) {
        console.log(`   └─ ${result.error}`);
      } else if (!result.exists) {
        console.log(`   └─ File not found`);
      }

      if (required) {
        allValid = false;
      }
    }
  }

  return allValid;
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

async function generateReport(): Promise<void> {
  console.log('🤖 CMSNext Agentic Context Validation');
  console.log('═'.repeat(50));

  let allValid = true;

  // Validate required files
  allValid =
    (await validateSection(
      'Architecture Documentation',
      REQUIRED_FILES.architecture,
      true
    )) && allValid;

  allValid =
    (await validateSection(
      'Development Guidelines',
      REQUIRED_FILES.development,
      true
    )) && allValid;

  allValid =
    (await validateSection('Configuration Files', REQUIRED_FILES.config, true)) &&
    allValid;

  // Validate optional files
  await validateSection('Optional Context', OPTIONAL_FILES, false);

  // Check MCP configuration
  await checkMCPConfig();

  // Final report
  console.log('\n' + '═'.repeat(50));
  if (allValid) {
    console.log('✅ All required agentic context files are valid');
    console.log('\n💡 Next steps:');
    console.log('   1. Review .github/AGENTIC_PROMPTS_GUIDE.md for prompt templates');
    console.log('   2. Ensure AI agents read .github/copilot-instructions.md');
    console.log('   3. Use conventional commits from .github/COMMIT_STYLE.md');
  } else {
    console.log('❌ Some required files are missing or invalid');
    console.log('\n💡 Fix missing files and run this script again');
    process.exit(1);
  }
}

// Run validation
generateReport().catch((error) => {
  console.error('❌ Validation failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
