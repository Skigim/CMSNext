import React from 'react';
import ReactDOM from 'react-dom/client';
import '/styles/globals.css';
import { FileStorageProvider } from '/home/runner/work/CMSNext/CMSNext/contexts/FileStorageContext.tsx';
import { DataManagerProvider } from '/home/runner/work/CMSNext/CMSNext/contexts/DataManagerContext.tsx';
import { TemplateProvider } from '/home/runner/work/CMSNext/CMSNext/contexts/TemplateContext.tsx';
import { CaseDetails } from '/home/runner/work/CMSNext/CMSNext/components/case/CaseDetails.tsx';
import type { StoredCase } from '/home/runner/work/CMSNext/CMSNext/types/case.ts';

const applicant = {
  id: 'person-1',
  firstName: 'Jamie',
  lastName: 'Applicant',
  name: 'Jamie Applicant',
  phone: '5551234567',
  email: 'jamie@example.com',
  address: {
    street: '123 Main St',
    city: 'Omaha',
    state: 'NE',
    zip: '68102',
  },
  mailingAddress: {
    street: '123 Main St',
    city: 'Omaha',
    state: 'NE',
    zip: '68102',
    sameAsPhysical: true,
  },
  dateOfBirth: '1990-01-01',
  ssn: '***-**-1234',
  organizationId: null,
  livingArrangement: 'Home',
  authorizedRepIds: [],
  familyMembers: [],
  familyMemberIds: [],
  legacyFamilyMemberNames: [],
  normalizedRelationships: [
    {
      id: 'rel-1',
      type: 'Spouse',
      targetPersonId: 'person-2',
    },
  ],
  createdAt: '2026-03-27T00:00:00.000Z',
  updatedAt: '2026-03-27T00:00:00.000Z',
  dateAdded: '2026-03-27T00:00:00.000Z',
};

const householdMember = {
  id: 'person-2',
  firstName: 'Morgan',
  lastName: 'Member',
  name: 'Morgan Member',
  phone: '5550002222',
  email: 'morgan@example.com',
  address: {
    street: '9 Oak St',
    city: 'Omaha',
    state: 'NE',
    zip: '68102',
  },
  mailingAddress: {
    street: '9 Oak St',
    city: 'Omaha',
    state: 'NE',
    zip: '68102',
    sameAsPhysical: true,
  },
  dateOfBirth: '1984-02-03',
  ssn: '***-**-6789',
  organizationId: null,
  livingArrangement: 'Community',
  authorizedRepIds: [],
  familyMembers: [],
  familyMemberIds: [],
  legacyFamilyMemberNames: [],
  normalizedRelationships: [],
  createdAt: '2026-03-27T00:00:00.000Z',
  updatedAt: '2026-03-27T00:00:00.000Z',
  dateAdded: '2026-03-27T00:00:00.000Z',
};

const caseData = {
  id: 'case-preview-1',
  name: 'Jamie Applicant',
  mcn: 'MCN123456',
  status: 'Pending',
  priority: false,
  createdAt: '2026-03-27T00:00:00.000Z',
  updatedAt: '2026-03-27T00:00:00.000Z',
  person: applicant,
  people: [
    { personId: 'person-1', role: 'applicant', isPrimary: true },
    { personId: 'person-2', role: 'household_member', isPrimary: false },
  ],
  linkedPeople: [
    {
      ref: { personId: 'person-1', role: 'applicant', isPrimary: true },
      person: applicant,
    },
    {
      ref: { personId: 'person-2', role: 'household_member', isPrimary: false },
      person: householdMember,
    },
  ],
  caseRecord: {
    id: 'case-record-1',
    mcn: 'MCN123456',
    applicationDate: '2026-03-01',
    caseType: 'Medical Assistance',
    personId: 'person-1',
    spouseId: '',
    status: 'Pending',
    description: 'Preview case',
    priority: false,
    livingArrangement: 'Home',
    withWaiver: false,
    admissionDate: '2026-03-01',
    organizationId: 'org-1',
    authorizedReps: [],
    retroRequested: '',
    createdDate: '2026-03-01T00:00:00.000Z',
    updatedDate: '2026-03-01T00:00:00.000Z',
    intakeCompleted: true,
  },
} as StoredCase;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing root element');
}

document.body.className = 'bg-background text-foreground p-6';

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <FileStorageProvider>
      <DataManagerProvider>
        <TemplateProvider>
          <CaseDetails case={caseData} onBack={() => {}} onDelete={() => {}} />
        </TemplateProvider>
      </DataManagerProvider>
    </FileStorageProvider>
  </React.StrictMode>,
);
