import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

// Interfaces matching the new schema
interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface MailingAddress extends Address {
  sameAsPhysical: boolean;
}

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  ssn: string;
  organizationId: string | null;
  livingArrangement: string;
  address: Address;
  mailingAddress: MailingAddress;
  authorizedRepIds: string[];
  familyMembers: string[];
  status: string;
  createdAt: string;
  dateAdded: string;
}

interface FinancialItem {
  id: string;
  name?: string; // For backward compatibility
  description: string;
  location?: string;
  accountNumber?: string;
  amount: number;
  frequency?: string;
  owner?: string;
  verificationStatus: 'Needs VR' | 'VR Pending' | 'AVS Pending' | 'Verified';
  verificationSource?: string;
  notes?: string;
  dateAdded?: string;
  status?: 'VR Pending' | 'UI Pending' | 'Approved' | 'Denied' | 'In Progress' | 'Completed'; // For backward compatibility
  createdAt?: string;
  updatedAt?: string;
}

interface Note {
  id: string;
  category: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface Financials {
  resources: FinancialItem[];
  income: FinancialItem[];
  expenses: FinancialItem[];
}

interface CaseRecord {
  id: string;
  mcn: string;
  applicationDate: string;
  caseType: string;
  personId: string;
  spouseId: string;
  status: 'In Progress' | 'Priority' | 'Review' | 'Completed';
  description: string;
  priority: boolean;
  livingArrangement: string;
  withWaiver: boolean;
  admissionDate: string;
  organizationId: string;
  authorizedReps: string[];
  retroRequested: string;
  financials: Financials;
  notes: Note[];
  createdDate: string;
  updatedDate: string;
}

interface CaseData {
  people: Person[];
  caseRecords: CaseRecord[];
  nextPersonId: number;
  nextCaseId: number;
  nextFinancialItemId: number;
  nextNoteId: number;
  showAllCases: boolean;
  showAllContacts: boolean;
  showAllPeople: boolean;
  showAllOrganizations: boolean;
  caseSortReversed: boolean;
  priorityFilterActive: boolean;
  contacts: any[];
  vrTemplates: any[];
  nextVrTemplateId: number;
  vrCategories: any[];
  vrRequests: any[];
  nextVrRequestId: number;
  vrDraftItems: any[];
  activeCase: string | null;
  isDataLoaded: boolean;
  meta: {
    source: string;
  };
}

interface CaseDisplay {
  id: string;
  name: string;
  mcn: string;
  status: CaseRecord['status'];
  priority: boolean;
  createdAt: string;
  updatedAt: string;
  person: Person;
  caseRecord: CaseRecord;
}

const app = new Hono();

// Create a minimal server-side auth verification function
const verifyAuthToken = async (token: string) => {
  try {
    // Simple token verification - in a real app you'd verify JWT properly
    if (!token || token === 'null' || token === 'undefined') {
      return { user: null, error: 'No token provided' };
    }
    
    // For development, we'll accept any non-empty token as valid
    // In production, you'd verify the JWT signature and expiration
    return { 
      user: { 
        id: 'mock-user-id',
        email: 'user@example.com' 
      }, 
      error: null 
    };
  } catch (error) {
    return { user: null, error: 'Invalid token' };
  }
};

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Helper function to get or initialize data
const getOrInitializeData = async (): Promise<CaseData> => {
  let data = await kv.get("case_data");
  
  if (!data) {
    // Initialize with empty data structure matching schema
    const initialData: CaseData = {
      people: [],
      caseRecords: [],
      nextPersonId: 1,
      nextCaseId: 1,
      nextFinancialItemId: 1,
      nextNoteId: 1,
      showAllCases: true,
      showAllContacts: false,
      showAllPeople: true,
      showAllOrganizations: true,
      caseSortReversed: false,
      priorityFilterActive: false,
      contacts: [],
      vrTemplates: [],
      nextVrTemplateId: 1,
      vrCategories: [],
      vrRequests: [],
      nextVrRequestId: 1,
      vrDraftItems: [],
      activeCase: null,
      isDataLoaded: false,
      meta: {
        source: ""
      }
    };
    
    await kv.set("case_data", JSON.stringify(initialData));
    return initialData;
  }
  
  return JSON.parse(data);
};

// Helper function to save data
const saveData = async (data: CaseData): Promise<void> => {
  await kv.set("case_data", JSON.stringify(data));
};

// Helper function to create case display from case record and person
const createCaseDisplay = (caseRecord: CaseRecord, person: Person): CaseDisplay => {
  return {
    id: caseRecord.id,
    name: person.name,
    mcn: caseRecord.mcn,
    status: caseRecord.status,
    priority: caseRecord.priority,
    createdAt: caseRecord.createdDate,
    updatedAt: caseRecord.updatedDate,
    person: person,
    caseRecord: caseRecord
  };
};

// Helper function to verify user authentication
const verifyAuth = async (request: Request): Promise<{ user: any; error?: string }> => {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return { user: null, error: 'No access token provided' };
  }

