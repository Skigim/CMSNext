/**
 * SeedDataGenerator Component
 * 
 * React component for generating seed data within the CMSNext application.
 * Integrates with the filesystem storage architecture to populate the system
 * with realistic sample data for testing and demonstration purposes.
 */

import React, { useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Loader2, AlertTriangle, Sparkles, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { fileDataProvider } from '../utils/fileDataProvider';
import { generateFullSeedData, validateSeedData } from '../scripts/generateSeedData';
import type { CaseData } from '../types/case';

// Preset configurations
const seedDataPresets = {
  small: () => generateFullSeedData(10),
  medium: () => generateFullSeedData(25),
  large: () => generateFullSeedData(50),
  stress: () => generateFullSeedData(200),
  demo: () => {
    const data = generateFullSeedData(15);
    
    // Ensure we have some priority cases
    data.caseRecords.slice(0, 3).forEach(caseRecord => {
      caseRecord.priority = true;
      caseRecord.status = 'Priority';
    });
    
    // Ensure we have cases in all statuses
    const statuses: ('In Progress' | 'Priority' | 'Review' | 'Completed')[] = ['In Progress', 'Priority', 'Review', 'Completed'];
    data.caseRecords.slice(0, 4).forEach((caseRecord, index) => {
      caseRecord.status = statuses[index];
    });
    
    return data;
  }
};

interface SeedDataGeneratorProps {
  onDataGenerated?: () => void;
}

export const SeedDataGenerator: React.FC<SeedDataGeneratorProps> = ({ onDataGenerated }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [numCases, setNumCases] = useState(25);
  const [generatedData, setGeneratedData] = useState<CaseData | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('medium');

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      let seedData: CaseData;
      
      if (selectedPreset && selectedPreset !== 'custom') {
        seedData = seedDataPresets[selectedPreset as keyof typeof seedDataPresets]();
      } else {
        seedData = generateFullSeedData(numCases);
      }
      
      const validation = validateSeedData(seedData);
      
      if (!validation.isValid) {
        toast.error(`Generated data is invalid: ${validation.errors.join(', ')}`);
        return;
      }
      
      setGeneratedData(seedData);
      toast.success(`Successfully generated ${seedData.caseRecords.length} cases with sample data!`);
    } catch (error) {
      console.error('Error generating seed data:', error);
      toast.error('Failed to generate seed data');
    } finally {
      setIsGenerating(false);
    }
  }, [numCases, selectedPreset]);

  const handleDownload = useCallback(() => {
    if (!generatedData) return;
    
    const dataStr = JSON.stringify(generatedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `cmsNext-seed-data-${generatedData.caseRecords.length}-cases.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    toast.success('Seed data downloaded successfully!');
  }, [generatedData]);

  const handleLoadToFileSystem = useCallback(async () => {
    if (!generatedData) return;
    
    const dataAPI = fileDataProvider.getAPI();
    if (!dataAPI) {
      toast.error('File system access is not available');
      return;
    }
    
    const toastId = toast.loading('Loading seed data to file system...');
    
    try {
      // Transform CaseData to CaseDisplay array for the FileStorageAPI
      const transformedCases: import('../types/case').CaseDisplay[] = generatedData.caseRecords.map(caseRecord => {
        const person = generatedData.people.find(p => p.id === caseRecord.personId);
        if (!person) {
          throw new Error(`Person not found for case ${caseRecord.id}`);
        }
        
        return {
          id: caseRecord.id,
          name: person.name,
          mcn: caseRecord.mcn,
          status: caseRecord.status,
          priority: caseRecord.priority,
          createdAt: caseRecord.createdDate,
          updatedAt: caseRecord.updatedDate,
          person,
          caseRecord
        };
      });
      
      // Import the transformed cases using the existing importCases method
      await dataAPI.importCases(transformedCases);
      
      toast.success('Seed data loaded to file system successfully!', { id: toastId });
      
      // Reset the generated data
      setGeneratedData(null);
      
      // Notify parent component
      if (onDataGenerated) {
        onDataGenerated();
      }
      
    } catch (error) {
      console.error('Failed to load seed data to file system:', error);
      toast.error('Failed to load seed data to file system', { id: toastId });
    }
  }, [generatedData, onDataGenerated]);

  const presetOptions = [
    { id: 'demo', name: 'Demo', description: '15 curated cases', cases: 15 },
    { id: 'small', name: 'Small', description: '10 test cases', cases: 10 },
    { id: 'medium', name: 'Medium', description: '25 standard cases', cases: 25 },
    { id: 'large', name: 'Large', description: '50 comprehensive cases', cases: 50 },
    { id: 'stress', name: 'Stress Test', description: '200 performance test cases', cases: 200 },
    { id: 'custom', name: 'Custom', description: 'Custom number of cases', cases: numCases }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Generate Sample Data</CardTitle>
        </div>
        <CardDescription>
          Create realistic sample cases with financial data, notes, and proper relationships
          to populate your case management system for testing and demonstration purposes.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Preset Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Data Preset</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {presetOptions.map((preset) => (
              <Button
                key={preset.id}
                variant={selectedPreset === preset.id ? "default" : "outline"}
                onClick={() => setSelectedPreset(preset.id)}
                className="h-auto p-3 text-left justify-start"
              >
                <div className="space-y-1 w-full">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{preset.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {preset.cases}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {preset.description}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Cases Input */}
        {selectedPreset === 'custom' && (
          <div className="space-y-2">
            <Label htmlFor="numCases">Number of Cases</Label>
            <Input
              id="numCases"
              type="number"
              min="1"
              max="500"
              value={numCases}
              onChange={(e) => setNumCases(parseInt(e.target.value, 10) || 25)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Recommended: 25-50 cases for testing, up to 500 for stress testing
            </p>
          </div>
        )}

        {/* Generate Button */}
        <div className="flex gap-2">
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || (selectedPreset === 'custom' && numCases < 1)}
            className="flex items-center gap-2"
          >
            {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
            {isGenerating ? 'Generating...' : 'Generate Sample Data'}
          </Button>
        </div>

        {/* Generated Data Summary */}
        {generatedData && (
          <>
            <Separator />
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
              <div className="space-y-2">
                <h4 className="font-medium">Generated Data Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">People:</span> {generatedData.people.length}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cases:</span> {generatedData.caseRecords.length}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Financial Items:</span>{' '}
                    {generatedData.caseRecords.reduce(
                      (sum, c) => sum + c.financials.resources.length + c.financials.income.length + c.financials.expenses.length,
                      0
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Notes:</span>{' '}
                    {generatedData.caseRecords.reduce((sum, c) => sum + c.notes.length, 0)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Priority Cases:</span>{' '}
                    {generatedData.caseRecords.filter(c => c.priority).length}
                  </div>
                  <div>
                    <span className="text-muted-foreground">File Size:</span>{' '}
                    {(JSON.stringify(generatedData).length / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleDownload} variant="outline" size="sm" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download JSON
                </Button>
                <Button onClick={handleLoadToFileSystem} size="sm" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Load to File System
                </Button>
              </div>
              
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  Loading to file system will replace all existing data. Make sure to back up
                  any important data before proceeding.
                </AlertDescription>
              </Alert>
            </div>
          </>
        )}

        {/* Information */}
        <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
          <div className="text-sm text-muted-foreground space-y-2">
            <div className="font-medium text-foreground">What's Generated:</div>
            <ul className="space-y-1 ml-4">
              <li>• Realistic people with addresses, contact info, and demographics</li>
              <li>• Cases with proper MCN numbers, statuses, and documentation</li>
              <li>• Financial data including resources, income, and expenses</li>
              <li>• Case notes with realistic content and proper categorization</li>
              <li>• Proper relationships and data integrity validation</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};