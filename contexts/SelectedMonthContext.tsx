import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface SelectedMonthContextValue {
  /** The currently selected month for viewing financial data */
  selectedMonth: Date;
  /** Update the selected month */
  setSelectedMonth: (date: Date) => void;
  /** Reset to current month */
  resetToCurrentMonth: () => void;
  /** Navigate to previous month */
  previousMonth: () => void;
  /** Navigate to next month */
  nextMonth: () => void;
}

const SelectedMonthContext = createContext<SelectedMonthContextValue | null>(null);

function getStartOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

interface SelectedMonthProviderProps {
  children: ReactNode;
  /** Optional initial month (defaults to current month) */
  initialMonth?: Date;
}

/**
 * Provider for case-level month selection.
 * Controls which month's financial data is displayed.
 * 
 * TODO: In future, this will be integrated with case-level navigation
 * to allow viewing historical financial snapshots.
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

  return (
    <SelectedMonthContext.Provider 
      value={{
        selectedMonth,
        setSelectedMonth,
        resetToCurrentMonth,
        previousMonth,
        nextMonth,
      }}
    >
      {children}
    </SelectedMonthContext.Provider>
  );
}

/**
 * Hook to access the selected month context.
 * Returns current month as fallback if used outside provider.
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
