import React, { useState, useEffect } from 'react';
import { useFileStorage } from "@/contexts/FileStorageContext";
import { toast } from "sonner";
import { 
  Plus, 
  Search, 
  Save, 
  X, 
  User, 
  Calendar, 
  Trash2, 
  Edit2,
  Database,
  Moon,
  Sun,
  FileText,
  PenTool,
  Activity,
  Vote,
  ShieldCheck,
  Mail,
  MessageSquare,
  Phone,
  AtSign,
  Baby
} from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarPicker } from "@/components/ui/calendar-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ==========================================================================
   CONSTANTS & CONFIGURATION
   ========================================================================== */

// Placeholder options for Living Arrangement
const LIVING_OPTIONS = [
  { value: '', label: 'Select Arrangement...' },
  { value: 'Home', label: 'Own Home / Rental' },
  { value: 'Facility', label: 'Nursing Facility' },
  { value: 'Unhoused', label: 'Unhoused' },
  { value: 'Other', label: 'Other' }
];

interface CaseEntry {
  id: string;
  createdAt?: string;
  masterCaseNumber: string;
  applicationDate: string;
  firstName: string;
  lastName: string;
  dob: string;
  address: string;
  isAged: boolean;
  isDisabled: boolean;
  signatureType: string;
  repName: string;
  repAuthSource: string;
  contactMethods: string[];
  phoneNumber: string;
  emailAddress: string;
  hasAuthRep: boolean;
  authRepName: string;
  authRepPhone: string;
  livingArrangement: string;
  agedDisabledVerified: boolean;
  maritalStatus: string;
  maritalStatusDate: string;
  isPregnant: boolean;
  citizenshipVerified: boolean;
  residencyVerified: boolean;
  avsConsentDate: string;
  voterRegistration: string;
}

type FormData = Omit<CaseEntry, 'id' | 'createdAt'>;

/* ==========================================================================
   MAIN COMPONENT
   ========================================================================== */