  const { user, error } = await verifyAuthToken(accessToken);
  if (error || !user) {
    return { user: null, error: error || 'Invalid or expired token' };
  }
  return { user };
};

// Health check endpoint
app.get("/make-server-e57ced6e/health", (c) => {
  return c.json({ status: "ok" });
});

// Database purge endpoint (for development)
app.delete("/make-server-e57ced6e/data/purge", async (c) => {
  try {
    // Reset the database to initial empty state
    const initialData: CaseData = {
      people: [],
      caseRecords: [],
      nextPersonId: 1,
      nextCaseId: 1,
      nextFinancialItemId: 1,
      nextNoteId: 1,
      showAllCases: true,
      showAllContacts: false,
      showAllPeople: true,
      showAllOrganizations: true,
      caseSortReversed: false,
      priorityFilterActive: false,
      contacts: [],
      vrTemplates: [],
      nextVrTemplateId: 1,
      vrCategories: [],
      vrRequests: [],
      nextVrRequestId: 1,
      vrDraftItems: [],
      activeCase: null,
      isDataLoaded: false,
      meta: {
        source: "purged"
      }
    };
    
    await kv.set("case_data", JSON.stringify(initialData));
    console.log("Database purged successfully");
    
    return c.json({ 
      success: true, 
      message: "Database purged successfully",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error purging database:", error);
    return c.json({ error: "Failed to purge database" }, 500);
  }
});

// Authentication endpoints
app.post("/make-server-e57ced6e/auth/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, user_metadata } = body;

    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    // For development, we'll simulate user creation
    // In production, you'd use proper Supabase Auth or your auth system
    const mockUser = {
      id: 'mock-user-' + Date.now(),
      email,
      user_metadata: user_metadata || {},
      created_at: new Date().toISOString(),
    };

    return c.json({ 
      user: mockUser,
      message: "User created successfully" 
    });
  } catch (error) {
    console.error("Error during user creation:", error);
    return c.json({ error: "Failed to create user" }, 500);
  }
});

app.post("/make-server-e57ced6e/auth/verify", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: "No access token provided" }, 401);
    }

    const { user, error } = await verifyAuthToken(accessToken);
    
    if (error || !user) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    return c.json({ user, valid: true });
  } catch (error) {
    console.error("Token verification error:", error);
    return c.json({ error: "Token verification failed" }, 500);
  }
});

