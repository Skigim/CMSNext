# Best Practices for TypeScript + React + Vite Projects

Modern web development with TypeScript, React, and Vite provides an excellent foundation for building scalable, maintainable applications. This guide outlines comprehensive best practices for maximizing the benefits of this powerful combination.

## 1. Project Setup and Configuration

### TypeScript Configuration

Enable strict type-checking options in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Vite Configuration Optimization

Optimize your `vite.config.ts` for better performance and development experience:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@utils': resolve(__dirname, './src/utils'),
      '@types': resolve(__dirname, './src/types')
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
```

## 2. Component Architecture

### Functional Components with TypeScript

Use functional components with proper TypeScript interfaces:

```tsx
import React, { useState, useCallback, FC } from 'react';

interface CounterProps {
  initialCount?: number;
  onCountChange?: (count: number) => void;
  disabled?: boolean;
}

const Counter: FC<CounterProps> = ({ 
  initialCount = 0, 
  onCountChange,
  disabled = false 
}) => {
  const [count, setCount] = useState<number>(initialCount);

  const handleIncrement = useCallback(() => {
    const newCount = count + 1;
    setCount(newCount);
    onCountChange?.(newCount);
  }, [count, onCountChange]);

  return (
    <div>
      <p>Count: {count}</p>
      <button 
        onClick={handleIncrement}
        disabled={disabled}
        aria-label={`Increment count, current value is ${count}`}
      >
        Increment
      </button>
    </div>
  );
};

export default Counter;
```

### Custom Hooks Pattern

Extract reusable logic into custom hooks:

```tsx
import { useState, useEffect, useCallback } from 'react';

interface UseLocalStorageReturn<T> {
  value: T;
  setValue: (value: T) => void;
  removeValue: () => void;
}

function useLocalStorage<T>(
  key: string, 
  initialValue: T
): UseLocalStorageReturn<T> {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setStoredValue = useCallback((newValue: T) => {
    try {
      setValue(newValue);
      window.localStorage.setItem(key, JSON.stringify(newValue));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  const removeStoredValue = useCallback(() => {
    try {
      setValue(initialValue);
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return {
    value,
    setValue: setStoredValue,
    removeValue: removeStoredValue
  };
}

export default useLocalStorage;
```

## 3. Type Safety Best Practices

### Strict Typing for Props and State

Define comprehensive interfaces and avoid `any`:

```tsx
// Good: Specific types
interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
  };
}

// Good: Union types for controlled values
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

// Avoid: Using any
// const handleData = (data: any) => { ... }

// Good: Use unknown and type guards
const handleData = (data: unknown) => {
  if (isUserProfile(data)) {
    // TypeScript knows data is UserProfile here
    console.log(data.name);
  }
};

function isUserProfile(data: unknown): data is UserProfile {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data &&
    'email' in data
  );
}
```

### Utility Types Usage

Leverage TypeScript's built-in utility types:

```tsx
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
}

// Create variations of the main type
type UserPublic = Omit<User, 'password'>;
type UserCreate = Omit<User, 'id' | 'createdAt'>;
type UserUpdate = Partial<Pick<User, 'name' | 'email'>>;
type UserPreview = Pick<User, 'id' | 'name'>;

// For form handling
interface FormState<T> {
  data: T;
  errors: Partial<Record<keyof T, string>>;
  isSubmitting: boolean;
}

type UserFormState = FormState<UserCreate>;
```

## 4. React 18+ Modern Patterns

### Concurrent Features

Utilize React 18's concurrent features:

```tsx
import { Suspense, lazy, useTransition, useDeferredValue } from 'react';

// Code splitting with Suspense
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Non-urgent updates with useTransition
const SearchResults: FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (newQuery: string) => {
    setQuery(newQuery);
    
    // Mark as non-urgent update
    startTransition(() => {
      // Expensive search operation
      setResults(performSearch(newQuery));
    });
  };

  return (
    <div>
      <input 
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search..."
      />
      {isPending && <div>Searching...</div>}
      <ResultsList results={results} />
    </div>
  );
};

// Deferred values for expensive computations
const ExpensiveChart: FC<{ data: number[] }> = ({ data }) => {
  const deferredData = useDeferredValue(data);
  
  return (
    <Suspense fallback={<div>Loading chart...</div>}>
      <Chart data={deferredData} />
    </Suspense>
  );
};
```

### Error Boundaries

Implement proper error handling:

```tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div role="alert">
          <h2>Something went wrong</h2>
          <details>
            {this.state.error?.message}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

## 5. State Management Patterns

### Context + useReducer for Complex State

```tsx
import React, { createContext, useContext, useReducer, ReactNode } from 'react';

interface AppState {
  user: User | null;
  theme: 'light' | 'dark';
  notifications: Notification[];
}

type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string };

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'ADD_NOTIFICATION':
      return { 
        ...state, 
        notifications: [...state.notifications, action.payload] 
      };
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };
    default:
      return state;
  }
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

export const AppProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, {
    user: null,
    theme: 'light',
    notifications: []
  });

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};
```

## 6. Performance Optimization

### Memoization Strategies

```tsx
import React, { memo, useMemo, useCallback } from 'react';

interface ExpensiveComponentProps {
  data: ComplexData[];
  onItemClick: (id: string) => void;
  filter: string;
}

const ExpensiveComponent = memo<ExpensiveComponentProps>(({ 
  data, 
  onItemClick, 
  filter 
}) => {
  // Memoize expensive computations
  const filteredData = useMemo(() => {
    return data.filter(item => 
      item.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [data, filter]);

  // Memoize event handlers
  const handleItemClick = useCallback((id: string) => {
    onItemClick(id);
  }, [onItemClick]);

  return (
    <div>
      {filteredData.map(item => (
        <ExpensiveItem
          key={item.id}
          item={item}
          onClick={handleItemClick}
        />
      ))}
    </div>
  );
});

ExpensiveComponent.displayName = 'ExpensiveComponent';

export default ExpensiveComponent;
```

## 7. Testing Best Practices

### Component Testing with React Testing Library

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Counter } from './Counter';

