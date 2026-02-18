import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

/**
 * Selected month context value - provides month selection state and navigation.
 * 
 * Manages which month's financial data is displayed to the user.
 * Always normalizes dates to the start of the month (first day, 00:00).
 * 
 * @interface SelectedMonthContextValue
 */
interface SelectedMonthContextValue {
  /** The currently selected month (first day of month at 00:00) */
  selectedMonth: Date;
  /** Update selected month to specific date */
  setSelectedMonth: (date: Date) => void;
  /** Reset to current month */
  resetToCurrentMonth: () => void;
  /** Navigate to previous month */
  previousMonth: () => void;
  /** Navigate to next month */
  nextMonth: () => void;
}

const SelectedMonthContext = createContext<SelectedMonthContextValue | null>(null);

/**
 * Get the start of month date (normalized to first day at 00:00).
 * 
 * @private
 * @param {Date} [date=new Date()] - Input date (defaults to now)
 * @returns {Date} First day of the month at 00:00
 */
function getStartOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Props for SelectedMonthProvider component.
 * @interface SelectedMonthProviderProps
 */
interface SelectedMonthProviderProps {
  /** React child components */
  children: ReactNode;
  /** Optional initial month (defaults to current month) */
  initialMonth?: Date;
}

/**
 * SelectedMonthProvider - Manages case-level month selection for financial data viewing.
 * 
 * Provides month selection state for displaying financial snapshots.
 * Always normalizes dates to month start (first day at 00:00) for consistency.
 * 
 * ## Purpose
 * 
 * Allows users to view financial data for different months:
 * - Monthly financial summaries
 * - Historical financial snapshots
 * - Month-to-month comparison (future feature)
 * 
 * ## Date Normalization
 * 
 * All dates are normalized to month start:
 * - `2025-12-25 14:30` → `2025-12-01 00:00`
 * - Ensures consistent month boundaries
 * - Prevents off-by-one errors with month calculations
 * 
 * ## Setup
 * 
 * ```typescript
 * function App() {
 *   return (
 *     <SelectedMonthProvider initialMonth={new Date()}>
 *       <YourApp />
 *     </SelectedMonthProvider>
 *   );
 * }
 * ```
 * 
 * ## Usage
 * 
 * ```typescript
 * function MonthNavigator() {
 *   const { selectedMonth, previousMonth, nextMonth, resetToCurrentMonth } = useSelectedMonth();
 *   
 *   return (
 *     <div>
 *       <button onClick={previousMonth}>← Previous</button>
 *       <span>{selectedMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
 *       <button onClick={nextMonth}>Next →</button>
 *       <button onClick={resetToCurrentMonth}>Today</button>
 *     </div>
 *   );
 * }
 * ```
 * 
 * ## Future Enhancement
 * 
 * TODO: Integrate with case-level navigation to show historical financial data
 * alongside case activity history.
 * 
 * @component
 * @param {SelectedMonthProviderProps} props - Provider configuration
 * @returns {ReactNode} Provider wrapping children
 * 
 * @see {@link useSelectedMonth} to access month selection state
 */
export function SelectedMonthProvider({ 
  children, 
  initialMonth 
}: SelectedMonthProviderProps) {
  const [selectedMonth, setSelectedMonthState] = useState<Date>(
    () => getStartOfMonth(initialMonth)
  );

  const setSelectedMonth = useCallback((date: Date) => {
    setSelectedMonthState(getStartOfMonth(date));
  }, []);

  const resetToCurrentMonth = useCallback(() => {
    setSelectedMonthState(getStartOfMonth(new Date()));
  }, []);

  const previousMonth = useCallback(() => {
    setSelectedMonthState(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return getStartOfMonth(newDate);
    });
  }, []);

  const nextMonth = useCallback(() => {
    setSelectedMonthState(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return getStartOfMonth(newDate);
    });
  }, []);

  const contextValue = useMemo(
    () => ({ selectedMonth, setSelectedMonth, resetToCurrentMonth, previousMonth, nextMonth }),
    [selectedMonth, setSelectedMonth, resetToCurrentMonth, previousMonth, nextMonth]
  );

  return (
    <SelectedMonthContext.Provider value={contextValue}>
      {children}
    </SelectedMonthContext.Provider>
  );
}

/**
 * Hook to access the selected month context.
 * 
 * Provides month selection state for viewing financial data by month.
 * Returns safe defaults if used outside provider (no-op functions, current month).
 * 
 * ## Example
 * 
 * ```typescript
 * function FinancialSummary() {
 *   const { selectedMonth, previousMonth, nextMonth } = useSelectedMonth();
 *   
 *   const monthName = selectedMonth.toLocaleString('default', { 
 *     month: 'long', 
 *     year: 'numeric' 
 *   });
 *   
 *   return (
 *     <div>
 *       <button onClick={previousMonth}>← Previous</button>
 *       <h2>{monthName}</h2>
 *       <button onClick={nextMonth}>Next →</button>
 *       <FinancialData month={selectedMonth} />
 *     </div>
 *   );
 * }
 * ```
 * 
 * ## Safe Fallback
 * 
 * If used outside provider, returns safe defaults:
 * - `selectedMonth`: Current month (normalized to first day)
 * - Other methods: No-op functions (safe to call but do nothing)
 * 
 * This makes it safe to use anywhere without strict provider requirement.
 * 
 * @hook
 * @returns {SelectedMonthContextValue} Month selection state and navigation
 * 
 * @see {@link SelectedMonthProvider} for setup
 */
export function useSelectedMonth(): SelectedMonthContextValue {
  const context = useContext(SelectedMonthContext);
  
  // Fallback for use outside provider - default to current month
  if (!context) {
    return {
      selectedMonth: getStartOfMonth(),
      setSelectedMonth: () => {},
      resetToCurrentMonth: () => {},
      previousMonth: () => {},
      nextMonth: () => {},
    };
  }
  
  return context;
}
