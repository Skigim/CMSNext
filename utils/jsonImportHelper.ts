// Helper utilities and documentation for JSON import functionality

export const getSampleJsonStructure = () => {
  return {
    single_case_example: {
      // Person information (can be nested or at root level)
      person: {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "555-0123",
        dateOfBirth: "1990-01-15",
        ssn: "123-45-6789",
        address: {
          street: "123 Main St",
          city: "Anytown",
          state: "CA",
          zipCode: "12345",
          county: "Sample County"
        },
        householdSize: 3,
        maritalStatus: "Married",
        employmentStatus: "Employed"
      },
      // Case record information
      caseRecord: {
        mcn: "MCN123456",
        status: "In Progress",
        priority: "Normal",
        assignedTo: "Case Worker Name",
        dateOpened: "2024-01-15",
        lastUpdated: "2024-01-20",
        financials: {
          resources: [
            {
              description: "Savings Account",
              amount: 5000,
              location: "First National Bank",
              accountNumber: "****1234",
              verificationStatus: "Verified",
              verificationSource: "Bank Statement",
              notes: "Primary savings account"
            }
          ],
          income: [
            {
              description: "Employment Income",
              amount: 3500,
              frequency: "monthly",
              location: "ABC Company",
              verificationStatus: "Verified",
              verificationSource: "Pay Stub",
              notes: "Full-time employment"
            }
          ],
          expenses: [
            {
              description: "Rent",
              amount: 1200,
              frequency: "monthly",
              location: "Landlord Name",
              verificationStatus: "Verified",
              notes: "Monthly rent payment"
            }
          ]
        },
        notes: [
          {
            content: "Initial intake completed",
            createdAt: "2024-01-15T10:00:00Z",
            createdBy: "Case Worker"
          }
        ]
      }
    },
    multiple_cases_example: [
      {
        // Flat structure also supported
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@example.com",
        phone: "555-0456",
        mcn: "MCN789012",
        status: "Priority",
        resources: [
          {
            description: "Checking Account",
            amount: 1500,
            location: "Community Bank"
          }
        ],
        income: [
          {
            description: "Part-time Job",
            amount: 1200,
            frequency: "monthly"
          }
        ],
        expenses: []
      },
      {
        firstName: "Bob",
        lastName: "Johnson",
        email: "bob.johnson@example.com",
        mcn: "MCN345678",
        status: "Review",
        resources: [],
        income: [],
        expenses: []
      }
    ]
  };
};

export const getImportDocumentation = () => {
  return {
    title: "JSON Import Documentation",
    description: "Guidelines for importing legacy case data",
    sections: [
      {
        title: "Supported Formats",
        content: [
          "Single case object or array of cases",
          "Nested structure (person.firstName) or flat structure (firstName)",
          "Both 'person' object and root-level person fields supported",
          "Financial data can be nested under 'caseRecord.financials' or at root level"
        ]
      },
      {
        title: "Required Fields",
        content: [
          "firstName and lastName (or person.firstName/person.lastName)",
          "At least one form of contact info (email or phone) recommended"
        ]
      },
      {
        title: "Optional Fields",
        content: [
          "Person: middleName, dateOfBirth, ssn, address, householdSize, maritalStatus, employmentStatus",
          "Case: mcn, status, priority, assignedTo, dateOpened, lastUpdated",
          "Financial items: description, amount, frequency, location, accountNumber, verificationStatus, verificationSource, notes",
          "Notes: content, createdAt, createdBy"
        ]
      },
      {
        title: "Field Mappings",
        content: [
          "description/name/type → description",
          "amount/value → amount",
          "location/institution/bank → location",
          "accountNumber/account → accountNumber",
          "verificationStatus/status → verificationStatus",
          "verificationSource/source → verificationSource",
          "notes/comments → notes",
          "mcn/caseNumber → mcn"
        ]
      }
    ]
  };
};

export const validateImportedCase = (caseData: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Check person data
  const person = caseData.person || caseData;
  if (!person.firstName) errors.push("Missing firstName");
  if (!person.lastName) errors.push("Missing lastName");
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const downloadSampleJson = () => {
  const sample = getSampleJsonStructure();
  const dataStr = JSON.stringify(sample, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sample-import-structure.json';
  link.click();
  
  URL.revokeObjectURL(url);
};