import { describe, it, expect } from 'vitest';
import { Case } from '@/domain/cases/entities/Case';
import { Person } from '@/domain/cases/entities/Person';
import {
  LEGACY_METADATA_KEY,
  createCaseDisplayFromForm,
  createLegacyMetadata,
  extractLegacyCaseDisplay,
  caseToLegacyCaseDisplay,
  personSnapshotFromLegacy,
} from '@/application/services/caseLegacyMapper';
import type { NewCaseRecordData, NewPersonData } from '@/types/case';
import { CASE_STATUS } from '@/types/case';

const basePersonForm = (): NewPersonData => ({
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '555-0100',
  dateOfBirth: '1815-12-10',
  ssn: '111-22-3333',
  organizationId: 'org-1',
  livingArrangement: 'Apartment',
  address: {
    street: '12 Byron St',
    city: 'London',
    state: 'UK',
    zip: 'N1',
  },
  mailingAddress: {
    street: '12 Byron St',
    city: 'London',
    state: 'UK',
    zip: 'N1',
    sameAsPhysical: true,
  },
  authorizedRepIds: ['rep-1'],
  familyMembers: ['fam-1'],
  status: 'Active',
});

const baseCaseRecordForm = (): NewCaseRecordData => ({
  mcn: 'MCN-123',
  applicationDate: '2025-10-01',
  caseType: 'General',
  personId: '',
  spouseId: '',
  status: CASE_STATUS.Pending,
  description: 'Sample description',
  priority: true,
  livingArrangement: 'Apartment',
  withWaiver: false,
  admissionDate: '2025-10-15',
  organizationId: 'org-1',
  authorizedReps: ['rep-1'],
  retroRequested: 'No',
});

describe('caseLegacyMapper', () => {
  it('creates a new case display from form data with deterministic identifiers', () => {
    const personForm = basePersonForm();
    const recordForm = baseCaseRecordForm();
    const now = new Date('2025-10-31T12:00:00Z');

    const display = createCaseDisplayFromForm({
      person: personForm,
      caseRecord: recordForm,
      now,
      caseId: 'case-test',
      personId: 'person-test',
    });

    expect(display.id).toBe('case-test');
    expect(display.person.id).toBe('person-test');
    expect(display.person.name).toBe('Ada Lovelace');
    expect(display.caseRecord.id).toBe('case-test-record');
    expect(display.caseRecord.personId).toBe('person-test');
    expect(display.caseRecord.status).toBe(CASE_STATUS.Pending);
    expect(display.createdAt).toBe(now.toISOString());
    expect(display.updatedAt).toBe(now.toISOString());
    expect(display.caseRecord.financials).toEqual({ resources: [], income: [], expenses: [] });
    expect(display.caseRecord.notes).toEqual([]);
  });

  it('merges form updates onto an existing case display', () => {
    const baseNow = new Date('2025-10-01T00:00:00Z');
    const existing = createCaseDisplayFromForm({
      person: basePersonForm(),
      caseRecord: baseCaseRecordForm(),
      now: baseNow,
      caseId: 'case-existing',
      personId: 'person-existing',
    });

    const updates: NewPersonData = {
      ...basePersonForm(),
      firstName: 'Augusta',
      lastName: 'King',
      email: 'augusta@example.com',
    };

    const recordUpdates: NewCaseRecordData = {
      ...baseCaseRecordForm(),
      mcn: 'MCN-UPDATED',
      status: CASE_STATUS.Active,
      description: 'Updated description',
    };

    const updated = createCaseDisplayFromForm({
      person: updates,
      caseRecord: recordUpdates,
      existing,
      now: new Date('2025-11-01T00:00:00Z'),
    });

    expect(updated.id).toBe(existing.id);
    expect(updated.createdAt).toBe(existing.createdAt);
    expect(updated.updatedAt).not.toBe(existing.updatedAt);
    expect(updated.person.firstName).toBe('Augusta');
    expect(updated.person.email).toBe('augusta@example.com');
    expect(updated.caseRecord.mcn).toBe('MCN-UPDATED');
    expect(updated.caseRecord.description).toBe('Updated description');
    expect(updated.caseRecord.notes).toEqual(existing.caseRecord.notes);
  });

  it('encodes and decodes legacy metadata', () => {
    const display = createCaseDisplayFromForm({
      person: basePersonForm(),
      caseRecord: baseCaseRecordForm(),
      now: new Date('2025-10-05T00:00:00Z'),
      caseId: 'case-meta',
      personId: 'person-meta',
    });

    const metadata = createLegacyMetadata(display, { source: 'unit-test' });

    expect(metadata).toHaveProperty(LEGACY_METADATA_KEY);
    expect(metadata).toMatchObject({ source: 'unit-test' });

    const restored = extractLegacyCaseDisplay(metadata);
    expect(restored).toBeTruthy();
    expect(restored?.id).toBe('case-meta');
    expect(restored?.person.id).toBe('person-meta');
  });

  it('hydrates case display from metadata when converting domain case', () => {
    const display = createCaseDisplayFromForm({
      person: basePersonForm(),
      caseRecord: baseCaseRecordForm(),
      now: new Date('2025-10-07T00:00:00Z'),
      caseId: 'case-domain',
      personId: 'person-domain',
    });

    const domainCase = Case.create({
      id: display.id,
      mcn: display.mcn,
      name: display.name,
      status: display.status,
      personId: display.person.id,
      person: personSnapshotFromLegacy(display.person),
      metadata: createLegacyMetadata(display),
      createdAt: display.createdAt,
      updatedAt: display.updatedAt,
    });

    const legacyDisplay = caseToLegacyCaseDisplay(domainCase);
    expect(legacyDisplay.id).toBe(display.id);
    expect(legacyDisplay.person.name).toBe(display.person.name);
    expect(legacyDisplay.caseRecord.id).toBe(display.caseRecord.id);
  });

  it('builds a fallback display when metadata is absent', () => {
    const person = Person.create({
      firstName: 'Fallback',
      lastName: 'Case',
      dateOfBirth: '1990-01-01',
      contactInfo: { email: 'fallback@example.com' },
    });

    const domainCase = Case.create({
      mcn: 'MCN-FALLBACK',
      name: 'Fallback Case',
      status: CASE_STATUS.Active,
      personId: person.id,
      person,
    });

    const display = caseToLegacyCaseDisplay(domainCase);
    expect(display.id).toBe(domainCase.id);
    expect(display.mcn).toBe('MCN-FALLBACK');
    expect(display.person.id).toBe(person.id);
    expect(display.caseRecord.personId).toBe(person.id);
    expect(display.caseRecord.mcn).toBe('MCN-FALLBACK');
  });
});