// Get all cases (case displays)
app.get("/make-server-e57ced6e/cases", async (c) => {
  try {
    const data = await getOrInitializeData();
    const caseDisplays: CaseDisplay[] = data.caseRecords.map(caseRecord => {
      const person = data.people.find(p => p.id === caseRecord.personId);
      if (!person) {
        throw new Error(`Person not found for case ${caseRecord.id}`);
      }
      return createCaseDisplay(caseRecord, person);
    });
    
    // Debug logging to see what financial data is being returned
    console.log(`Returning ${caseDisplays.length} cases`);
    if (caseDisplays.length > 0) {
      const firstCase = caseDisplays[0];
      console.log(`First case financials:`, {
        resources: firstCase.caseRecord.financials.resources.length,
        income: firstCase.caseRecord.financials.income.length,
        expenses: firstCase.caseRecord.financials.expenses.length
      });
      if (firstCase.caseRecord.financials.resources.length > 0) {
        console.log(`First resource item:`, firstCase.caseRecord.financials.resources[0]);
      }
    }
    
    return c.json(caseDisplays);
  } catch (error) {
    console.error("Error fetching cases:", error);
    return c.json({ error: "Failed to fetch cases" }, 500);
  }
});

// Legacy case creation
app.post("/make-server-e57ced6e/cases/legacy", async (c) => {
  try {
    const body = await c.req.json();
    const data = await getOrInitializeData();
    const now = new Date().toISOString();
    
    // Create a person first
    const newPerson: Person = {
      id: data.nextPersonId.toString(),
      firstName: body.name?.split(' ')[0] || "Unknown",
      lastName: body.name?.split(' ').slice(1).join(' ') || "Person",
      name: body.name || "Unknown Person",
      email: "",
      phone: "",
      dateOfBirth: "",
      ssn: "",
      organizationId: null,
      livingArrangement: "",
      address: { street: "", city: "", state: "", zip: "" },
      mailingAddress: { street: "", city: "", state: "", zip: "", sameAsPhysical: false },
      authorizedRepIds: [],
      familyMembers: [],
      status: "Active",
      createdAt: now,
      dateAdded: now
    };
    
    data.people.push(newPerson);
    data.nextPersonId++;
    
    // Create a case record
    const newCaseRecord: CaseRecord = {
      id: data.nextCaseId.toString(),
      mcn: body.mcn || `MCN-${data.nextCaseId}`,
      applicationDate: now,
      caseType: "Standard",
      personId: newPerson.id,
      spouseId: "",
      status: body.status || 'In Progress',
      description: "",
      priority: body.status === 'Priority',
      livingArrangement: "",
      withWaiver: false,
      admissionDate: "",
      organizationId: "",
      authorizedReps: [],
      retroRequested: "",
      financials: {
        resources: body.resources || [],
        income: body.income || [],
        expenses: body.expenses || []
      },
      notes: (body.notes || []).map((note: string, index: number) => ({
        id: (data.nextNoteId + index).toString(),
        category: 'General',
        content: note,
        createdAt: now,
        updatedAt: now
      })),
      createdDate: now,
      updatedDate: now
    };
    
    data.caseRecords.push(newCaseRecord);
    data.nextCaseId++;
    data.nextNoteId += newCaseRecord.notes.length;
    
    await saveData(data);
    
    const caseDisplay = createCaseDisplay(newCaseRecord, newPerson);
    return c.json(caseDisplay);
  } catch (error) {
    console.error("Error creating legacy case:", error);
    return c.json({ error: "Failed to create legacy case" }, 500);
  }
});

