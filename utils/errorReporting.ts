import { toast } from 'sonner';
import { createLocalStorageAdapter } from '@/utils/localStorage';

/**
 * Error Reporting Utilities
 * =========================
 * Captures and reports application errors with context.
 * Provides structured error logging for debugging and monitoring.
 * 
 * ## Error Report Structure
 * 
 * - **ID**: Unique error identifier
 * - **Timestamp**: When the error occurred
 * - **Error Details**: Message, stack, type
 * - **Context**: Additional context about the error
 * - **User Action**: What user was doing when error occurred
 * 
 * @module errorReporting
 */

export interface ErrorReport {
  id: string;
  timestamp: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context: {
    componentStack?: string;
    props?: any;
    userAgent: string;
    url: string;
    userId?: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  userFeedback?: {
    description: string;
    email?: string;
    reproductionSteps?: string;
  };
}

class ErrorReportingService {
  private reports: ErrorReport[] = [];
  private maxReports = 100; // Keep last 100 error reports
  private isEnabled = true;
  private recentErrors: Map<string, number> = new Map(); // Track recent errors for deduplication
  private deduplicationWindow = 1000; // 1 second window for deduplication

  constructor() {
    // Load existing reports from localStorage
    this.loadReports();
    
    // Setup global error handlers
    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers() {
    // Skip if window is not available (e.g., during test teardown or SSR)
    if (typeof window === 'undefined') return;

    // Handle unhandled promise rejections
    globalThis.addEventListener('unhandledrejection', (event) => {
      this.reportError(
        new Error(`Unhandled Promise Rejection: ${event.reason}`),
        {
          context: { 
            type: 'unhandledrejection',
            reason: event.reason 
          },
          severity: 'high',
          tags: ['async', 'promise']
        }
      );
    });

    // Handle global JavaScript errors
    globalThis.addEventListener('error', (event) => {
      this.reportError(
        event.error || new Error(event.message),
        {
          context: {
            type: 'global_error',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          },
          severity: 'high',
          tags: ['global', 'javascript']
        }
      );
    });
  }

  private readonly errorReportsStorage = createLocalStorageAdapter<ErrorReport[]>(
    "cmsnext-error-reports",
    []
  );

  private loadReports() {
    this.reports = this.errorReportsStorage.read();
  }

  private saveReports() {
    // Keep only the most recent reports
    if (this.reports.length > this.maxReports) {
      this.reports = this.reports.slice(-this.maxReports);
    }
    
    this.errorReportsStorage.write(this.reports);
  }

  private generateErrorHash(error: Error, context?: any): string {
    // Create a hash of the error for deduplication
    const errorSignature = `${error.name}:${error.message}`;
    const stackSignature = error.stack?.split('\n')[1]?.trim() || ''; // Use second line for more specific location
    const contextSignature = context?.type || 'unknown';
    return `${errorSignature}:${stackSignature}:${contextSignature}`;
  }

  private isDuplicateError(errorHash: string): boolean {
    const now = Date.now();
    const lastReported = this.recentErrors.get(errorHash);
    
    if (lastReported && (now - lastReported) < this.deduplicationWindow) {
      return true;
    }
    
    // Clean up old entries
    for (const [hash, timestamp] of this.recentErrors.entries()) {
      if (now - timestamp > this.deduplicationWindow) {
        this.recentErrors.delete(hash);
      }
    }
    
    return false;
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineSeverity(error: Error, _context?: any): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message?.toLowerCase() || '';
    const name = error.name?.toLowerCase() || '';

    // Critical errors
    if (name.includes('syntaxerror') || message.includes('chunk load failed')) {
      return 'critical';
    }

    // High severity errors
    if (
      name.includes('typeerror') ||
      name.includes('referenceerror') ||
      message.includes('cannot read propert') ||
      message.includes('is not a function') ||
      message.includes('permission denied') ||
      message.includes('quota exceeded')
    ) {
      return 'high';
    }

    // Medium severity errors
    if (
      name.includes('aborterror') ||
      message.includes('user cancelled') ||
      message.includes('network error')
    ) {
      return 'medium';
    }

    // Default to medium
    return 'medium';
  }

  private extractTags(error: Error, context?: any): string[] {
    const tags: string[] = [];
    const message = error.message?.toLowerCase() || '';
    const name = error.name?.toLowerCase() || '';

    // Add error type tags
    if (name.includes('aborterror')) tags.push('user-cancelled');
    if (name.includes('notallowederror')) tags.push('permission');
    if (name.includes('securityerror')) tags.push('security');
    if (name.includes('quotaexceedederror')) tags.push('storage');

    // Add functionality tags
    if (message.includes('file') || message.includes('storage')) tags.push('filesystem');
    if (message.includes('case') || message.includes('person')) tags.push('data');
    if (message.includes('form') || message.includes('validation')) tags.push('form');
    if (message.includes('theme') || message.includes('ui')) tags.push('ui');

    // Add context tags
    if (context?.componentStack) tags.push('react-component');
    if (context?.type) tags.push(context.type);

    return tags.length > 0 ? tags : ['general'];
  }

  public reportError(
    error: Error,
    options: {
      context?: any;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      tags?: string[];
      userFeedback?: ErrorReport['userFeedback'];
      componentStack?: string;
    } = {}
  ) {
    if (!this.isEnabled) return;

    // Check for duplicate errors
    const errorHash = this.generateErrorHash(error, options.context);
    if (this.isDuplicateError(errorHash)) {
      // Skip duplicate error, but log in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Skipping duplicate error: ${error.message}`);
      }
      return null;
    }

    // Mark this error as recently reported
    this.recentErrors.set(errorHash, Date.now());

    const report: ErrorReport = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context: {
        componentStack: options.componentStack,
        props: options.context?.props,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        url: typeof window !== 'undefined' ? globalThis.location.href : 'unknown',
        ...options.context,
      },
      severity: options.severity || this.determineSeverity(error, options.context),
      tags: options.tags || this.extractTags(error, options.context),
      userFeedback: options.userFeedback,
    };