describe('Counter Component', () => {
  it('renders with initial count', () => {
    render(<Counter initialCount={5} />);
    expect(screen.getByText('Count: 5')).toBeInTheDocument();
  });

  it('increments count when button is clicked', async () => {
    const user = userEvent.setup();
    const onCountChange = jest.fn();
    
    render(<Counter onCountChange={onCountChange} />);
    
    const button = screen.getByRole('button', { name: /increment/i });
    await user.click(button);
    
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
    expect(onCountChange).toHaveBeenCalledWith(1);
  });

  it('does not increment when disabled', async () => {
    const user = userEvent.setup();
    
    render(<Counter disabled />);
    
    const button = screen.getByRole('button', { name: /increment/i });
    expect(button).toBeDisabled();
    
    await user.click(button);
    expect(screen.getByText('Count: 0')).toBeInTheDocument();
  });
});
```

## 8. Code Organization

### Folder Structure

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Basic UI primitives
│   └── forms/           # Form components
├── pages/               # Page components
├── hooks/               # Custom hooks
├── utils/               # Utility functions
├── types/               # TypeScript type definitions
├── contexts/            # React contexts
├── services/            # API services
├── assets/              # Static assets
└── styles/              # Global styles
```

### Import/Export Patterns

```tsx
// Prefer named exports for better tree-shaking
export const Button: FC<ButtonProps> = ({ children, ...props }) => {
  return <button {...props}>{children}</button>;
};

export const IconButton: FC<IconButtonProps> = ({ icon, ...props }) => {
  return <Button {...props}>{icon}</Button>;
};

// Index files for clean imports
// components/index.ts
export { Button } from './Button';
export { IconButton } from './IconButton';
export { Input } from './Input';

// Usage
import { Button, IconButton } from '@/components';
```

## 9. Development Tools Integration

### ESLint Configuration

```json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off"
  }
}
```

### Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

## 10. Build and Deployment

