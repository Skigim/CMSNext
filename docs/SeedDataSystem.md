# CMSNext Seed Data System

The CMSNext platform includes a comprehensive seed data generation system that creates realistic sample cases for testing, demonstration, and development purposes. This system generates full schemas with proper relationships between people, cases, financial data, and notes.

## Features

- **Realistic Data Generation**: Creates diverse, realistic case management scenarios
- **Full Schema Support**: Generates all data types including people, cases, financial items, and notes
- **Proper Relationships**: Maintains data integrity with correct foreign key relationships
- **Configurable Scale**: Generate anywhere from 10 to 500+ cases
- **Multiple Formats**: CLI tool, React component, and direct API usage
- **Validation**: Built-in validation ensures data integrity

## Quick Start

### Using npm Scripts (Recommended)

```bash
# Generate demo data (15 curated cases)
npm run seed:demo

# Generate small dataset (10 cases)
npm run seed:small

# Generate large dataset (50 cases)
npm run seed:large

# Generate custom number of cases
npm run seed -- --cases 25 --output my-data.json
```

### Using CLI Directly

```bash
# Generate 25 cases (default)
npx tsx scripts/seedCli.ts

# Generate specific number of cases
npx tsx scripts/seedCli.ts --cases 50

# Use presets
npx tsx scripts/seedCli.ts --preset demo

# Custom output location
npx tsx scripts/seedCli.ts --preset large --output data/test-data.json
```

## Generated Data Structure

### People (Person Interface)
- **Personal Information**: First name, last name, email, phone, date of birth, SSN
- **Address Data**: Physical and mailing addresses with proper validation
- **Demographics**: Living arrangements, organizational affiliations, status
- **Relationships**: Family members and authorized representatives

### Cases (CaseRecord Interface)
- **Case Management**: MCN numbers, application dates, case types, status tracking
- **Priority Handling**: Priority flags and specialized processing
- **Financial Data**: Comprehensive resources, income, and expense tracking
- **Notes System**: Categorized notes with timestamps and proper workflow tracking

### Financial Items (FinancialItem Interface)
- **Resources**: Bank accounts, investments, property, vehicles, personal assets
- **Income**: Employment, benefits, pensions, rental income, investments
- **Expenses**: Housing, utilities, healthcare, transportation, daily living costs
- **Verification**: Tracking verification status and sources for compliance

### Notes (Note Interface)
- **Categories**: General, VR Update, Client Contact, Follow-up
- **Content**: Realistic case management scenarios and documentation
- **Timestamps**: Proper creation and update tracking

## Presets

### Demo (15 cases)
Curated dataset perfect for demonstrations and screenshots:
- Mix of all case statuses
- 3 guaranteed priority cases
- Balanced financial scenarios
- Representative workflow examples

### Small (10 cases)
Minimal dataset for quick testing:
- Fast generation and loading
- Essential test scenarios
- Reduced complexity

### Medium (25 cases - Default)
Standard development dataset:
- Good variety of scenarios
- Reasonable file size (~0.15 MB)
- Comprehensive testing coverage

### Large (50 cases)
Comprehensive testing dataset:
- Extensive scenario coverage
- Performance testing capable
- Full feature demonstration

### Stress (200 cases)
Performance and load testing:
- Large dataset simulation
- Memory usage testing
- Bundle size impact analysis

## Integration with CMSNext

### Filesystem Storage
The seed data system is designed to work seamlessly with CMSNext's filesystem-only architecture:

```typescript
import { generateFullSeedData } from './scripts/generateSeedData';
import { fileDataProvider } from './utils/fileDataProvider';

// Generate and load data
const seedData = generateFullSeedData(25);
const dataAPI = fileDataProvider.getAPI();
await dataAPI.loadData(seedData);
```

### React Components
Use the `SeedDataGenerator` component for in-app data generation:

```tsx
import { SeedDataGenerator } from './scripts/seedDataIntegration';

function Settings() {
  return (
    <div>
      <h2>Development Tools</h2>
      <SeedDataGenerator />
    </div>
  );
}
```

### Import Compatibility
Generated JSON files are fully compatible with the existing import system:

1. Generate seed data using any method
2. Open CMSNext Settings → Data Management
3. Use Import feature to load the generated JSON file
4. Data is validated and integrated automatically

## Data Quality

