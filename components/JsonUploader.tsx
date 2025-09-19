import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Download, HelpCircle, ChevronDown } from "lucide-react";
import { CaseDisplay, NewPersonData, NewCaseRecordData } from "../types/case";
import { downloadSampleJson, getImportDocumentation } from "../utils/jsonImportHelper";
import { fileDataProvider } from "../utils/fileDataProvider";
import { migrateNightingaleData, isNightingaleFormat } from "../utils/nightingaleMigration";
import { toast } from "sonner";

// Always use file storage - filesystem only
const getDataAPI = () => fileDataProvider.getAPI();

// File storage notification
const notifyFileStorageChange = () => {
  if ((window as any).fileStorageNotifyChange) {
    (window as any).fileStorageNotifyChange();
  }
};

interface JsonUploaderProps {
  onImportComplete: (importedCases: CaseDisplay[]) => void;
  onClose?: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
  imported: CaseDisplay[];
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  caseCount: number;
  needsMigration?: boolean;
  migrationSource?: string;
}

export function JsonUploader({ onImportComplete, onClose }: JsonUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [showHelp, setShowHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documentation = getImportDocumentation();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/json") {
      setSelectedFile(file);
      setValidation(null);
      setImportResult(null);
      setPreviewData(null);
      toast.info(`Selected file: ${file.name}`);
      validateFile(file);
    } else {
      toast.error("Please select a valid JSON file.");
    }
  };

  const validateFile = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      const result = validateJsonStructure(data);
      setValidation(result);
      
      if (result.isValid) {
        // Set preview data for the first few cases
        const preview = Array.isArray(data) ? data.slice(0, 3) : [data];
        setPreviewData(preview);
        toast.success(`File validation passed! ${result.caseCount} cases ready for import`);
      } else {
        toast.error(`File validation failed: ${result.errors[0]}`);
      }
    } catch (error) {
      setValidation({
        isValid: false,
        errors: [`Invalid JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        caseCount: 0
      });
    }
  };

  const validateJsonStructure = (data: any): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data) {
      errors.push("File is empty or contains no data");
      return { isValid: false, errors, warnings, caseCount: 0 };
    }

    // Check if this is Nightingale format first
    if (isNightingaleFormat(data)) {
      const peopleCount = data.people?.length || 0;
      const casesCount = (data.caseRecords || data.cases)?.length || 0;
      
      if (peopleCount === 0 && casesCount === 0) {
        errors.push("No people or cases found in Nightingale data");
        return { isValid: false, errors, warnings, caseCount: 0 };
      }

      warnings.push("🔄 Nightingale format detected - automatic migration will be applied during import");
      
      return {
        isValid: true,
        errors,
        warnings,
        caseCount: casesCount,
        needsMigration: true,
        migrationSource: 'Nightingale'
      };
    }

    // Handle both single case and array of cases (standard platform format)
    const cases = Array.isArray(data) ? data : [data];
    let validCases = 0;

    for (let i = 0; i < cases.length; i++) {
      const caseItem = cases[i];
      const casePrefix = `Case ${i + 1}:`;

      // Check for required person fields
      if (!caseItem.person && !caseItem.firstName && !caseItem.lastName) {
        errors.push(`${casePrefix} Missing person information (firstName, lastName, or person object)`);
        continue;
      }

      // Check for case record or financial data
      if (!caseItem.caseRecord && !caseItem.financials && !caseItem.resources && !caseItem.income && !caseItem.expenses) {
        warnings.push(`${casePrefix} No financial data found`);
      }

      // Validate person data structure
      const person = caseItem.person || caseItem;
      if (!person.firstName) warnings.push(`${casePrefix} Missing firstName`);
      if (!person.lastName) warnings.push(`${casePrefix} Missing lastName`);
      if (!person.email && !person.phone) warnings.push(`${casePrefix} No contact information (email or phone)`);

      validCases++;
    }

    const isValid = errors.length === 0 && validCases > 0;

    return {
      isValid,
      errors,
      warnings,
      caseCount: validCases
    };
  };

  const transformLegacyData = (rawData: any): { person: NewPersonData; caseRecord: NewCaseRecordData }[] => {
    const cases = Array.isArray(rawData) ? rawData : [rawData];
    
    return cases.map((item: any) => {
      // Extract person data - handle both nested and flat structures
      const person: NewPersonData = {
        firstName: item.person?.firstName || item.firstName || '',
        lastName: item.person?.lastName || item.lastName || '',
        middleName: item.person?.middleName || item.middleName || '',
        email: item.person?.email || item.email || '',
        phone: item.person?.phone || item.phone || '',
        dateOfBirth: item.person?.dateOfBirth || item.dateOfBirth || '',
        ssn: item.person?.ssn || item.ssn || '',
        address: {
          street: item.person?.address?.street || item.address?.street || item.street || '',
          city: item.person?.address?.city || item.address?.city || item.city || '',
          state: item.person?.address?.state || item.address?.state || item.state || '',
          zipCode: item.person?.address?.zipCode || item.address?.zipCode || item.zipCode || '',
          county: item.person?.address?.county || item.address?.county || item.county || ''
        },
        householdSize: item.person?.householdSize || item.householdSize || 1,
        maritalStatus: item.person?.maritalStatus || item.maritalStatus || '',
        employmentStatus: item.person?.employmentStatus || item.employmentStatus || ''
      };

      // Extract case record data
      const caseRecord: NewCaseRecordData = {
        mcn: item.caseRecord?.mcn || item.mcn || item.caseNumber || '',
        status: item.caseRecord?.status || item.status || 'In Progress',
        priority: item.caseRecord?.priority || item.priority || 'Normal',
        assignedTo: item.caseRecord?.assignedTo || item.assignedTo || '',
        dateOpened: item.caseRecord?.dateOpened || item.dateOpened || new Date().toISOString().split('T')[0],
        lastUpdated: item.caseRecord?.lastUpdated || item.lastUpdated || new Date().toISOString().split('T')[0],
        financials: {
          resources: transformFinancialItems(
            item.caseRecord?.financials?.resources || 
            item.financials?.resources || 
            item.resources || 
            []
          ),
          income: transformFinancialItems(
            item.caseRecord?.financials?.income || 
            item.financials?.income || 
            item.income || 
            []
          ),
          expenses: transformFinancialItems(
            item.caseRecord?.financials?.expenses || 
            item.financials?.expenses || 
            item.expenses || 
            []
          )
        },
        notes: transformNotes(
          item.caseRecord?.notes || 
          item.notes || 
          []
        )
      };

      return { person, caseRecord };
    });
  };

  const transformFinancialItems = (items: any[]) => {
    if (!Array.isArray(items)) return [];
    
    return items.map((item: any) => ({
      description: item.description || item.name || item.type || 'Imported Item',
      amount: parseFloat(item.amount || item.value || '0'),
      frequency: item.frequency || 'monthly',
      verificationStatus: item.verificationStatus || item.status || 'Needs VR',
      verificationSource: item.verificationSource || item.source || '',
      location: item.location || item.institution || item.bank || '',
      accountNumber: item.accountNumber || item.account || '',
      notes: item.notes || item.comments || ''
    }));
  };

  const transformNotes = (notes: any[]) => {
    if (!Array.isArray(notes)) return [];
    
    return notes.map((note: any) => ({
      content: note.content || note.text || note.note || '',
      createdAt: note.createdAt || note.date || new Date().toISOString(),
      createdBy: note.createdBy || note.author || 'System'
    }));
  };

  const handleImport = async () => {
    if (!selectedFile || !validation?.isValid) return;

    const toastId = toast.loading("Starting import...");
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const text = await selectedFile.text();
      const rawData = JSON.parse(text);
      
      let transformedCases: { person: NewPersonData; caseRecord: NewCaseRecordData }[];
      let migrationUsed = '';

      // Check if this needs Nightingale migration
      if (validation.needsMigration && validation.migrationSource === 'Nightingale') {
        toast.loading("🔄 Running Nightingale migration...", { id: toastId });
        
        // Create a lookup map for people by their ID. This is the key fix.
        const peopleMap = new Map((rawData.people || []).map((p: any) => [p.id, p]));

        const migrationResult = migrateNightingaleData(rawData);
        
        if (!migrationResult.success) {
          throw new Error(`Migration failed: ${migrationResult.error}`);
        }
        
        if (!migrationResult.cases || migrationResult.cases.length === 0) {
          throw new Error('Migration completed but no cases were converted');
        }

        // Map the correct person to each case using the personId
        transformedCases = migrationResult.cases.map((caseDisplay: CaseDisplay) => {
          const personInfo = peopleMap.get(caseDisplay.caseRecord.personId);

          if (!personInfo) {
            console.warn(`Could not find person for MCN ${caseDisplay.caseRecord.mcn} with personId ${caseDisplay.caseRecord.personId}.`);
            // Fallback to whatever the migration utility provided
            return { person: caseDisplay.person, caseRecord: caseDisplay.caseRecord };
          }

          // Split the full name into first and last names
          const nameParts = (personInfo.name || '').split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          // Construct the full person object for the API
          const person: NewPersonData = {
            firstName,
            lastName,
            middleName: personInfo.middleName || '',
            email: personInfo.email || '',
            phone: personInfo.phone || '',
            dateOfBirth: personInfo.dateOfBirth || '',
            ssn: personInfo.ssn || '',
            address: {
              street: personInfo.address?.street || '',
              city: personInfo.address?.city || '',
              state: personInfo.address?.state || '',
              zipCode: personInfo.address?.zip || personInfo.address?.zipCode || '',
              county: ''
            },
            householdSize: 1,
            maritalStatus: '',
            employmentStatus: ''
          };

          // Debug the migrated financial data structure
          const migratedFinancials = caseDisplay.caseRecord.financials;
          const resourcesCount = migratedFinancials?.resources?.length || 0;
          const incomeCount = migratedFinancials?.income?.length || 0;
          const expensesCount = migratedFinancials?.expenses?.length || 0;
          
          // Construct the complete case record, preserving migrated financials
          const caseRecord: NewCaseRecordData = {
            mcn: caseDisplay.caseRecord.mcn,
            status: caseDisplay.caseRecord.status,
            priority: caseDisplay.caseRecord.priority ? 'High' : 'Normal',
            assignedTo: '',
            dateOpened: caseDisplay.caseRecord.applicationDate.split('T')[0],
            lastUpdated: caseDisplay.caseRecord.updatedDate.split('T')[0],
            financials: migratedFinancials, // Preserve the migrated financials!
            notes: caseDisplay.caseRecord.notes?.map(note => ({
              content: note.content,
              createdAt: note.createdAt,
              createdBy: 'Migrated'
            })) || []
          };

          return { person, caseRecord };
        });
        
        migrationUsed = '🔄 Nightingale';
      } else {
        // Use standard legacy data transformation
        transformedCases = transformLegacyData(rawData);
        migrationUsed = 'Standard';
      }

      const results: ImportResult = {
        success: 0,
        failed: 0,
        errors: [],
        imported: []
      };

      const dataAPI = getDataAPI();
      if (!dataAPI) {
        throw new Error('Data storage is not available. Please check your file system connection.');
      }

      toast.loading(`Importing ${transformedCases.length} cases... (${migrationUsed})`, { id: toastId });

      // Use bulk import for file storage to prevent race conditions
      if (dataAPI.createMultipleCases) {
        try {
          const importedCases = await dataAPI.createMultipleCases(
            transformedCases,
            (current, total) => {
              const progress = (current / total) * 100;
              setUploadProgress(progress);
              
              if (current % Math.ceil(total / 4) === 0 || current === total) {
                toast.loading(`Importing... ${current}/${total} cases processed (${migrationUsed})`, { id: toastId });
              }
            }
          );
          results.imported = importedCases;
          results.success = importedCases.length;
          setUploadProgress(100);
        } catch (error) {
          results.failed = transformedCases.length;
          results.errors.push(`Bulk import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        // Fallback to individual case creation for API mode or older implementations
        for (let i = 0; i < transformedCases.length; i++) {
          try {
            const caseData = transformedCases[i];
            
            const importedCase = await dataAPI.createCompleteCase(caseData);
            
            results.imported.push(importedCase);
            results.success++;
          } catch (error) {
            results.failed++;
            results.errors.push(`Failed to import case ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }

          setUploadProgress(((i + 1) / transformedCases.length) * 100);
          
          if ((i + 1) % Math.ceil(transformedCases.length / 4) === 0) {
            toast.loading(`Importing... ${i + 1}/${transformedCases.length} cases processed (${migrationUsed})`, { id: toastId });
          }
        }
      }

      setImportResult(results);
      
      if (results.success > 0) {
        const successMsg = migrationUsed === '🔄 Nightingale' ? 
          `Successfully migrated and imported all ${results.success} cases from Nightingale format!` :
          `Successfully imported all ${results.success} cases!`;
        
        if (results.failed === 0) {
          toast.success(successMsg, { id: toastId });
        } else {
          toast.success(`Import completed (${migrationUsed}): ${results.success} successful, ${results.failed} failed`, { id: toastId });
        }
        
        onImportComplete(results.imported);
        
        // Delay notifying file storage to ensure bulk operations are complete
        setTimeout(() => {
          notifyFileStorageChange();
        }, 100);
      } else {
        toast.error(`Import failed: No cases could be imported`, { id: toastId });
      }
    } catch (error) {
      const errorMsg = `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      toast.error(errorMsg, { id: toastId });
      
      setImportResult({
        success: 0,
        failed: 1,
        errors: [errorMsg],
        imported: []
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetUploader = () => {
    setSelectedFile(null);
    setValidation(null);
    setImportResult(null);
    setPreviewData(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Legacy Data
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Selection */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Select JSON File
            </Button>
            {selectedFile && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
                <Button variant="ghost" size="sm" onClick={resetUploader}>
                  Clear
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Supported formats:</strong> JSON files containing case data with person information and financial records. 
                Both single cases and arrays of cases are supported. Nightingale data format is automatically detected and migrated.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  try {
                    downloadSampleJson();
                    toast.success("Sample JSON file downloaded successfully");
                  } catch (error) {
                    toast.error("Failed to download sample JSON file");
                  }
                }}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Sample
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHelp(!showHelp)}
                className="gap-2"
              >
                <HelpCircle className="h-4 w-4" />
                Help
              </Button>
            </div>
          </div>

          {/* Help Documentation */}
          <Collapsible open={showHelp} onOpenChange={setShowHelp}>
            <CollapsibleContent>
              <Card className="mt-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{documentation.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {documentation.sections.map((section, index) => (
                    <div key={index}>
                      <h4 className="font-medium mb-2">{section.title}</h4>
                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {section.content.map((item, itemIndex) => (
                          <li key={itemIndex}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Validation Results */}
        {validation && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {validation.isValid ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">
                {validation.isValid ? 'File Valid' : 'Validation Failed'}
              </span>
              <Badge variant="outline">
                {validation.caseCount} cases found
              </Badge>
              {validation.needsMigration && (
                <Badge variant="secondary" className="gap-1">
                  🔄 {validation.migrationSource} Migration
                </Badge>
              )}
            </div>

            {validation.errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Errors:</strong>
                  <ul className="list-disc list-inside mt-2">
                    {validation.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validation.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warnings:</strong>
                  <ul className="list-disc list-inside mt-2">
                    {validation.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Preview Data */}
        {previewData && validation?.isValid && (
          <div className="space-y-4">
            <h3 className="font-medium">Preview (First 3 cases)</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {previewData.map((item: any, index: number) => (
                <Card key={index} className="p-3">
                  <div className="text-sm">
                    <div className="font-medium">
                      {item.person?.firstName || item.firstName} {item.person?.lastName || item.lastName}
                    </div>
                    <div className="text-muted-foreground">
                      MCN: {item.caseRecord?.mcn || item.mcn || item.caseNumber || 'Not specified'}
                    </div>
                    <div className="text-muted-foreground">
                      Financial items: {
                        (item.caseRecord?.financials?.resources?.length || item.resources?.length || 0) +
                        (item.caseRecord?.financials?.income?.length || item.income?.length || 0) +
                        (item.caseRecord?.financials?.expenses?.length || item.expenses?.length || 0)
                      }
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Import Progress */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Importing cases...</span>
              <span className="text-sm text-muted-foreground">{uploadProgress.toFixed(0)}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {/* Import Results */}
        {importResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="font-medium">Import Complete</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{importResult.success}</div>
                  <div className="text-sm text-muted-foreground">Successfully Imported</div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </Card>
            </div>

            {importResult.errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Import Errors:</strong>
                  <ul className="list-disc list-inside mt-2">
                    {importResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          {importResult ? (
            <Button onClick={resetUploader}>
              Import Another File
            </Button>
          ) : (
            <>
              <Button
                onClick={handleImport}
                disabled={!validation?.isValid || isUploading}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {isUploading ? 'Importing...' : 
                  validation?.needsMigration ? 
                    `Migrate & Import ${validation.caseCount || 0} Cases` :
                    `Import ${validation?.caseCount || 0} Cases`
                }
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}