// Create complete case (person + case record)
app.post("/make-server-e57ced6e/cases/complete", async (c) => {
  try {
    const body = await c.req.json();
    const { person: personData, caseRecord: caseData } = body;
    const data = await getOrInitializeData();
    const now = new Date().toISOString();
    
    // Create person
    const newPerson: Person = {
      id: data.nextPersonId.toString(),
      firstName: personData.firstName || "",
      lastName: personData.lastName || "",
      name: `${personData.firstName || ""} ${personData.lastName || ""}`.trim(),
      email: personData.email || "",
      phone: personData.phone || "",
      dateOfBirth: personData.dateOfBirth || "",
      ssn: personData.ssn || "",
      organizationId: null,
      livingArrangement: "",
      address: {
        street: personData.address?.street || "",
        city: personData.address?.city || "",
        state: personData.address?.state || "",
        zip: personData.address?.zipCode || ""
      },
      mailingAddress: {
        street: personData.address?.street || "",
        city: personData.address?.city || "",
        state: personData.address?.state || "",
        zip: personData.address?.zipCode || "",
        sameAsPhysical: true
      },
      authorizedRepIds: [],
      familyMembers: [],
      status: "Active",
      createdAt: now,
      dateAdded: now
    };
    
    data.people.push(newPerson);
    data.nextPersonId++;
    
    // Create case record
    const newCaseRecord: CaseRecord = {
      id: data.nextCaseId.toString(),
      mcn: caseData.mcn || `MCN-${data.nextCaseId}`,
      applicationDate: caseData.dateOpened || now,
      caseType: "Standard",
      personId: newPerson.id,
      spouseId: "",
      status: caseData.status || 'In Progress',
      description: "",
      priority: caseData.priority === 'High',
      livingArrangement: "",
      withWaiver: false,
      admissionDate: "",
      organizationId: "",
      authorizedReps: [],
      retroRequested: "",
      financials: {
        resources: caseData.financials?.resources?.map((item: any) => ({
          id: item.id || `res-${data.nextFinancialItemId++}`,
          name: item.description,
          amount: item.amount || 0,
          status: 'In Progress',
          description: item.description || '',
          location: item.location || '',
          accountNumber: item.accountNumber || '',
          frequency: item.frequency || 'monthly',
          owner: item.owner || 'applicant',
          verificationStatus: item.verificationStatus || 'Needs VR',
          verificationSource: item.verificationSource || '',
          notes: item.notes || '',
          dateAdded: now,
          createdAt: now,
          updatedAt: now
        })) || [],
        income: caseData.financials?.income?.map((item: any) => ({
          id: item.id || `inc-${data.nextFinancialItemId++}`,
          name: item.description,
          amount: item.amount || 0,
          status: 'In Progress',
          description: item.description || '',
          location: item.location || '',
          accountNumber: item.accountNumber || '',
          frequency: item.frequency || 'monthly',
          owner: item.owner || 'applicant',
          verificationStatus: item.verificationStatus || 'Needs VR',
          verificationSource: item.verificationSource || '',
          notes: item.notes || '',
          dateAdded: now,
          createdAt: now,
          updatedAt: now
        })) || [],
        expenses: caseData.financials?.expenses?.map((item: any) => ({
          id: item.id || `exp-${data.nextFinancialItemId++}`,
          name: item.description,
          amount: item.amount || 0,
          status: 'In Progress',
          description: item.description || '',
          location: item.location || '',
          accountNumber: item.accountNumber || '',
          frequency: item.frequency || 'monthly',
          owner: item.owner || 'applicant',
          verificationStatus: item.verificationStatus || 'Needs VR',
          verificationSource: item.verificationSource || '',
          notes: item.notes || '',
          dateAdded: now,
          createdAt: now,
          updatedAt: now
        })) || []
      },
      notes: caseData.notes?.map((note: any) => ({
        id: (data.nextNoteId++).toString(),
        category: 'General',
        content: note.content,
        createdAt: note.createdAt || now,
        updatedAt: now
      })) || [],
      createdDate: now,
      updatedDate: now
    };
    
    data.caseRecords.push(newCaseRecord);
    data.nextCaseId++;
    
    await saveData(data);
    
    const caseDisplay = createCaseDisplay(newCaseRecord, newPerson);
    return c.json(caseDisplay);
  } catch (error) {
    console.error("Error creating complete case:", error);
    return c.json({ error: "Failed to create complete case" }, 500);
  }
});