    this.reports.push(report);
    this.saveReports();

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🐛 Error Report: ${report.id}`);
      console.error('Error:', error);
      console.log('Context:', report.context);
      console.log('Severity:', report.severity);
      console.log('Tags:', report.tags);
      console.groupEnd();
    }

    // Show user notification for high/critical errors
    if (report.severity === 'high' || report.severity === 'critical') {
      toast.error('An error occurred', {
        description: 'The error has been logged. Please try refreshing the page.',
        action: {
          label: 'Report Issue',
          onClick: () => this.showFeedbackForm(report.id),
        },
      });
    }

    return report.id;
  }

  public getReports(): ErrorReport[] {
    return [...this.reports].reverse(); // Most recent first
  }

  public getReportById(id: string): ErrorReport | undefined {
    return this.reports.find(report => report.id === id);
  }

  public clearReports() {
    this.reports = [];
    this.saveReports();
  }

  public exportReports(): string {
    const exportData = {
      exported_at: new Date().toISOString(),
      total_reports: this.reports.length,
      reports: this.reports,
    };
    return JSON.stringify(exportData, null, 2);
  }

  public addUserFeedback(reportId: string, feedback: ErrorReport['userFeedback']) {
    const report = this.reports.find(r => r.id === reportId);
    if (report) {
      report.userFeedback = feedback;
      this.saveReports();
    }
  }

  private showFeedbackForm(reportId: string) {
    // This would open a modal for user feedback
    // For now, we'll just log that feedback was requested
    console.log(`Feedback requested for error report: ${reportId}`);
    
    // In a real implementation, this might open a modal or redirect to a feedback form
    // toast.info('Feedback form would open here');
  }

  public getErrorStats() {
    const total = this.reports.length;
    const severityCounts = this.reports.reduce((acc, report) => {
      acc[report.severity] = (acc[report.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const tagCounts = this.reports.reduce((acc, report) => {
      report.tags.forEach(tag => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
      return acc;
    }, {} as Record<string, number>);

    const recentErrors = this.reports.filter(
      report => Date.now() - new Date(report.timestamp).getTime() < 24 * 60 * 60 * 1000
    ).length;

    return {
      total,
      recent: recentErrors,
      severity: severityCounts,
      tags: tagCounts,
    };
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  public isReportingEnabled(): boolean {
    return this.isEnabled;
  }
}

// Global singleton instance
export const errorReporting = new ErrorReportingService();

// React hook for using error reporting
export function useErrorReporting() {
  return {
    reportError: errorReporting.reportError.bind(errorReporting),
    getReports: errorReporting.getReports.bind(errorReporting),
    getReportById: errorReporting.getReportById.bind(errorReporting),
    clearReports: errorReporting.clearReports.bind(errorReporting),
    exportReports: errorReporting.exportReports.bind(errorReporting),
    getErrorStats: errorReporting.getErrorStats.bind(errorReporting),
    addUserFeedback: errorReporting.addUserFeedback.bind(errorReporting),
    isEnabled: errorReporting.isReportingEnabled(),
  };
}

