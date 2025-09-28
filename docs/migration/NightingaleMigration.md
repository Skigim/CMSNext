# Nightingale Data Migration

The case tracking platform now supports automatic migration of Nightingale data format during the upload process.

## Features

### Automatic Detection
- The JsonUploader automatically detects when uploaded JSON files are in Nightingale format
- Shows a "🔄 Nightingale Migration" badge when detected
- Provides clear warnings about the migration process

### Migration Process
1. **Detection**: System checks for Nightingale format markers (`people`, `caseRecords`/`cases`, `organizations` arrays)
2. **Validation**: Ensures the data structure is valid and contains processable records  
3. **Migration**: Automatically converts the data to platform format during import
4. **Import**: Processed cases are imported using the standard import workflow

### Key Transformations

#### Address Structure
- ✅ Handles both `zip` and `zipCode` field formats
- ✅ Converts `zip` to `zipCode` for platform compatibility

#### Date Fields  
- ✅ Converts `dateOpened` → `applicationDate`
- ✅ Converts `lastUpdated` → `updatedDate`
- ✅ Normalizes all dates to ISO format

#### Status Normalization
- ✅ Maps various status strings to the platform status enum:
  - `approve` / `complete` / `close` → `Approved`
  - `deny` / `reject` → `Denied`
  - `spend` / `spenddown` → `Spenddown`
  - any other value → `Pending`

#### Data Types
- ✅ Converts priority strings to boolean values
- ✅ Ensures all required fields have proper defaults
- ✅ Maintains financial item structure (resources, income, expenses)

## Usage

### Through Upload Interface
1. Navigate to Settings → Data Import
2. Select your Nightingale JSON file
3. System automatically detects the format and shows migration badge
4. Click "Migrate & Import X Cases" to process the data
5. Monitor progress through toast notifications

### What You'll See
- **Validation**: "🔄 Nightingale format detected - automatic migration will be applied during import"
- **Progress**: "🔄 Running Nightingale migration..." → "Importing X cases... (🔄 Nightingale)"
- **Success**: "Successfully migrated and imported all X cases from Nightingale format!"

## Technical Details

### Migration Script
The migration is handled by `/utils/nightingaleMigration.ts`, which is a TypeScript port of the original Python script `convert_nightingale_data.py`.

### Error Handling
- Comprehensive error reporting for failed migrations
- Individual case import errors are tracked and reported
- Failed cases don't prevent successful cases from being imported

### Data Integrity
- All original data relationships are preserved
- Person-case associations are maintained
- Financial records are properly categorized
- Notes and metadata are transferred intact

## Compatibility

The migration system:
- ✅ Works with both Supabase and file storage backends
- ✅ Integrates with existing toast notification system
- ✅ Maintains all existing import workflow features
- ✅ Provides detailed progress feedback
- ✅ Supports rollback if migration fails

## Migration Script Equivalence

This TypeScript implementation provides the same functionality as the original Python script:
- Identical field mapping and transformations
- Same validation and error handling logic
- Equivalent data normalization processes
- Maintains backward compatibility with existing data formats