# CMSNext Project Structure

This document outlines the organization of the CMSNext filesystem-only case management system.

## Core Application Structure

```
CMSNext/
├── components/              # React components organized by function
│   ├── ui/                 # shadcn/ui base components 
│   ├── figma/              # Figma design system components
│   ├── *Form.tsx           # Form components (CaseForm, etc.)
│   ├── *Modal.tsx          # Modal components (NoteModal, etc.)
│   ├── *List.tsx           # List components (CaseList, etc.)
│   └── *Settings.tsx       # Settings and configuration components
├── contexts/               # React context providers
│   ├── DataManagerContext.tsx    # Stateless data management
│   ├── FileStorageContext.tsx    # File system integration
│   └── ThemeContext.tsx          # UI theme management
├── types/                  # TypeScript type definitions
│   ├── case.ts            # Case management types
│   └── global.d.ts        # Global type declarations
├── utils/                  # Utility functions and services
│   ├── DataManager.ts     # Stateless data operations (new architecture)
│   ├── fileStorageAPI.ts  # Legacy file operations (being phased out)
│   ├── AutosaveFileService.ts    # File system integration
│   └── fileDataProvider.ts      # File service provider
├── styles/                 # Global CSS and styling
└── scripts/               # Development and build scripts
```

## Documentation Structure

```
docs/
├── development/           # Development-related documentation
│   ├── CodeReview.md     # Code review guidelines
│   ├── Guidelines.md     # Development guidelines
│   ├── audit-checklist.md # Code audit checklist
│   └── progression-strategy.md # Development strategy
├── migration/            # Migration documentation
│   └── NightingaleMigration.md # Legacy data migration
├── DeploymentGuide.md    # Production deployment
├── GitHubPages.md        # GitHub Pages setup
├── SeedDataSystem.md     # Test data generation
└── error-boundary-guide.md # Error handling guide
```

## Architecture Notes

### Data Management Evolution
- **Legacy**: FileStorageAPI with internal caching (being phased out)
- **Current**: DataManager with stateless operations (preferred)
- **Pattern**: Read → Modify → Write directly to file system

### File System Integration
- Uses **File System Access API** for local data persistence
- **AutosaveFileService** handles background file operations
- **No database** - filesystem is the single source of truth

### Component Organization
- Components are currently organized by type (Modal, Form, List)
- **Future improvement**: Could be reorganized by feature (cases, dashboard, settings)
- UI components follow **shadcn/ui** patterns

## Development Workflow

### Key Commands
```bash
npm run dev          # Start development server
npm run build        # Production build
npm run preview      # Preview production build
```

### Architecture Principles
1. **Filesystem-only** - No external databases or APIs
2. **Stateless data operations** - DataManager pattern
3. **Component isolation** - Each component is self-contained
4. **Type safety** - Comprehensive TypeScript coverage

## Archive Structure

```
archive/              # Legacy and unused code
├── supabase/        # Legacy Supabase integration
├── data/            # Old sample data files
└── *.py, *.json     # Migration scripts and test data
```

Files in `archive/` are preserved for reference but not used in the current application.

---

This structure supports the filesystem-only architecture while maintaining clean separation of concerns and scalability for future development.