export default function App() {
  const { service, isConnected, connectToFolder } = useFileStorage();
  
  /* ==============================
     STATE MANAGEMENT
     ============================== */

  // --- Persistence State ---
  
  // Initialize entries from localStorage if available
  const [entries, setEntries] = useState<CaseEntry[]>(() => {
    const saved = localStorage.getItem('personal_db_entries');
    return saved ? JSON.parse(saved) : [];
  });

  // Initialize dark mode from localStorage
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('personal_db_dark_mode');
    return saved ? JSON.parse(saved) : true;
  });

  // --- UI State ---
  
  const [view, setView] = useState<'list' | 'form'>('list'); // 'list' or 'form'
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'applicant_details', 'eligibility'
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null); // ID of item to delete

  // --- Form Data State ---
  
  const [formData, setFormData] = useState<FormData>({
    // Tab 1: Case Info
    masterCaseNumber: '',
    applicationDate: '',
    
    // Tab 1: Client Identity
    firstName: '',
    lastName: '',
    dob: '',
    address: '',
    
    // Tab 1: Indicators
    isAged: false,
    isDisabled: false,
    
    // Tab 1: Signature Verification
    signatureType: 'client', // 'client' or 'authorized_rep'
    repName: '', // The specific person who signed
    repAuthSource: '',

    // Tab 2: Applicant Details (NEW)
    contactMethods: ['mail'], // Array of strings: 'mail', 'text', 'email'
    phoneNumber: '',
    emailAddress: '',
    hasAuthRep: false, // General case contact rep
    authRepName: '',
    authRepPhone: '',
    livingArrangement: '', // Moved from Tab 1
    agedDisabledVerified: false,
    maritalStatus: '',
    maritalStatusDate: '',
    isPregnant: false,

    // Tab 3: Eligibility
    citizenshipVerified: false,
    residencyVerified: false,
    avsConsentDate: '',
    voterRegistration: 'not_answered'
  });

  /* ==============================
     EFFECTS
     ============================== */

  // --- Persistence Effects ---

  // Load from file storage when connected
  useEffect(() => {
    const loadFromFile = async () => {
      if (isConnected && service) {
        try {
          const data = await service.readNamedFile('prototype-cases.json');
          if (data && Array.isArray(data)) {
            setEntries(data);
            toast.success("Loaded records from file storage");
          }
        } catch (error) {
          console.error("Failed to load prototype cases", error);
        }
      }
    };
    
    loadFromFile();
  }, [isConnected, service]);

  // Save to localStorage AND File Storage whenever entries change
  useEffect(() => {
    // Always save to local storage as backup/cache
    localStorage.setItem('personal_db_entries', JSON.stringify(entries));
    
    // Save to file storage if connected
    const saveToFile = async () => {
      if (isConnected && service) {
        try {
          await service.writeNamedFile('prototype-cases.json', entries);
        } catch (error) {
          console.error("Failed to save prototype cases to file", error);
        }
      }
    };
    
    // Debounce slightly to avoid too many writes
    const timeoutId = setTimeout(saveToFile, 1000);
    return () => clearTimeout(timeoutId);
  }, [entries, isConnected, service]);

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('personal_db_dark_mode', JSON.stringify(darkMode));
  }, [darkMode]);

  // --- Automation Effects ---

  // Autofill Auth Rep from Signature if applicable
  // We only do this when the user switches to Tab 2 to avoid overwriting manual changes aggressively
  useEffect(() => {
    if (activeTab === 'applicant_details' && formData.signatureType === 'authorized_rep' && !formData.hasAuthRep && formData.repName) {
      setFormData(prev => ({
        ...prev,
        hasAuthRep: true,
        authRepName: prev.authRepName || prev.repName // Only fill if empty
      }));
    }
  }, [activeTab, formData.signatureType, formData.repName, formData.hasAuthRep]);

  /* ==============================
     HANDLERS
     ============================== */

  // --- Form Input Handlers ---

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwitchChange = (name: keyof FormData, checked: boolean | 'indeterminate') => {
    // Convert 'indeterminate' to false for our form data
    const boolValue = checked === true;
    setFormData(prev => ({ ...prev, [name]: boolValue }));
  };

  const handleDateChange = (name: keyof FormData, date: Date | undefined) => {
    // Convert Date object to YYYY-MM-DD string
    const dateString = date ? date.toISOString().split('T')[0] : '';
    setFormData(prev => {
      const newData = { ...prev, [name]: dateString };
      
      // Automate "Over 65" check based on DOB
      if (name === 'dob' && date) {
        const today = new Date();
        let age = today.getFullYear() - date.getFullYear();
        const m = today.getMonth() - date.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
          age--;
        }
        newData.isAged = age >= 65;
      }
      
      return newData;
    });
  };

  const toggleContactMethod = (method: string) => {
    setFormData(prev => {
      const current = prev.contactMethods || [];
      if (current.includes(method)) {
        return { ...prev, contactMethods: current.filter(m => m !== method) };
      } else {
        return { ...prev, contactMethods: [...current, method] };
      }
    });
  };

  // --- Action Handlers (CRUD) ---

  const handleEdit = (entry: CaseEntry) => {
    setFormData({
      // Defaults ensure no undefined errors on legacy data
      masterCaseNumber: entry.masterCaseNumber || '',
      applicationDate: entry.applicationDate || '',
      firstName: entry.firstName || '',
      lastName: entry.lastName || '',
      dob: entry.dob || '',
      address: entry.address || '',
      isAged: entry.isAged || false,
      isDisabled: entry.isDisabled || false,
      signatureType: entry.signatureType || 'client',
      repName: entry.repName || '',
      repAuthSource: entry.repAuthSource || '',
      
      contactMethods: entry.contactMethods || ['mail'],
      phoneNumber: entry.phoneNumber || '',
      emailAddress: entry.emailAddress || '',
      hasAuthRep: entry.hasAuthRep || false,
      authRepName: entry.authRepName || '',
      authRepPhone: entry.authRepPhone || '',
      livingArrangement: entry.livingArrangement || '',
      agedDisabledVerified: entry.agedDisabledVerified || false,
      maritalStatus: entry.maritalStatus || '',
      maritalStatusDate: entry.maritalStatusDate || '',
      isPregnant: entry.isPregnant || false,

      citizenshipVerified: entry.citizenshipVerified || false,
      residencyVerified: entry.residencyVerified || false,
      avsConsentDate: entry.avsConsentDate || '',
      voterRegistration: entry.voterRegistration || 'not_answered'
    });
    setEditingId(entry.id);
    setActiveTab('details');
    setView('form');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
      // Update existing
      setEntries(prev => prev.map(entry => 
        entry.id === editingId ? { ...formData, id: editingId } : entry
      ));
    } else {
      // Create new
      const newEntry: CaseEntry = {
        ...formData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      };
      setEntries(prev => [...prev, newEntry]);
    }
    
    // Reset and go back to list
    resetForm();
    setView('list');
  };

  const initiateDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      setEntries(prev => prev.filter(entry => entry.id !== deleteId));
      setDeleteId(null);
    }
  };

  // --- Utility Handlers ---

  const resetForm = () => {
    setFormData({
      masterCaseNumber: '',
      applicationDate: '',
      firstName: '',
      lastName: '',
      dob: '',
      address: '',
      isAged: false,
      isDisabled: false,
      signatureType: 'client',
      repName: '',
      repAuthSource: '',
      contactMethods: ['mail'],
      phoneNumber: '',
      emailAddress: '',
      hasAuthRep: false,
      authRepName: '',
      authRepPhone: '',
      livingArrangement: '',
      agedDisabledVerified: false,
      maritalStatus: '',
      maritalStatusDate: '',
      isPregnant: false,
      citizenshipVerified: false,
      residencyVerified: false,
      avsConsentDate: '',
      voterRegistration: 'not_answered'
    });
    setEditingId(null);
    setActiveTab('details');
  };

  const handleCancel = () => {
    resetForm();
    setView('list');
  };

  /* ==============================
     COMPUTED VALUES
     ============================== */

  // Filter entries based on search
  const filteredEntries = entries.filter(entry => {
    const searchLower = searchTerm.toLowerCase();
    return (
      entry.firstName.toLowerCase().includes(searchLower) ||
      entry.lastName.toLowerCase().includes(searchLower) ||
      (entry.masterCaseNumber && entry.masterCaseNumber.toLowerCase().includes(searchLower))
    );
  });

  /* ==============================
     RENDER
     ============================== */

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans dark:bg-slate-900 dark:text-slate-100 transition-colors duration-200 relative">
        
        {/* --- MODAL: DELETE CONFIRMATION --- */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Case?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this case permanently? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* --- HEADER --- */}
        <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10 dark:bg-blue-800 transition-colors">
          <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={24} />
              <h1 className="text-xl font-bold">Local Records</h1>
            </div>
            
            <div className="flex items-center gap-3">
              {!isConnected && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => connectToFolder()}
                  className="text-white/80 hover:text-white hover:bg-blue-500/50 hidden sm:flex"
                >
                  Connect Storage
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDarkMode(!darkMode)}
                className="text-white hover:bg-blue-500/50 hover:text-white"
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </Button>

              {view === 'list' && (
                <Button 
                  onClick={() => setView('form')}
                  className="bg-white text-blue-600 hover:bg-blue-50 dark:bg-slate-800 dark:text-blue-400 dark:hover:bg-slate-700 border-none"
                >
                  <Plus size={18} className="mr-2" />
                  <span className="hidden sm:inline">New Entry</span>
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6">
          
          {view === 'list' ? (
            <div className="space-y-6">
              {/* --- SEARCH BAR --- */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <Input
                  type="text"
                  placeholder="Search by name or case number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* --- VIEW: LIST --- */}
              {filteredEntries.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-slate-700">
                    <User className="text-slate-400" size={32} />
                  </div>
                  <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200">No records found</h3>
                  <p className="text-slate-500 mt-1 dark:text-slate-400">Get started by adding a new case.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                  {filteredEntries.map(entry => (
                    <Card key={entry.id} className="hover:shadow-md transition-shadow group relative">
                      <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg dark:bg-blue-900/50 dark:text-blue-300">
                              {entry.firstName ? entry.firstName[0] : '?'}{entry.lastName ? entry.lastName[0] : '?'}
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg leading-tight dark:text-slate-100">{entry.firstName} {entry.lastName}</h3>
                              {entry.masterCaseNumber && (
                                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">#{entry.masterCaseNumber}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(entry)}
                              title="Edit Case"
                            >
                              <Edit2 size={18} />
                            </Button>
                            <Button 
                              variant="ghost"
                              size="icon"
                              onClick={() => initiateDelete(entry.id)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                              title="Delete Case"
                            >
                              <Trash2 size={18} />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400 mt-4">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg dark:bg-slate-700/50">
                              <Calendar size={16} className="text-slate-400" />
                              <span>{entry.dob || 'N/A'}</span>
                            </div>
                            {entry.isAged && (
                              <div className="flex items-center gap-2 bg-amber-50 text-amber-700 p-2 rounded-lg dark:bg-amber-900/30 dark:text-amber-400">
                                <User size={16} />
                                <span>65+</span>
                              </div>
                            )}
                            {entry.isDisabled && (
                              <div className="flex items-center gap-2 bg-purple-50 text-purple-700 p-2 rounded-lg dark:bg-purple-900/30 dark:text-purple-400">
                                <Activity size={16} />
                                <span>Disability</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
                  <CardTitle className="text-xl">{editingId ? 'Edit Case' : 'New Case Intake'}</CardTitle>
                  <Button variant="ghost" size="icon" onClick={handleCancel}>
                    <X size={24} />
                  </Button>
                </CardHeader>
                
                <CardContent>
                  <form onSubmit={handleSave}>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-3 mb-8">
                        <TabsTrigger value="details">1. Application</TabsTrigger>
                        <TabsTrigger value="applicant_details">2. Applicant</TabsTrigger>
                        <TabsTrigger value="eligibility">3. Eligibility</TabsTrigger>
                      </TabsList>

                      <TabsContent value="details" className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-200">
                        {/* SECTION 1: CASE INFORMATION */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                            <FileText size={16} />
                            Case Information
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Master Case Number</Label>
                              <Input
                                required
                                name="masterCaseNumber"
                                value={formData.masterCaseNumber}
                                onChange={handleInputChange}
                                placeholder="CASE-2024-001"
                                className="font-mono"
                              />
                            </div>
                            <div className="space-y-2">
                              <CalendarPicker
                                label="Application Date"
                                date={formData.applicationDate ? new Date(formData.applicationDate) : undefined}
                                onDateChange={(date) => handleDateChange('applicationDate', date)}
                              />
                            </div>
                          </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-700" />

                        {/* SECTION 2: CLIENT DETAILS */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                            <User size={16} />
                            Client Details
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>First Name</Label>
                              <Input
                                required
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleInputChange}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Last Name</Label>
                              <Input
                                required
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleInputChange}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <CalendarPicker
                                label="Date of Birth"
                                date={formData.dob ? new Date(formData.dob) : undefined}
                                onDateChange={(date) => handleDateChange('dob', date)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Address</Label>
                              <Textarea
                                name="address"
                                value={formData.address}
                                onChange={handleInputChange}
                                rows={2}
                                placeholder="Street, City, State, Zip"
                                className="resize-none"
                              />
                            </div>
                          </div>

                          {/* FLAGS */}
                          <div className="flex flex-col sm:flex-row gap-4 pt-2">
                            <div className={`flex-1 flex items-center gap-3 p-3 rounded-xl border transition-all ${formData.isAged ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-700 dark:border-slate-600'}`}>
                              <Checkbox 
                                id="isAged"
                                checked={formData.isAged}
                                onCheckedChange={(checked) => handleSwitchChange('isAged', checked)}
                              />
                              <div className="grid gap-1.5 leading-none">
                                <Label htmlFor="isAged" className="font-medium">Age 65+</Label>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Client is aged</p>
                              </div>
                            </div>

                            <div className={`flex-1 flex items-center gap-3 p-3 rounded-xl border transition-all ${formData.isDisabled ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-700 dark:border-slate-600'}`}>
                              <Checkbox 
                                id="isDisabled"
                                checked={formData.isDisabled}
                                onCheckedChange={(checked) => handleSwitchChange('isDisabled', checked)}
                              />
                              <div className="grid gap-1.5 leading-none">
                                <Label htmlFor="isDisabled" className="font-medium">Disability</Label>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Client has disability</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-700" />

                        {/* SECTION 3: SIGNATURE VERIFICATION */}
                        <div className="space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                            <PenTool size={16} />
                            Signature Verification
                          </h3>
                          
                          <div className="space-y-3">
                            <Label>Who signed the application?</Label>
                            <RadioGroup 
                              value={formData.signatureType} 
                              onValueChange={(val) => handleSelectChange('signatureType', val)}
                              className="flex gap-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="client" id="sig-client" />
                                <Label htmlFor="sig-client">Client</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="authorized_rep" id="sig-rep" />
                                <Label htmlFor="sig-rep">Authorized Representative</Label>
                              </div>
                            </RadioGroup>
                          </div>

                          {/* Conditional Fields for Auth Rep */}
                          {formData.signatureType === 'authorized_rep' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl animate-in slide-in-from-top-2">
                              <div className="space-y-2">
                                <Label>Representative Name</Label>
                                <Input
                                  name="repName"
                                  value={formData.repName}
                                  onChange={handleInputChange}
                                  placeholder="Jane Doe (Rep)"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Verification Source</Label>
                                <Input
                                  name="repAuthSource"
                                  value={formData.repAuthSource}
                                  onChange={handleInputChange}
                                  placeholder="e.g. Power of Attorney Doc"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    
                      <TabsContent value="applicant_details" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                        
                        <div className="space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                            <User size={16} />
                            Applicant Details
                          </h3>
                          
                          {/* Contact Methods */}
                          <div className="space-y-2">
                            <Label>Preferred Contact Method(s)</Label>
                            <div className="flex gap-3 flex-wrap">
                              {[
                                { id: 'mail', label: 'US Mail', icon: Mail },
                                { id: 'text', label: 'Text Message', icon: MessageSquare },
                                { id: 'email', label: 'Email', icon: AtSign }
                              ].map(method => (
                                <Button
                                  key={method.id}
                                  type="button"
                                  variant={formData.contactMethods.includes(method.id) ? "default" : "outline"}
                                  onClick={() => toggleContactMethod(method.id)}
                                  className="gap-2"
                                >
                                  <method.icon size={16} />
                                  {method.label}
                                </Button>
                              ))}
                            </div>
                          </div>

                          {/* Contact Details */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Phone Number</Label>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <Input
                                  name="phoneNumber"
                                  value={formData.phoneNumber}
                                  onChange={handleInputChange}
                                  className="pl-10"
                                  placeholder="(555) 555-5555"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Email Address</Label>
                              <div className="relative">
                                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <Input
                                  name="emailAddress"
                                  value={formData.emailAddress}
                                  onChange={handleInputChange}
                                  className="pl-10"
                                  placeholder="name@example.com"
                                />
                              </div>
                            </div>
                          </div>

                          <hr className="border-slate-100 dark:border-slate-700" />

                          {/* Authorized Representative Toggle */}
                          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                            <div className="space-y-0.5">
                              <Label className="text-base">Has Authorized Representative?</Label>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Designate a contact person for this case</p>
                            </div>
                            <Switch 
                              checked={formData.hasAuthRep}
                              onCheckedChange={(checked) => handleSwitchChange('hasAuthRep', checked)}
                            />
                          </div>

                          {/* Auth Rep Details (Conditional) */}
                          {formData.hasAuthRep && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                              <div className="space-y-2">
                                <Label>Authorized Representative Name</Label>
                                <Input
                                  name="authRepName"
                                  value={formData.authRepName}
                                  onChange={handleInputChange}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Authorized Representative Phone</Label>
                                <Input
                                  name="authRepPhone"
                                  value={formData.authRepPhone}
                                  onChange={handleInputChange}
                                  placeholder="(555) 555-5555"
                                />
                              </div>
                            </div>
                          )}
                          
                          <div className="space-y-2">
                            <Label>Living Arrangement</Label>
                            <Select 
                              value={formData.livingArrangement} 
                              onValueChange={(val) => handleSelectChange('livingArrangement', val)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select Arrangement..." />
                              </SelectTrigger>
                              <SelectContent>
                                {LIVING_OPTIONS.filter(opt => opt.value !== '').map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${formData.agedDisabledVerified ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-700 dark:border-slate-600'}`}>
                            <Checkbox 
                              id="agedDisabledVerified"
                              checked={formData.agedDisabledVerified}
                              onCheckedChange={(checked) => handleSwitchChange('agedDisabledVerified', checked)}
                            />
                            <Label htmlFor="agedDisabledVerified" className="font-medium cursor-pointer">Aged/Disabled Status Verified</Label>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Marital Status</Label>
                              <Input
                                name="maritalStatus"
                                value={formData.maritalStatus}
                                onChange={handleInputChange}
                                placeholder="e.g., Single, Married"
                              />
                            </div>
                            <div className="space-y-2">
                              <CalendarPicker
                                label="Marital Status Verification Date"
                                date={formData.maritalStatusDate ? new Date(formData.maritalStatusDate) : undefined}
                                onDateChange={(date) => handleDateChange('maritalStatusDate', date)}
                              />
                            </div>
                          </div>
                          
                          <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${formData.isPregnant ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-700 dark:border-slate-600'}`}>
                            <Checkbox 
                              id="isPregnant"
                              checked={formData.isPregnant}
                              onCheckedChange={(checked) => handleSwitchChange('isPregnant', checked)}
                            />
                            <div className="flex items-center gap-2">
                              <Baby size={20} className="text-slate-500 dark:text-slate-400" />
                              <Label htmlFor="isPregnant" className="font-medium cursor-pointer">Pregnancy</Label>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="eligibility" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                        
                        <div className="space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                            <ShieldCheck size={16} />
                            Eligibility Verification
                          </h3>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${formData.citizenshipVerified ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-700 dark:border-slate-600'}`}>
                              <Checkbox 
                                id="citizenshipVerified"
                                checked={formData.citizenshipVerified}
                                onCheckedChange={(checked) => handleSwitchChange('citizenshipVerified', checked)}
                              />
                              <Label htmlFor="citizenshipVerified" className="font-medium cursor-pointer">Citizenship Verified</Label>
                            </div>

                            <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${formData.residencyVerified ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-700 dark:border-slate-600'}`}>
                              <Checkbox 
                                id="residencyVerified"
                                checked={formData.residencyVerified}
                                onCheckedChange={(checked) => handleSwitchChange('residencyVerified', checked)}
                              />
                              <Label htmlFor="residencyVerified" className="font-medium cursor-pointer">Residency Verified</Label>
                            </div>
                          </div>

                          <div className="space-y-2 max-w-md">
                            <CalendarPicker
                              label="AVS Consent Date"
                              date={formData.avsConsentDate ? new Date(formData.avsConsentDate) : undefined}
                              onDateChange={(date) => handleDateChange('avsConsentDate', date)}
                            />
                          </div>
                        </div>

                        <hr className="border-slate-100 dark:border-slate-700" />

                        <div className="space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                            <Vote size={16} />
                            Voter Form
                          </h3>
                          
                          <div className="flex flex-wrap gap-3">
                            {[
                              { value: 'requested', label: 'Requested' },
                              { value: 'declined', label: 'Declined' },
                              { value: 'not_answered', label: 'Not Answered' }
                            ].map(option => (
                              <Button
                                key={option.value}
                                type="button"
                                variant={formData.voterRegistration === option.value ? "default" : "outline"}
                                onClick={() => setFormData(prev => ({ ...prev, voterRegistration: option.value }))}
                                className="px-6"
                              >
                                {option.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>

                    {/* Footer / Action Buttons - Always Visible */}
                    <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancel}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="flex-1 gap-2"
                      >
                        <Save size={20} />
                        Save Record
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}