### Environment Configuration

```tsx
// src/config/env.ts
interface Config {
  apiUrl: string;
  environment: 'development' | 'staging' | 'production';
  enableLogging: boolean;
}

const config: Config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  environment: (import.meta.env.VITE_ENVIRONMENT as Config['environment']) || 'development',
  enableLogging: import.meta.env.VITE_ENABLE_LOGGING === 'true',
};

export default config;
```

### Vite Build Optimization

```ts
// vite.config.ts
export default defineConfig({
  build: {
    target: 'esnext',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react';
            }
            if (id.includes('@radix-ui')) {
              return 'ui';
            }
            return 'vendor';
          }
        },
      },
    },
  },
});
```

By following these comprehensive best practices, you'll create maintainable, performant, and scalable React applications with TypeScript and Vite.

1. Setting Up TypeScript with React in Vite
To get started with TypeScript in a React project using Vite, you can create a new project with the following commands:

npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
This command sets up a new React project with TypeScript using Vite's template.

2. Strict Type-Checking Options
Enable strict type-checking options in your tsconfig.json to ensure a higher level of type safety:

{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
These settings help catch potential bugs early and enforce best practices in type handling.

3. Use Functional Components and Hooks
Prefer using functional components and React hooks over class components. Functional components are simpler and more concise, and hooks work seamlessly with TypeScript. Here’s an example of a typed functional component using hooks:

import React, { useState, FC } from 'react';

interface CounterProps {
  initialCount: number;
}

const Counter: FC<CounterProps> = ({ initialCount }) => {
  const [count, setCount] = useState<number>(initialCount);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
};

export default Counter;
4. Typing Props and State
Define clear types for props and state. Use interfaces for props to benefit from TypeScript’s structural typing:

interface ButtonProps {
  label: string;
  onClick: () => void;
}

const Button: FC<ButtonProps> = ({ label, onClick }) => (
  <button onClick={onClick}>{label}</button>
);
5. Use Type Inference and Avoid any
TypeScript's type inference is powerful, so you often don't need to explicitly annotate types. However, avoid using any as it defeats the purpose of type safety. If you must use a loose type, prefer unknown or never.

// Avoid
let value: any;

// Prefer
let value: unknown;
6. Leverage Utility Types
TypeScript provides utility types that can simplify your code and make it more readable. For instance, Partial<T>, Pick<T, K>, and Omit<T, K> are useful for handling component props and state.

interface User {
  id: string;
  name: string;
  email: string;
}

type UserPreview = Omit<User, 'email'>;
7. Use Default Props and TypeScript Union Types
Define default props directly in the component function and use union types for more flexible prop definitions:

interface AlertProps {
  message: string;
  type?: 'success' | 'error' | 'warning';
}

const Alert: FC<AlertProps> = ({ message, type = 'success' }) => (
  <div className={`alert alert-${type}`}>
    {message}
  </div>
);
8. Avoid Overuse of any
TypeScript’s any type disables type checking, which can lead to runtime errors. Instead, try to use more specific types or use unknown and cast to specific types when necessary.

const handleEvent = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  console.log(target.value);
};
9. Use Type Declarations for External Libraries
When using third-party libraries, ensure you install type declarations if available:

npm install --save @types/react-router-dom
For libraries without type definitions, consider creating custom type declarations.

10. Consistent Naming Conventions
Follow consistent naming conventions for types and interfaces. Use PascalCase for type and interface names:

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

type UserId = UserProfile['id'];
11. Use ESLint and Prettier
Integrate ESLint and Prettier into your project to maintain code quality and consistency. Install the necessary packages and configure them to work with TypeScript:

npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install --save-dev prettier eslint-config-prettier eslint-plugin-prettier
Create or update your .eslintrc.js and .prettierrc files with appropriate configurations.

12. Optimize Vite Configuration
Vite’s configuration can be customized in the vite.config.ts file. Ensure you have appropriate settings for TypeScript:

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  esbuild: {
    jsxInject: `import React from 'react'`,
  },
});