/**
 * Sample Import Data Structure for Case Tracking Platform
 * 
 * This file shows the correct format for importing case data into the system.
 * The structure should match the CaseDisplay interface from types/case.ts
 * 
 * Key corrections from common export formats:
 * - address.zipCode → address.zip
 * - caseRecord.dateOpened → caseRecord.applicationDate
 * - caseRecord.lastUpdated → caseRecord.updatedDate
 * - caseRecord.priority should be boolean, not string
 * - caseRecord.status must be: "In Progress" | "Priority" | "Review" | "Completed"
 * - Many required fields must be present with proper defaults
 */

export const sampleImportData = [
  {
    // Top-level case display properties
    "id": "case-001", // Optional - will be auto-generated if missing
    "name": "Green Carter", // Optional - auto-computed from person.firstName + lastName
    "mcn": "18983124",
    "status": "Review", // Must be: "In Progress" | "Priority" | "Review" | "Completed"
    "priority": false, // Boolean, not string
    "createdAt": "2025-06-22T23:42:42.310Z",
    "updatedAt": "2025-09-09T14:09:21.440Z",
    
    // Person object - all required fields included
    "person": {
      "id": "person-001", // Required
      "firstName": "Green",
      "lastName": "Carter",
      "name": "Green Carter", // Required - computed from firstName + lastName
      "email": "green.carter31@yahoo.com",
      "phone": "650-215-9668 x985",
      "dateOfBirth": "1947-05-09",
      "ssn": "701-30-9055",
      "organizationId": null, // Required - can be null
      "livingArrangement": "Independent", // Required
      
      // Address object - note 'zip' not 'zipCode'
      "address": {
        "street": "386 Maximillian Plaza",
        "city": "New Marilie",
        "state": "MN",
        "zip": "90143" // ✅ Correct field name (not 'zipCode')
      },
      
      // Mailing address object - required
      "mailingAddress": {
        "street": "386 Maximillian Plaza",
        "city": "New Marilie", 
        "state": "MN",
        "zip": "90143",
        "sameAsPhysical": true // Required boolean
      },
      
      "authorizedRepIds": [], // Required array
      "familyMembers": [], // Required array
      "status": "Active", // Required
      "createdAt": "2025-06-22T23:42:42.310Z", // Required
      "dateAdded": "2025-06-22T23:42:42.310Z" // Required
    },
    
    // Case record object - all required fields included
    "caseRecord": {
      "id": "case-record-001", // Required
      "personId": "person-001", // Required - links to person.id
      "mcn": "18983124", // Required
      "applicationDate": "2025-06-22T23:42:42.310Z", // ✅ Correct field name (not 'dateOpened')
      "caseType": "General", // Required
      "spouseId": "", // Required - can be empty string
      "status": "Review", // Required - must match valid enum values
      "description": "", // Required - can be empty string
      "priority": false, // Required boolean (not string)
      "livingArrangement": "Independent", // Required
      "withWaiver": false, // Required boolean
      "admissionDate": "2025-06-22T23:42:42.310Z", // Required
      "organizationId": "", // Required - can be empty string
      "authorizedReps": [], // Required array
      "retroRequested": "", // Required - can be empty string
      
      // Financials object - required with all categories
      "financials": {
        "resources": [], // Array of FinancialItem objects
        "income": [], // Array of FinancialItem objects  
        "expenses": [] // Array of FinancialItem objects
      },
      
      // Notes array - required
      "notes": [
        {
          "id": "note-001", // Required
          "category": "General", // Required
          "content": "Initial case notes here.", // Required
          "createdAt": "2025-09-09T14:09:21.440Z", // Required
          "updatedAt": "2025-09-09T14:09:21.440Z" // Required
        }
      ],
      
      "createdDate": "2025-06-22T23:42:42.310Z", // ✅ Correct field name
      "updatedDate": "2025-09-09T14:09:21.440Z" // ✅ Correct field name (not 'lastUpdated')
    }
  },
  
  // Second example case with financial items
  {
    "id": "case-002",
    "name": "Thelma Jacobs",
    "mcn": "99602930", 
    "status": "Completed",
    "priority": false,
    "createdAt": "2024-10-22T09:50:56.149Z",
    "updatedAt": "2025-09-09T14:09:21.440Z",
    
    "person": {
      "id": "person-002",
      "firstName": "Thelma",
      "lastName": "Jacobs",
      "name": "Thelma Jacobs",
      "email": "thelma.jacobs24@yahoo.com",
      "phone": "1-288-461-2437 x096",
      "dateOfBirth": "1942-11-05",
      "ssn": "138-79-8291",
      "organizationId": null,
      "livingArrangement": "Assisted Living",
      "address": {
        "street": "15364 Low Road",
        "city": "Port Alverta",
        "state": "FL",
        "zip": "08400"
      },
      "mailingAddress": {
        "street": "15364 Low Road",
        "city": "Port Alverta",
        "state": "FL", 
        "zip": "08400",
        "sameAsPhysical": true
      },
      "authorizedRepIds": [],
      "familyMembers": [],
      "status": "Active",
      "createdAt": "2024-10-22T09:50:56.149Z",
      "dateAdded": "2024-10-22T09:50:56.149Z"
    },
    
    "caseRecord": {
      "id": "case-record-002",
      "personId": "person-002",
      "mcn": "99602930",
      "applicationDate": "2024-10-22T09:50:56.149Z",
      "caseType": "Medicaid",
      "spouseId": "",
      "status": "Completed",
      "description": "Medicaid application completed successfully",
      "priority": false,
      "livingArrangement": "Assisted Living",
      "withWaiver": true,
      "admissionDate": "2024-10-22T09:50:56.149Z",
      "organizationId": "",
      "authorizedReps": [],
      "retroRequested": "",
      
      "financials": {
        "resources": [
          {
            "id": "resource-001",
            "description": "Checking Account - First National Bank",
            "location": "First National Bank",
            "accountNumber": "****1234",
            "amount": 2500.00,
            "frequency": "Monthly",
            "owner": "Thelma Jacobs",
            "verificationStatus": "Verified",
            "verificationSource": "Bank Statement",
            "notes": "Primary checking account",
            "dateAdded": "2024-10-22T09:50:56.149Z",
            "createdAt": "2024-10-22T09:50:56.149Z",
            "updatedAt": "2024-10-22T09:50:56.149Z"
          }
        ],
        "income": [
          {
            "id": "income-001", 
            "description": "Social Security Benefits",
            "location": "Social Security Administration",
            "accountNumber": "",
            "amount": 1200.00,
            "frequency": "Monthly",
            "owner": "Thelma Jacobs",
            "verificationStatus": "Verified",
            "verificationSource": "SSA Award Letter",
            "notes": "Regular monthly benefits",
            "dateAdded": "2024-10-22T09:50:56.149Z",
            "createdAt": "2024-10-22T09:50:56.149Z", 
            "updatedAt": "2024-10-22T09:50:56.149Z"
          }
        ],
        "expenses": [
          {
            "id": "expense-001",
            "description": "Assisted Living Facility Fees",
            "location": "Sunrise Senior Living",
            "accountNumber": "",
            "amount": 3200.00,
            "frequency": "Monthly", 
            "owner": "Thelma Jacobs",
            "verificationStatus": "Verified",
            "verificationSource": "Facility Contract",
            "notes": "Room and board costs",
            "dateAdded": "2024-10-22T09:50:56.149Z",
            "createdAt": "2024-10-22T09:50:56.149Z",
            "updatedAt": "2024-10-22T09:50:56.149Z"
          }
        ]
      },
      
      "notes": [
        {
          "id": "note-002",
          "category": "Application",
          "content": "Application submitted and approved after 45-day review period.",
          "createdAt": "2024-11-15T10:30:00.000Z",
          "updatedAt": "2024-11-15T10:30:00.000Z"
        },
        {
          "id": "note-003", 
          "category": "Follow-up",
          "content": "Annual recertification due in October 2025.",
          "createdAt": "2025-01-10T14:15:00.000Z",
          "updatedAt": "2025-01-10T14:15:00.000Z"
        }
      ],
      
      "createdDate": "2024-10-22T09:50:56.149Z",
      "updatedDate": "2025-09-09T14:09:21.440Z"
    }
  }
];

/**
 * Valid status values for caseRecord.status:
 * - "In Progress" (default for active cases)
 * - "Priority" (high priority cases needing immediate attention)  
 * - "Review" (cases under review)
 * - "Completed" (closed/finished cases)
 * 
 * Common status mappings from other systems:
 * - "Active" / "Open" → "In Progress"
 * - "Pending" → "Review" 
 * - "Urgent" / "High Priority" → "Priority"
 * - "Closed" / "Done" / "Finished" → "Completed"
 * - "Denied" → "Completed" (with notes explaining denial)
 */

/**
 * Financial Item verification status values:
 * - "Needs VR" (needs verification)
 * - "VR Pending" (verification pending)
 * - "AVS Pending" (asset verification system pending)
 * - "Verified" (fully verified)
 */

export default sampleImportData;