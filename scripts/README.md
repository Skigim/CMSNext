# CMSNext Seed Data System - Quick Start Guide

## Overview

The CMSNext seed data system generates realistic sample cases for testing, demonstration, and development. It creates comprehensive data including people, cases, financial items, and notes with proper relationships.

## Quick Commands

```bash
# Generate demo data (15 curated cases)
npm run seed:demo

# Generate small dataset (10 cases)
npm run seed:small

# Generate large dataset (50 cases)
npm run seed:large

# Custom generation
npm run seed -- --cases 25 --output my-data.json

# See all options
npx tsx scripts/seedCli.ts --help
```

## Generated Data Includes

- **People**: Realistic names, addresses, contact info, demographics
- **Cases**: MCN numbers, statuses, types, documentation
- **Financial Data**: Resources, income, expenses with verification
- **Notes**: Categorized case notes with realistic content
- **Relationships**: Proper foreign keys and data integrity

## Using Generated Data

### Option 1: In-App Generation
1. Open CMSNext Settings page
2. Find "Generate Sample Data" section
3. Select preset or custom number
4. Click "Generate Sample Data"
5. Click "Load to File System"

### Option 2: CLI Generation + Import
1. Generate: `npm run seed:demo`
2. Open CMSNext Settings
3. Use Import feature to load `data/seed-data.json`

## Presets

- **Demo** (15 cases): Perfect for screenshots and presentations
- **Small** (10 cases): Quick testing and development
- **Medium** (25 cases): Standard development dataset
- **Large** (50 cases): Comprehensive testing
- **Stress** (200 cases): Performance testing

## File Locations

- **CLI Script**: `scripts/seedCli.ts`
- **Core Generator**: `scripts/generateSeedData.ts`  
- **React Component**: `components/SeedDataGenerator.tsx`
- **Generated Data**: `data/seed-data.json`
- **Documentation**: `docs/SeedDataSystem.md`

## Technical Notes

- Data follows CMSNext filesystem-only architecture
- Validates data integrity before loading
- Supports both download and direct loading
- Optimized for realistic case management scenarios
- TypeScript-typed with proper error handling

## Examples

```bash
# Quick demo setup
npm run seed:demo

# Development testing
npm run seed:small

# Performance testing  
npm run seed -- --preset stress

# Custom output location
npm run seed -- --cases 30 --output test-data.json
```

Generated data is immediately ready for import into CMSNext and follows all existing data patterns and validation rules.