// Update complete case
app.put("/make-server-e57ced6e/cases/complete/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { person: personData, caseRecord: caseData } = body;
    const data = await getOrInitializeData();
    const now = new Date().toISOString();
    
    const caseIndex = data.caseRecords.findIndex(cr => cr.id === id);
    if (caseIndex === -1) {
      return c.json({ error: "Case record not found" }, 404);
    }
    
    const caseRecord = data.caseRecords[caseIndex];
    const personIndex = data.people.findIndex(p => p.id === caseRecord.personId);
    if (personIndex === -1) {
      return c.json({ error: "Person not found" }, 404);
    }
    
    // Update person
    const updatedPerson: Person = {
      ...data.people[personIndex],
      firstName: personData.firstName || data.people[personIndex].firstName,
      lastName: personData.lastName || data.people[personIndex].lastName,
      name: `${personData.firstName || ""} ${personData.lastName || ""}`.trim(),
      email: personData.email || data.people[personIndex].email,
      phone: personData.phone || data.people[personIndex].phone,
      dateOfBirth: personData.dateOfBirth || data.people[personIndex].dateOfBirth,
      ssn: personData.ssn || data.people[personIndex].ssn,
      address: {
        street: personData.address?.street || data.people[personIndex].address.street,
        city: personData.address?.city || data.people[personIndex].address.city,
        state: personData.address?.state || data.people[personIndex].address.state,
        zip: personData.address?.zipCode || data.people[personIndex].address.zip
      }
    };
    
    data.people[personIndex] = updatedPerson;
    
    // Update case record
    const updatedCaseRecord: CaseRecord = {
      ...caseRecord,
      mcn: caseData.mcn || caseRecord.mcn,
      status: caseData.status || caseRecord.status,
      priority: caseData.priority === 'High',
      updatedDate: now
    };
    
    data.caseRecords[caseIndex] = updatedCaseRecord;
    
    await saveData(data);
    
    const caseDisplay = createCaseDisplay(updatedCaseRecord, updatedPerson);
    return c.json(caseDisplay);
  } catch (error) {
    console.error("Error updating complete case:", error);
    return c.json({ error: "Failed to update complete case" }, 500);
  }
});

// Add financial item to case
app.post("/make-server-e57ced6e/cases/:caseId/items", async (c) => {
  try {
    const caseId = c.req.param("caseId");
    const body = await c.req.json();
    const { category, ...itemData } = body;
    const data = await getOrInitializeData();
    const now = new Date().toISOString();
    
    const caseIndex = data.caseRecords.findIndex(cr => cr.id === caseId);
    if (caseIndex === -1) {
      return c.json({ error: "Case record not found" }, 404);
    }
    
    const caseRecord = data.caseRecords[caseIndex];
    const newItem = {
      id: `${category.slice(0, 3)}-${data.nextFinancialItemId++}`,
      name: itemData.description || itemData.name,
      amount: itemData.amount || 0,
      status: 'In Progress',
      description: itemData.description || '',
      location: itemData.location || '',
      accountNumber: itemData.accountNumber || '',
      frequency: itemData.frequency || 'monthly',
      owner: itemData.owner || 'applicant',
      verificationStatus: itemData.verificationStatus || 'Needs VR',
      verificationSource: itemData.verificationSource || '',
      notes: itemData.notes || '',
      dateAdded: itemData.dateAdded || now,
      createdAt: now,
      updatedAt: now
    };
    
    if (!caseRecord.financials[category as keyof Financials]) {
      caseRecord.financials[category as keyof Financials] = [];
    }
    
    (caseRecord.financials[category as keyof Financials] as FinancialItem[]).push(newItem);
    caseRecord.updatedDate = now;
    
    await saveData(data);
    
    const person = data.people.find(p => p.id === caseRecord.personId);
    if (!person) {
      return c.json({ error: "Person not found" }, 404);
    }
    
    const caseDisplay = createCaseDisplay(caseRecord, person);
    return c.json(caseDisplay);
  } catch (error) {
    console.error("Error adding financial item:", error);
    return c.json({ error: "Failed to add financial item" }, 500);
  }
});