### Realistic Scenarios
- **Names**: Drawn from US Census most common names
- **Addresses**: Realistic street names, cities, and state codes
- **Financial Data**: Appropriate ranges for different income levels
- **Verification Status**: Proper distribution of verification states
- **Notes**: Industry-standard case management documentation

### Data Integrity
- **Unique IDs**: Sequential ID generation with proper prefixes
- **Relationships**: All foreign keys properly maintained
- **Timestamps**: Realistic date progressions
- **Validation**: Built-in validation prevents invalid data generation

### Compliance
- **SSN Format**: Proper format but non-real numbers
- **Phone Numbers**: Valid format with realistic area codes
- **Email Addresses**: Proper format using common domains
- **Financial Amounts**: Realistic ranges for different asset types

## CLI Reference

### Options
- `--cases, -c <number>`: Number of cases to generate (default: 25)
- `--output, -o <path>`: Output file path (default: data/seed-data.json)
- `--preset, -p <name>`: Use preset configuration (small, medium, large, stress, demo)
- `--help, -h`: Show help message

### Examples

```bash
# Basic usage
npx tsx scripts/seedCli.ts

# Generate specific amount
npx tsx scripts/seedCli.ts --cases 100

# Use preset with custom output
npx tsx scripts/seedCli.ts --preset demo --output demo-cases.json

# Large dataset for testing
npx tsx scripts/seedCli.ts --preset stress --output data/load-test.json
```

## Development Usage

### Testing New Features
```bash
# Generate small dataset for quick testing
npm run seed:small

# Load in development server
npm run dev
```

### Performance Testing
```bash
# Generate large dataset
npm run seed:large

# Monitor performance in browser dev tools
# Test bundle loading, rendering, and memory usage
```

### Demo Preparation
```bash
# Generate curated demo data
npm run seed:demo

# Perfect for screenshots, presentations, and demos
# Guaranteed variety and professional appearance
```

## Technical Implementation

### Generation Algorithm
1. **Name Generation**: Random selection from realistic name pools
2. **Address Generation**: Combination of street names, cities, and states
3. **Financial Generation**: Weighted random selection based on realistic ranges
4. **Note Generation**: Template-based content with realistic scenarios
5. **Relationship Mapping**: Proper foreign key assignment and validation

### Performance Considerations
- **Memory Efficient**: Streaming generation for large datasets
- **Fast Execution**: Optimized algorithms for quick generation
- **Validation**: Built-in checks prevent invalid data
- **File Size**: Optimized JSON structure for reasonable file sizes

### Extensibility
The system is designed for easy extension:

```typescript
// Add new financial item types
const NEW_RESOURCE_TYPES = [
  { description: 'Crypto Wallet', range: [100, 50000] },
  { description: 'Art Collection', range: [5000, 100000] }
];

// Add new note categories
const NEW_NOTE_CATEGORIES = ['Legal Update', 'Medical Review'];

// Add new case types
const NEW_CASE_TYPES = ['Emergency Housing', 'Veteran Services'];
```

## Troubleshooting

### Common Issues

**Generation Fails**
- Check TypeScript compilation: `npm run build`
- Verify node version compatibility: Node.js 18+
- Check available disk space for large datasets

**Import Fails**
- Validate generated data structure
- Check file format (must be valid JSON)
- Verify import feature is enabled in settings

**Performance Issues**
- Reduce dataset size for slower systems
- Use preset configurations instead of custom large numbers
- Clear browser cache if loading issues persist

### File Size Guidelines
- Small (10 cases): ~50 KB
- Medium (25 cases): ~150 KB
- Large (50 cases): ~300 KB
- Stress (200 cases): ~1.2 MB

### Best Practices
1. **Start Small**: Begin with demo or small presets
2. **Validate First**: Always validate generated data before loading
3. **Backup Data**: Export existing data before loading seed data
4. **Performance Test**: Monitor browser performance with large datasets
5. **Clean Up**: Remove seed data when moving to production

## Future Enhancements

- **Custom Templates**: User-defined data generation templates
- **Geographic Clustering**: Realistic geographic distribution of cases
- **Seasonal Patterns**: Time-based patterns in case creation
- **Advanced Relationships**: Complex family and organizational structures
- **Export Formats**: Support for additional export formats (CSV, XML)
- **Incremental Updates**: Add cases to existing datasets without replacement