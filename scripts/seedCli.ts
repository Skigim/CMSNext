#!/usr/bin/env npx tsx
/**
 * CMSNext Seed Data CLI
 * 
 * Simple command-line interface for generating seed data
 * 
 * Usage:
 *   npx tsx scripts/seedCli.ts [options]
 * 
 * Options:
 *   --cases <number>     Number of cases to generate (default: 25)
 *   --output <path>      Output file path (default: data/seed-data.json)
 *   --preset <name>      Use preset: small, medium, large, stress, demo
 *   --help              Show this help message
 */

import { generateFullSeedData, validateSeedData, seedDataPresets } from './generateSeedData';
import type { CaseData } from '../types/case';

// Command line argument parsing
interface CliOptions {
  cases: number;
  output: string;
  preset?: string;
  help: boolean;
}

const parseArgs = (args: string[]): CliOptions => {
  const options: CliOptions = {
    cases: 25,
    output: 'data/seed-data.json',
    help: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    
    switch (arg) {
      case '--cases':
      case '-c':
        if (nextArg && !isNaN(Number(nextArg))) {
          options.cases = Number(nextArg);
          i++; // Skip next argument
        }
        break;
      case '--output':
      case '-o':
        if (nextArg) {
          options.output = nextArg;
          i++; // Skip next argument
        }
        break;
      case '--preset':
      case '-p':
        if (nextArg) {
          options.preset = nextArg;
          i++; // Skip next argument
        }
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }
  
  return options;
};

const showHelp = () => {
  console.log(`
CMSNext Seed Data Generator

USAGE:
  npx tsx scripts/seedCli.ts [options]

OPTIONS:
  --cases, -c <number>    Number of cases to generate (default: 25)
  --output, -o <path>     Output file path (default: data/seed-data.json)
  --preset, -p <name>     Use preset configuration:
                            small   - 10 cases
                            medium  - 25 cases  
                            large   - 50 cases
                            stress  - 200 cases
                            demo    - 15 curated demo cases
  --help, -h              Show this help message

EXAMPLES:
  # Generate 50 cases to default location
  npx tsx scripts/seedCli.ts --cases 50
  
  # Generate demo data to specific file
  npx tsx scripts/seedCli.ts --preset demo --output demo-data.json
  
  # Generate stress test data
  npx tsx scripts/seedCli.ts --preset stress --output data/stress-test.json

OUTPUT:
  Generated JSON files can be imported into CMSNext using the Import feature
  in the application settings, or loaded directly via the file system API.
`);
};

const generateSeedData = (options: CliOptions): CaseData => {
  let seedData: CaseData;
  
  if (options.preset) {
    console.log(`🎯 Using preset: ${options.preset}`);
    
    switch (options.preset.toLowerCase()) {
      case 'small':
        seedData = seedDataPresets.small();
        break;
      case 'medium':
        seedData = seedDataPresets.medium();
        break;
      case 'large':
        seedData = seedDataPresets.large();
        break;
      case 'stress':
        seedData = seedDataPresets.stress();
        break;
      case 'demo':
        seedData = seedDataPresets.demo();
        break;
      default:
        console.error(`❌ Unknown preset: ${options.preset}`);
        console.error('Available presets: small, medium, large, stress, demo');
        process.exit(1);
    }
  } else {
    console.log(`🌱 Generating ${options.cases} cases...`);
    seedData = generateFullSeedData(options.cases);
  }
  
  return seedData;
};

const saveToFile = async (data: CaseData, outputPath: string): Promise<void> => {
  const fs = await import('fs');
  const path = await import('path');
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    console.log(`📁 Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Write file
  console.log(`💾 Saving to: ${outputPath}`);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  
  // Show file stats
  const stats = fs.statSync(outputPath);
  const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`📊 File size: ${sizeInMB} MB`);
};

const printStats = (data: CaseData): void => {
  const stats = {
    people: data.people.length,
    cases: data.caseRecords.length,
    priorityCases: data.caseRecords.filter(c => c.priority).length,
    financialItems: data.caseRecords.reduce(
      (sum, c) => sum + c.financials.resources.length + c.financials.income.length + c.financials.expenses.length,
      0
    ),
    notes: data.caseRecords.reduce((sum, c) => sum + c.notes.length, 0),
    organizations: new Set(data.people.map(p => p.organizationId)).size,
    casesByStatus: {
      'In Progress': data.caseRecords.filter(c => c.status === 'In Progress').length,
      'Priority': data.caseRecords.filter(c => c.status === 'Priority').length,
      'Review': data.caseRecords.filter(c => c.status === 'Review').length,
      'Completed': data.caseRecords.filter(c => c.status === 'Completed').length,
    }
  };
  
  console.log('\n📈 Generated Data Statistics:');
  console.log(`   👥 People: ${stats.people}`);
  console.log(`   📋 Cases: ${stats.cases}`);
  console.log(`   ⚡ Priority Cases: ${stats.priorityCases}`);
  console.log(`   💰 Financial Items: ${stats.financialItems}`);
  console.log(`   📝 Notes: ${stats.notes}`);
  console.log(`   🏢 Organizations: ${stats.organizations}`);
  console.log('\n📊 Cases by Status:');
  Object.entries(stats.casesByStatus).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`);
  });
};

// Main execution
const main = async () => {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  
  if (options.help) {
    showHelp();
    return;
  }
  
  try {
    // Generate seed data
    const seedData = generateSeedData(options);
    
    // Validate generated data
    console.log('🔍 Validating generated data...');
    const validation = validateSeedData(seedData);
    
    if (!validation.isValid) {
      console.error('❌ Generated seed data is invalid:');
      validation.errors.forEach(error => console.error(`   ${error}`));
      process.exit(1);
    }
    
    // Save to file
    await saveToFile(seedData, options.output);
    
    // Print statistics
    printStats(seedData);
    
    console.log('\n✅ Seed data generated successfully!');
    console.log(`\n💡 To import this data into CMSNext:`);
    console.log(`   1. Open CMSNext in your browser`);
    console.log(`   2. Go to Settings > Data Management`);
    console.log(`   3. Use the Import feature to load: ${options.output}`);
    console.log(`   4. Or copy the file to your CMSNext data directory`);
    
  } catch (error) {
    console.error('❌ Error generating seed data:', error);
    process.exit(1);
  }
};

// Execute if run directly
main().catch(console.error);

export { main as runSeedCli };