// Update financial item
app.put("/make-server-e57ced6e/cases/:caseId/items/:itemId", async (c) => {
  try {
    const caseId = c.req.param("caseId");
    const itemId = c.req.param("itemId");
    const body = await c.req.json();
    const { category, ...itemData } = body;
    const data = await getOrInitializeData();
    const now = new Date().toISOString();
    
    const caseIndex = data.caseRecords.findIndex(cr => cr.id === caseId);
    if (caseIndex === -1) {
      return c.json({ error: "Case record not found" }, 404);
    }
    
    const caseRecord = data.caseRecords[caseIndex];
    const items = caseRecord.financials[category as keyof Financials] as FinancialItem[];
    const itemIndex = items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      return c.json({ error: "Financial item not found" }, 404);
    }
    
    items[itemIndex] = {
      ...items[itemIndex],
      name: itemData.description || itemData.name || items[itemIndex].name,
      amount: itemData.amount || items[itemIndex].amount,
      description: itemData.description || items[itemIndex].description,
      location: itemData.location || items[itemIndex].location,
      accountNumber: itemData.accountNumber || items[itemIndex].accountNumber,
      frequency: itemData.frequency || items[itemIndex].frequency,
      owner: itemData.owner || items[itemIndex].owner,
      verificationStatus: itemData.verificationStatus || items[itemIndex].verificationStatus,
      verificationSource: itemData.verificationSource || items[itemIndex].verificationSource,
      notes: itemData.notes || items[itemIndex].notes,
      updatedAt: now
    };
    
    caseRecord.updatedDate = now;
    
    await saveData(data);
    
    const person = data.people.find(p => p.id === caseRecord.personId);
    if (!person) {
      return c.json({ error: "Person not found" }, 404);
    }
    
    const caseDisplay = createCaseDisplay(caseRecord, person);
    return c.json(caseDisplay);
  } catch (error) {
    console.error("Error updating financial item:", error);
    return c.json({ error: "Failed to update financial item" }, 500);
  }
});

// Delete financial item
app.delete("/make-server-e57ced6e/cases/:caseId/items/:itemId", async (c) => {
  try {
    const caseId = c.req.param("caseId");
    const itemId = c.req.param("itemId");
    const body = await c.req.json();
    const { category } = body;
    const data = await getOrInitializeData();
    const now = new Date().toISOString();
    
    const caseIndex = data.caseRecords.findIndex(cr => cr.id === caseId);
    if (caseIndex === -1) {
      return c.json({ error: "Case record not found" }, 404);
    }
    
    const caseRecord = data.caseRecords[caseIndex];
    const items = caseRecord.financials[category as keyof Financials] as FinancialItem[];
    const itemIndex = items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      return c.json({ error: "Financial item not found" }, 404);
    }
    
    items.splice(itemIndex, 1);
    caseRecord.updatedDate = now;
    
    await saveData(data);
    
    const person = data.people.find(p => p.id === caseRecord.personId);
    if (!person) {
      return c.json({ error: "Person not found" }, 404);
    }
    
    const caseDisplay = createCaseDisplay(caseRecord, person);
    return c.json(caseDisplay);
  } catch (error) {
    console.error("Error deleting financial item:", error);
    return c.json({ error: "Failed to delete financial item" }, 500);
  }
});

// Add note to case
app.post("/make-server-e57ced6e/cases/:caseId/notes", async (c) => {
  try {
    const caseId = c.req.param("caseId");
    const body = await c.req.json();
    const data = await getOrInitializeData();
    const now = new Date().toISOString();
    
    const caseIndex = data.caseRecords.findIndex(cr => cr.id === caseId);
    if (caseIndex === -1) {
      return c.json({ error: "Case record not found" }, 404);
    }
    
    const caseRecord = data.caseRecords[caseIndex];
    const newNote: Note = {
      id: (data.nextNoteId++).toString(),
      category: 'General',
      content: body.content || '',
      createdAt: body.createdAt || now,
      updatedAt: now
    };
    
    caseRecord.notes.push(newNote);
    caseRecord.updatedDate = now;
    
    await saveData(data);
    
    const person = data.people.find(p => p.id === caseRecord.personId);
    if (!person) {
      return c.json({ error: "Person not found" }, 404);
    }
    
    const caseDisplay = createCaseDisplay(caseRecord, person);
    return c.json(caseDisplay);
  } catch (error) {
    console.error("Error adding note:", error);
    return c.json({ error: "Failed to add note" }, 500);
  }
});

