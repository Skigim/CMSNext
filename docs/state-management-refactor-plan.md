# State Management & File Service Refactor Plan

## Current Architecture Issues

### 🚨 Critical Problems Identified:

1. **Multiple Sources of Truth**
   - React state (AppContent cases[])
   - FileStorageAPI internal data
   - FileDataProvider cache
   - Actual file system data
   - **Result**: Data can become inconsistent between layers

2. **Race Conditions**
   - Connection flow vs autosave operations
   - Manual `safeNotifyFileStorageChange()` calls
   - Async data loading during state transitions
   - **Result**: Data loss or corruption during operations

3. **Complex Flag-Based Logic**
   - Window globals for tracking state
   - Hard to debug and maintain
   - **Result**: Unpredictable behavior in edge cases

4. **Inconsistent Error Handling**
   - Silent failures in save operations
   - Partial recovery in connection flows
   - **Result**: Data loss without user awareness

## Proposed Solution: Unified Data Manager

### Core Principles:
1. **Single Source of Truth**: One authoritative data store
2. **Predictable State Transitions**: Clear state machine
3. **Automatic Synchronization**: No manual change notifications
4. **Robust Error Recovery**: Explicit error states and recovery
5. **Type Safety**: Full TypeScript integration

### New Architecture:

```typescript
DataManager (Singleton)
├── State Machine (idle → loading → connected → saving → error)
├── Automatic File Sync (no manual notifications)
├── Error Recovery Strategies
├── Data Validation Layer
└── React Hook Integration (useDataManager)
```

### Implementation Plan:

#### Phase 1: Create Unified Data Manager
- [ ] Create DataManager class with state machine
- [ ] Implement automatic sync without manual notifications
- [ ] Add comprehensive error handling and recovery
- [ ] Create React hooks for seamless integration

#### Phase 2: Gradual Migration
- [ ] Replace AppContent state management with DataManager
- [ ] Migrate FileStorageAPI operations to DataManager
- [ ] Remove global window flags and complex connection logic
- [ ] Update all components to use new hooks

#### Phase 3: File Service Improvements
- [ ] Add data validation and integrity checks
- [ ] Implement automatic backup and recovery
- [ ] Add conflict resolution for concurrent operations
- [ ] Improve error reporting and user feedback

#### Phase 4: Testing & Validation
- [ ] Add comprehensive unit tests
- [ ] Test edge cases and error scenarios
- [ ] Validate data integrity across operations
- [ ] Performance testing and optimization

## Benefits:

✅ **Eliminate Race Conditions**: Single-threaded data operations  
✅ **Reduce Complexity**: No manual sync notifications  
✅ **Improve Reliability**: Automatic error recovery  
✅ **Better DX**: Clear state machine and hooks  
✅ **Data Safety**: Validation and backup mechanisms  

## Risk Mitigation:

- Gradual migration with fallback mechanisms
- Comprehensive testing at each phase
- Data backup before major changes
- Error boundary integration for safety