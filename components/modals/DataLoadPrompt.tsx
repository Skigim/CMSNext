import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Database, FileText, Upload } from "lucide-react";

interface DataLoadPromptProps {
  onLoadExistingData: () => void;
  onGoToSettings: () => void;
  isLoading: boolean;
}

export function DataLoadPrompt({ onLoadExistingData, onGoToSettings, isLoading }: DataLoadPromptProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-2xl mx-auto px-4">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Database className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Directory Connected Successfully</CardTitle>
            <CardDescription>
              Your data folder is connected. Choose how you'd like to proceed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto">
                      <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-medium">Load Existing Data</h3>
                      <p className="text-sm text-muted-foreground">
                        Load cases from files in your connected directory
                      </p>
                    </div>
                    <Button 
                      onClick={onLoadExistingData}
                      disabled={isLoading}
                      className="w-full"
                      variant="outline"
                    >
                      {isLoading ? 'Loading...' : 'Load Data'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
                      <Upload className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-medium">Import New Data</h3>
                      <p className="text-sm text-muted-foreground">
                        Import cases from JSON files or start fresh
                      </p>
                    </div>
                    <Button 
                      onClick={onGoToSettings}
                      variant="outline"
                      className="w-full"
                    >
                      Go to Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground">
                You can change these options later in Settings
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}