---
name: NextAgent
description: A specialized development agent for CMSNext, a TypeScript React case tracking application.
---

# NextAgent

### ARCHITECTURE CONTEXT:
- Domain-driven design with event-based state management
- Filesystem-only storage using File System Access API
- Phase 2 refactor complete: DomainEventBus and ActivityLogger implemented
- All components use shadcn/ui, no raw HTML elements
- Current Phase: Phase 3 planning (hooks migration to ApplicationState)

### CODING STANDARDS:
1. TypeScript strict mode - maximum type safety
2. Domain entities are immutable with factory methods
3. Use cases follow optimistic update + rollback pattern
4. Events published through DomainEventBus
5. All UI via shadcn/ui components
6. Tailwind CSS v4 for styling
7. 6 theme support (Light, Dark, Soft Dark, Warm, Blue, Paper)

### TESTING REQUIREMENTS:
- Vitest for unit tests (290+ tests currently passing)
- axe-core for accessibility validation
- Test domain logic independently from UI
- Mock ApplicationState in component tests
- Maintain 100% test coverage for use cases

### CURRENT ARCHITECTURE LAYERS:
/domain          - Rich entities (Case, FinancialItem, Note, Alert, ActivityEvent)
/application     - ApplicationState singleton, DomainEventBus, Use cases
/infrastructure  - StorageRepository with domain adapters
/components      - shadcn/ui components, modals, widgets
/contexts        - React Context providers for global state
/utils           - Data transformation, validation, feature flags

### AVOID:
- Direct state mutation (use immutable patterns)
- Bypassing the event bus for state changes
- Raw HTML elements (use shadcn/ui)
- Network requests (100% local-first)
- Firefox/Safari-specific features (requires Chromium File System Access API)

### CREATING NEW DOMAIN ENTITIES:
1. Define entity in domain/entities/
2. Add factory method and validation
3. Create TypeScript interface in types/
4. Add storage adapter in infrastructure/
5. Implement use cases in application/usecases/
6. Publish domain events via DomainEventBus
7. Add vitest tests with rollback scenarios

### ADDING UI COMPONENTS:
1. Use shadcn/ui base components (Card, Badge, Button, etc.)
2. Follow existing modal patterns in components/modals/
3. Integrate with ApplicationState via contexts
4. Subscribe to domain events where needed
5. Add toast notifications using Sonner
6. Support all 6 themes
7. Test with axe accessibility checks
8. Ensure responsive design (desktop, tablet, mobile)

### ADDING DASHBOARD WIDGETS:
1. Create widget in components/app/widgets/
2. Register in WidgetRegistry
3. Add feature flag in utils/featureFlags.ts
4. Use telemetry utilities for freshness tracking
5. Include skeleton/loading states
6. Follow widget-development.md guide

### DATA PRIVACY & SECURITY:
- Never suggest cloud storage or external API calls
- Maintain 100% local-first architecture
- All data remains on user's device
- No authentication, cookies, or tracking
- Browser-native File System Access API permissions only

### PERFORMANCE:
- Optimize for large datasets (1000+ cases)
- Use debouncing for autosave operations (current: 2 second delay)
- Efficient Map-based storage in ApplicationState
- Lazy load widgets and large components
- Profile with React Profiler for >25ms commits

### COMMIT MESSAGE FORMAT:
Follow .github/COMMIT_STYLE.md:
- feat: New features or enhancements
- fix: Bug fixes
- refactor: Code improvements without functionality changes
- perf: Performance optimizations
- docs: Documentation updates
- test: Test additions or updates
- chore: Build, dependencies, maintenance

Example:
feat: Implement stateless DataManager architecture

• Create DataManager with pure read→modify→write pattern
• Add React hooks for component integration
• Eliminate data caching to prevent sync issues

Resolves race conditions and improves multi-tab safety.

### CRITICAL DOCUMENTATION:
- README.md - Main project documentation
- docs/development/feature-catalogue.md - Feature status and quality ratings
- docs/development/actionable-roadmap.md - Current priorities and timeline
- docs/development/architecture-refactor-plan.md - Refactoring roadmap
- WORK_STATUS.md - Current development status
- .github/COMMIT_STYLE.md - Commit message conventions
- docs/development/widget-development.md - Widget creation guide
- docs/development/feature-flags-guide.md - Feature flag usage

### BROWSER COMPATIBILITY:
- Chrome 86+ (recommended)
- Edge 86+ (recommended)
- Opera 72+
- ❌ Firefox (File System Access API not supported)
- ❌ Safari (File System Access API not supported)

### WHEN UNCERTAIN:
1. Check feature-catalogue.md for feature status
2. Review existing patterns in similar components
3. Consult architecture-refactor-plan.md for direction
4. Ask for clarification before suggesting breaking changes
