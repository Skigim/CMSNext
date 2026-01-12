# JSDoc Style Guide

This guide defines the JSDoc documentation standards for the CMSNext codebase.

## Core Principles

1. **Clarity Over Brevity**: Write clear, complete descriptions even if verbose
2. **Examples for Complexity**: Include examples for complex methods or patterns
3. **Context Matters**: Document why, not just what
4. **Consistent Format**: Follow the established patterns throughout

## Documentation Standards

### Classes

```typescript
/**
 * Brief one-line description of the class.
 * 
 * ## Purpose and Context
 * 
 * Detailed explanation of what the class does, its role in the architecture,
 * and when to use it.
 * 
 * ## Architecture
 * 
 * How the class fits into the larger system (if applicable).
 * 
 * ```
 * ParentClass
 *     ↓
 * ThisClass
 *     ↓
 * DependentClasses
 * ```
 * 
 * ## Key Features
 * 
 * - Feature 1: Description
 * - Feature 2: Description
 * - Feature 3: Description
 * 
 * ## Usage Example
 * 
 * ```typescript
 * const instance = new ClassName(config);
 * const result = await instance.method();
 * ```
 * 
 * @class ClassName
 * @see {@link RelatedClass} for related functionality
 */
export class ClassName {
  // ...
}
```

### Constructors

```typescript
/**
 * Create a new instance of the class.
 * 
 * Additional context about initialization, side effects, or important
 * behavior to know when creating instances.
 * 
 * @param {ConfigType} config - Configuration object
 * @param {Type} config.requiredField - Description of required field
 * @param {Type} [config.optionalField] - Description of optional field
 * 
 * @example
 * const instance = new ClassName({
 *   requiredField: value,
 *   optionalField: optionalValue
 * });
 */
constructor(config: ConfigType) {
  // ...
}
```

### Public Methods

```typescript
/**
 * Brief one-line description of what the method does.
 * 
 * Detailed explanation of:
 * - What the method does
 * - How it works (if complex)
 * - Side effects or state changes
 * - Important caveats or limitations
 * 
 * **Special Behaviors:**
 * - Behavior 1
 * - Behavior 2
 * 
 * @param {Type} paramName - Description of parameter
 * @param {Type} [optionalParam] - Description of optional parameter
 * @returns {Promise<ReturnType>} Description of return value
 * @throws {ErrorType} When this error occurs
 * 
 * @example
 * const result = await instance.methodName(param);
 * if (result) {
 *   // Handle success
 * }
 */
async methodName(paramName: Type, optionalParam?: Type): Promise<ReturnType> {
  // ...
}
```

### Private Methods

```typescript
/**
 * Brief description of private method purpose.
 * 
 * Additional implementation details that are useful for maintainers.
 * 
 * @private
 * @param {Type} param - Parameter description
 * @returns {ReturnType} Return description
 */
private helperMethod(param: Type): ReturnType {
  // ...
}
```

### Interfaces and Types

```typescript
/**
 * Brief description of the interface purpose.
 * 
 * Context about when and how this interface is used.
 * 
 * @interface InterfaceName
 */
interface InterfaceName {
  /** Description of required property */
  requiredProp: Type;
  
  /** Description of optional property */
  optionalProp?: Type;
  
  /** 
   * Description of complex property.
   * Additional context if needed.
   */
  complexProp: ComplexType;
}
```

### Enums

```typescript
/**
 * Brief description of the enum purpose.
 * 
 * @enum {string}
 */
enum EnumName {
  /** Description of value 1 */
  VALUE_ONE = "value-one",
  
  /** Description of value 2 */
  VALUE_TWO = "value-two",
}
```

## Specific Patterns

### React Components

```typescript
/**
 * Component brief description.
 * 
 * Detailed explanation of component purpose, behavior, and usage.
 * 
 * ## Features
 * 
 * - Feature 1
 * - Feature 2
 * 
 * ## Usage
 * 
 * ```tsx
 * <ComponentName
 *   prop1={value}
 *   onAction={handler}
 * />
 * ```
 * 
 * @component
 */
export function ComponentName({ prop1, onAction }: Props) {
  // ...
}
```

### Custom Hooks

```typescript
/**
 * Hook brief description.
 * 
 * Explanation of:
 * - What the hook manages
 * - Side effects
 * - Dependencies
 * - Return values
 * 
 * @returns {Object} Hook return values
 * @returns {Type} returns.value - Description of return value
 * @returns {Function} returns.action - Description of action
 * 
 * @example
 * const { value, action } = useCustomHook();
 * 
 * useEffect(() => {
 *   action(newValue);
 * }, [dependency]);
 */
export function useCustomHook() {
  // ...
}
```