// Update note
app.put("/make-server-e57ced6e/cases/:caseId/notes/:noteId", async (c) => {
  try {
    const caseId = c.req.param("caseId");
    const noteId = c.req.param("noteId");
    const body = await c.req.json();
    const data = await getOrInitializeData();
    const now = new Date().toISOString();
    
    const caseIndex = data.caseRecords.findIndex(cr => cr.id === caseId);
    if (caseIndex === -1) {
      return c.json({ error: "Case record not found" }, 404);
    }
    
    const caseRecord = data.caseRecords[caseIndex];
    const noteIndex = caseRecord.notes.findIndex(note => note.id === noteId);
    
    if (noteIndex === -1) {
      return c.json({ error: "Note not found" }, 404);
    }
    
    caseRecord.notes[noteIndex] = {
      ...caseRecord.notes[noteIndex],
      content: body.content || caseRecord.notes[noteIndex].content,
      updatedAt: now
    };
    
    caseRecord.updatedDate = now;
    
    await saveData(data);
    
    const person = data.people.find(p => p.id === caseRecord.personId);
    if (!person) {
      return c.json({ error: "Person not found" }, 404);
    }
    
    const caseDisplay = createCaseDisplay(caseRecord, person);
    return c.json(caseDisplay);
  } catch (error) {
    console.error("Error updating note:", error);
    return c.json({ error: "Failed to update note" }, 500);
  }
});

// Delete note
app.delete("/make-server-e57ced6e/cases/:caseId/notes/:noteId", async (c) => {
  try {
    const caseId = c.req.param("caseId");
    const noteId = c.req.param("noteId");
    const data = await getOrInitializeData();
    const now = new Date().toISOString();
    
    const caseIndex = data.caseRecords.findIndex(cr => cr.id === caseId);
    if (caseIndex === -1) {
      return c.json({ error: "Case record not found" }, 404);
    }
    
    const caseRecord = data.caseRecords[caseIndex];
    const noteIndex = caseRecord.notes.findIndex(note => note.id === noteId);
    
    if (noteIndex === -1) {
      return c.json({ error: "Note not found" }, 404);
    }
    
    caseRecord.notes.splice(noteIndex, 1);
    caseRecord.updatedDate = now;
    
    await saveData(data);
    
    const person = data.people.find(p => p.id === caseRecord.personId);
    if (!person) {
      return c.json({ error: "Person not found" }, 404);
    }
    
    const caseDisplay = createCaseDisplay(caseRecord, person);
    return c.json(caseDisplay);
  } catch (error) {
    console.error("Error deleting note:", error);
    return c.json({ error: "Failed to delete note" }, 500);
  }
});

// Delete case
app.delete("/make-server-e57ced6e/cases/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await getOrInitializeData();
    
    const caseIndex = data.caseRecords.findIndex(cr => cr.id === id);
    if (caseIndex === -1) {
      return c.json({ error: "Case record not found" }, 404);
    }
    
    const caseRecord = data.caseRecords[caseIndex];
    
    // Remove the case record
    data.caseRecords.splice(caseIndex, 1);
    
    // Remove the associated person if they exist
    const personIndex = data.people.findIndex(p => p.id === caseRecord.personId);
    if (personIndex !== -1) {
      data.people.splice(personIndex, 1);
    }
    
    await saveData(data);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting case:", error);
    return c.json({ error: "Failed to delete case" }, 500);
  }
});

// Start the server
Deno.serve(app.fetch);