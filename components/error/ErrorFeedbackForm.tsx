import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Send, 
  MessageSquare, 
  Bug, 
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useErrorReporting } from '@/utils/errorReporting';
import { toast } from 'sonner';

interface ErrorFeedbackFormProps {
  reportId?: string;
  error?: Error;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function ErrorFeedbackForm({ 
  reportId, 
  error, 
  isOpen, 
  onOpenChange,
  trigger 
}: ErrorFeedbackFormProps) {
  const { addUserFeedback, getReportById } = useErrorReporting();
  const [feedback, setFeedback] = useState({
    description: '',
    email: '',
    reproductionSteps: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const report = reportId ? getReportById(reportId) : null;
  const displayError = error || report?.error;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.description.trim()) {
      toast.error('Please provide a description of the issue');
      return;
    }

    setIsSubmitting(true);

    try {
      if (reportId) {
        // Add feedback to existing error report
        addUserFeedback(reportId, {
          description: feedback.description,
          email: feedback.email || undefined,
          reproductionSteps: feedback.reproductionSteps || undefined,
        });
      } else {
        // For ad-hoc feedback without a specific error report
        console.log('User feedback submitted:', {
          error: displayError?.message,
          feedback,
          timestamp: new Date().toISOString(),
        });
      }

      setIsSubmitted(true);
      toast.success('Feedback submitted successfully');
      
      // Reset form after successful submission
      resetTimeoutRef.current = setTimeout(() => {
        setFeedback({ description: '', email: '', reproductionSteps: '' });
        setIsSubmitted(false);
        if (onOpenChange) {
          onOpenChange(false);
        }
      }, 2000);

    } catch (err) {
      console.error('Failed to submit feedback:', err);
      toast.error('Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <MessageSquare className="h-4 w-4 mr-1" />
      Report Issue
    </Button>
  );

  const dialogContent = (
    <div className="space-y-6">
      {displayError && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="font-medium">Error Details:</div>
              <div className="text-sm bg-muted p-2 rounded font-mono">
                {displayError.name}: {displayError.message}
              </div>
              {report && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {report.severity}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(report.timestamp).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {isSubmitted ? (
        <div className="text-center py-8">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Thank you!</h3>
          <p className="text-muted-foreground">
            Your feedback has been submitted and will help us improve the application.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="description">
              Issue Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Please describe what happened and what you were trying to do..."
              value={feedback.description}
              onChange={(e) => setFeedback(prev => ({ ...prev, description: e.target.value }))}
              className="min-h-[100px]"
              required
            />
          </div>

          <div>
            <Label htmlFor="reproductionSteps">
              Steps to Reproduce (Optional)
            </Label>
            <Textarea
              id="reproductionSteps"
              placeholder="1. I clicked on...&#10;2. Then I tried to...&#10;3. The error occurred when..."
              value={feedback.reproductionSteps}
              onChange={(e) => setFeedback(prev => ({ ...prev, reproductionSteps: e.target.value }))}
              className="min-h-[80px]"
            />
          </div>

          <div>
            <Label htmlFor="email">
              Email (Optional)
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              value={feedback.email}
              onChange={(e) => setFeedback(prev => ({ ...prev, email: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              We'll only use this to follow up on your report if needed
            </p>
          </div>

          <Separator />

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !feedback.description.trim()}
            >
              {isSubmitting ? (
                <>Submitting...</>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Submit Feedback
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );

  if (isOpen !== undefined && onOpenChange) {
    // Controlled mode
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Report an Issue
            </DialogTitle>
            <DialogDescription>
              Help us improve by reporting bugs or issues you encounter.
            </DialogDescription>
          </DialogHeader>
          {dialogContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Uncontrolled mode with trigger
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Report an Issue
          </DialogTitle>
          <DialogDescription>
            Help us improve by reporting bugs or issues you encounter.
          </DialogDescription>
        </DialogHeader>
        {dialogContent}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Feedback collection panel for Settings page
 */
export function FeedbackPanel() {
  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production for now
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <CardTitle>Feedback & Bug Reports</CardTitle>
        </div>
        <CardDescription>
          Help improve the application by reporting issues or providing feedback
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Your feedback helps us identify and fix issues. All reports are stored locally and can be exported for analysis.
          </AlertDescription>
        </Alert>

        <div className="flex gap-3">
          <ErrorFeedbackForm
            trigger={
              <Button>
                <Bug className="h-4 w-4 mr-2" />
                Report a Bug
              </Button>
            }
          />
          
          <ErrorFeedbackForm
            trigger={
              <Button variant="outline">
                <MessageSquare className="h-4 w-4 mr-2" />
                General Feedback
              </Button>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