### Service Methods

```typescript
/**
 * Brief description of service operation.
 * 
 * ## Operation Flow
 * 
 * 1. Step one of the operation
 * 2. Step two of the operation
 * 3. Step three of the operation
 * 
 * ## Side Effects
 * 
 * - Effect 1
 * - Effect 2
 * 
 * @param {Type} param - Parameter description
 * @returns {Promise<ReturnType>} Description of return value
 * @throws {ErrorType} Conditions that cause errors
 * 
 * @example
 * const result = await service.operation(param);
 * console.log(`Operation result: ${result}`);
 */
async operation(param: Type): Promise<ReturnType> {
  // ...
}
```

## Tag Reference

### Essential Tags

- `@param {Type} name - Description` - Parameter documentation
- `@returns {Type} Description` - Return value documentation
- `@throws {ErrorType} Description` - Error documentation
- `@example` - Usage example (code block)

### Organizational Tags

- `@class ClassName` - Class declaration
- `@interface InterfaceName` - Interface declaration
- `@enum {Type}` - Enum declaration
- `@component` - React component

### Visibility Tags

- `@private` - Private method/property
- `@public` - Public method/property (default, optional)
- `@protected` - Protected method/property

### Cross-Reference Tags

- `@see {@link OtherClass}` - Reference to related code
- `@deprecated Use newMethod() instead` - Deprecation notice

## Best Practices

### DO ✅

1. **Document public APIs comprehensively**
   - Every public method needs full documentation
   - Include examples for complex operations
   - Document all parameters and return values

2. **Explain the "why" not just the "what"**
   ```typescript
   /**
    * Refresh the directory handle from IndexedDB to clear cached state.
    * 
    * This is critical for resolving "state cached in interface object" errors
    * that can occur when multiple operations access the same file handle.
    * 
    * @private
    * @returns {Promise<boolean>} true if refresh successful
    */
   ```

3. **Include examples for complex scenarios**
   - Multi-step operations
   - Non-obvious usage patterns
   - Integration patterns

4. **Document side effects and state changes**
   - File writes
   - State mutations
   - Event broadcasts
   - Cache invalidation

5. **Use markdown formatting**
   - **Bold** for emphasis
   - `code` for inline code
   - Code blocks for examples
   - Lists for features/steps

### DON'T ❌

1. **Don't repeat the obvious**
   ```typescript
   // BAD
   /**
    * Get the user name
    * @returns {string} The user name
    */
   getUserName(): string {}
   
   // GOOD
   /**
    * Get the user's display name with fallback to email if name is not set.
    * 
    * @returns {string} Display name or email address
    */
   getUserName(): string {}
   ```

2. **Don't document private implementation details in public APIs**
   - Keep implementation notes in private method docs
   - Focus on usage and behavior in public docs

3. **Don't use overly technical jargon without explanation**
   - Explain domain-specific terms
   - Link to related documentation

4. **Don't skip error documentation**
   - Always document what errors can be thrown
   - Explain when errors occur

5. **Don't write stale documentation**
   - Update docs when behavior changes
   - Remove outdated examples
   - Keep examples working code

## Documentation Priority

### Priority 1: Must Document
- All public classes and their purpose
- All public methods with params/returns
- Complex algorithms or business logic
- Error conditions and handling
- Integration points between systems

### Priority 2: Should Document
- Public interfaces and types
- React components and hooks
- Service methods
- Utility functions with non-obvious behavior
- Configuration options

### Priority 3: Can Document
- Private methods (brief description)
- Simple getters/setters
- Obvious helper functions
- Internal types

## Examples from Codebase

See the following files for complete examples:
- `utils/DataManager.ts` - Full class documentation
- `utils/AutosaveFileService.ts` - Complex service with detailed docs
- `utils/services/FileStorageService.ts` - Storage layer documentation

## Validation

Before committing JSDoc:

1. ✅ All public methods documented
2. ✅ Complex logic has examples
3. ✅ Error conditions documented
4. ✅ Types are specified for all params/returns
5. ✅ No typos or formatting issues
6. ✅ Examples are working code
7. ✅ Related code cross-referenced with @see

## Tools

While this project doesn't currently generate JSDoc websites, the documentation:
- Appears in IDE hover tooltips
- Shows in autocomplete
- Aids code navigation
- Serves as inline reference
- Can be extracted by documentation tools

Consider adding JSDoc generation in the future with:
- TypeDoc for TypeScript projects
- Documentation.js
- JSDoc official tool
