import { Case } from '@/domain/cases/entities/Case';
import type { CaseMetadata } from '@/domain/cases/entities/Case';
import type { PersonSnapshot, PersonProps } from '@/domain/cases/entities/Person';
import type {
  CaseDisplay,
  CaseRecord,
  Financials,
  NewCaseRecordData,
  NewPersonData,
  AlertRecord,
  Note,
  Person as LegacyPerson,
} from '@/types/case';

type MetadataRecord = Record<string, unknown> | undefined | null;

type LegacyEnvelope = {
  version: number;
  caseDisplay: CaseDisplay;
};

const DEFAULT_ADDRESS = { street: '', city: '', state: '', zip: '' } as const;
const DEFAULT_MAILING_ADDRESS = { ...DEFAULT_ADDRESS, sameAsPhysical: true } as const;
const DEFAULT_FINANCIALS: Financials = { resources: [], income: [], expenses: [] };
const DEFAULT_NOTES: Note[] = [];
const DEFAULT_ALERTS: AlertRecord[] = [];

export const LEGACY_METADATA_KEY = 'legacyCase';
export const LEGACY_METADATA_VERSION = 1;

const CASE_ID_PREFIX = 'case';
const PERSON_ID_PREFIX = 'person';
const CASE_RECORD_SUFFIX = 'record';

export interface CaseFormInput {
  person: NewPersonData;
  caseRecord: NewCaseRecordData;
  existing?: CaseDisplay | null;
  now?: Date;
  caseId?: string;
  personId?: string;
}

export function createCaseDisplayFromForm(input: CaseFormInput): CaseDisplay {
  const {
    person,
    caseRecord,
    existing = null,
    now = new Date(),
    caseId,
    personId,
  } = input;

  const timestamp = now.toISOString();
  const normalizedMcn = caseRecord.mcn.trim();

  if (existing) {
    const mergedPerson = mergePerson(existing.person, person, timestamp);
    const mergedCaseRecord = mergeCaseRecord(existing.caseRecord, caseRecord, mergedPerson.id, timestamp);

    return {
      ...existing,
      name: buildCaseName(mergedPerson.firstName, mergedPerson.lastName) || existing.name,
      mcn: normalizedMcn || existing.mcn,
      status: caseRecord.status,
      priority: Boolean(caseRecord.priority ?? existing.priority ?? false),
      createdAt: existing.createdAt || timestamp,
      updatedAt: timestamp,
      person: mergedPerson,
      caseRecord: mergedCaseRecord,
      alerts: clone(existing.alerts ?? DEFAULT_ALERTS),
    };
  }

  const generatedPersonId = personId ?? generateId(PERSON_ID_PREFIX);
  const generatedCaseId = caseId ?? generateId(CASE_ID_PREFIX);

  const legacyPerson = buildLegacyPerson(person, generatedPersonId, timestamp);
  const legacyCaseRecord = buildNewCaseRecord(caseRecord, generatedCaseId, legacyPerson.id, timestamp);

  return {
    id: generatedCaseId,
    name: buildCaseName(legacyPerson.firstName, legacyPerson.lastName) || person.firstName || 'Case',
    mcn: normalizedMcn,
    status: caseRecord.status,
    priority: Boolean(caseRecord.priority),
    createdAt: timestamp,
    updatedAt: timestamp,
    person: legacyPerson,
    caseRecord: legacyCaseRecord,
    alerts: clone(DEFAULT_ALERTS),
  };
}

export function createLegacyMetadata(caseDisplay: CaseDisplay, previous: MetadataRecord = undefined): CaseMetadata {
  const metadata: CaseMetadata = previous ? clone(previous) : {};
  metadata[LEGACY_METADATA_KEY] = {
    version: LEGACY_METADATA_VERSION,
    caseDisplay: clone(caseDisplay),
  } satisfies LegacyEnvelope;
  return metadata;
}

export function extractLegacyCaseDisplay(metadata: MetadataRecord): CaseDisplay | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const envelope = metadata[LEGACY_METADATA_KEY];
  if (!envelope || typeof envelope !== 'object') {
    return null;
  }

  const { caseDisplay } = envelope as LegacyEnvelope;
  if (!caseDisplay) {
    return null;
  }

  return clone(caseDisplay);
}

export function caseToLegacyCaseDisplay(entity: Case): CaseDisplay {
  const fromMetadata = extractLegacyCaseDisplay(entity.metadata);
  const baseDisplay = fromMetadata ?? buildFallbackDisplay(entity);
  return normaliseCaseDisplay(baseDisplay, entity);
}

function mergePerson(existing: CaseDisplay['person'], updates: NewPersonData, timestamp: string): CaseDisplay['person'] {
  return {
    ...existing,
    firstName: updates.firstName.trim(),
    lastName: updates.lastName.trim(),
    name: buildCaseName(updates.firstName, updates.lastName) || existing.name,
    email: updates.email.trim(),
    phone: updates.phone.trim(),
    dateOfBirth: updates.dateOfBirth,
    ssn: updates.ssn,
    organizationId: updates.organizationId ?? null,
    livingArrangement: updates.livingArrangement,
    address: clone(updates.address) ?? clone(existing.address),
    mailingAddress: clone(updates.mailingAddress) ?? clone(existing.mailingAddress),
    authorizedRepIds: clone(updates.authorizedRepIds ?? existing.authorizedRepIds ?? []),
    familyMembers: clone(updates.familyMembers ?? existing.familyMembers ?? []),
    status: updates.status ?? existing.status,
    createdAt: existing.createdAt ?? existing.dateAdded ?? timestamp,
    dateAdded: existing.dateAdded ?? existing.createdAt ?? timestamp,
  };
}

function mergeCaseRecord(existing: CaseRecord, updates: NewCaseRecordData, personId: string, timestamp: string): CaseRecord {
  return {
    ...existing,
    mcn: updates.mcn.trim() || existing.mcn,
    applicationDate: updates.applicationDate,
    caseType: updates.caseType,
    personId: updates.personId?.trim() || personId,
    spouseId: updates.spouseId ?? existing.spouseId ?? '',
    status: updates.status,
    description: updates.description ?? existing.description ?? '',
    priority: Boolean(updates.priority ?? existing.priority ?? false),
    livingArrangement: updates.livingArrangement ?? existing.livingArrangement ?? 'Unknown',
    withWaiver: Boolean(updates.withWaiver ?? existing.withWaiver ?? false),
    admissionDate: updates.admissionDate ?? existing.admissionDate ?? '',
    organizationId: updates.organizationId ?? existing.organizationId ?? '',
    authorizedReps: clone(updates.authorizedReps ?? existing.authorizedReps ?? []),
    retroRequested: updates.retroRequested ?? existing.retroRequested ?? '',
    financials: clone(existing.financials ?? DEFAULT_FINANCIALS),
    notes: clone(existing.notes ?? DEFAULT_NOTES),
    createdDate: existing.createdDate ?? existing.updatedDate ?? timestamp,
    updatedDate: timestamp,
  };
}

function buildLegacyPerson(data: NewPersonData, personId: string, timestamp: string): LegacyPerson {
  return {
    id: personId,
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    name: buildCaseName(data.firstName, data.lastName) || personId,
    email: data.email.trim(),
    phone: data.phone.trim(),
    dateOfBirth: data.dateOfBirth,
    ssn: data.ssn,
    organizationId: data.organizationId ?? null,
    livingArrangement: data.livingArrangement,
    address: clone(data.address) || { ...DEFAULT_ADDRESS },
    mailingAddress: clone(data.mailingAddress) || { ...DEFAULT_MAILING_ADDRESS },
    authorizedRepIds: clone(data.authorizedRepIds ?? []),
    familyMembers: clone(data.familyMembers ?? []),
    status: data.status,
    createdAt: timestamp,
    dateAdded: timestamp,
  };
}

function buildNewCaseRecord(
  data: NewCaseRecordData,
  caseId: string,
  personId: string,
  timestamp: string,
): CaseRecord {
  const recordId = `${caseId}-${CASE_RECORD_SUFFIX}`;
  return {
    id: recordId,
    mcn: data.mcn.trim(),
    applicationDate: data.applicationDate,
    caseType: data.caseType,
    personId,
    spouseId: data.spouseId ?? '',
    status: data.status,
    description: data.description,
    priority: Boolean(data.priority),
    livingArrangement: data.livingArrangement,
    withWaiver: Boolean(data.withWaiver),
    admissionDate: data.admissionDate,
    organizationId: data.organizationId,
    authorizedReps: clone(data.authorizedReps ?? []),
    retroRequested: data.retroRequested ?? '',
    financials: clone(DEFAULT_FINANCIALS),
    notes: clone(DEFAULT_NOTES),
    createdDate: timestamp,
    updatedDate: timestamp,
  };
}

function buildFallbackDisplay(entity: Case): CaseDisplay {
  const personSnapshot = entity.person?.toJSON();
  const legacyPerson = fallbackPerson(personSnapshot, entity.personId, entity.createdAt);
  const legacyRecord = fallbackCaseRecord(entity, legacyPerson.id);

  return {
    id: entity.id,
    name: entity.name,
    mcn: entity.mcn,
    status: entity.status,
    priority: false,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    person: legacyPerson,
    caseRecord: legacyRecord,
    alerts: clone(DEFAULT_ALERTS),
  };
}

function fallbackPerson(snapshot: PersonSnapshot | undefined, fallbackId: string, createdAt: string): LegacyPerson {
  const firstName = snapshot?.firstName ?? '';
  const lastName = snapshot?.lastName ?? '';
  const derivedName = snapshot?.fullName || buildCaseName(firstName, lastName) || fallbackId;

  const contact = snapshot?.contactInfo ?? {};

  return {
    id: snapshot?.id ?? fallbackId,
    firstName,
    lastName,
    name: derivedName,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    dateOfBirth: snapshot?.dateOfBirth ?? '',
    ssn: '',
    organizationId: null,
    livingArrangement: 'Unknown',
    address: { ...DEFAULT_ADDRESS },
    mailingAddress: { ...DEFAULT_MAILING_ADDRESS },
    authorizedRepIds: [],
    familyMembers: [],
    status: 'Active',
    createdAt,
    dateAdded: createdAt,
  };
}

function fallbackCaseRecord(entity: Case, personId: string): CaseRecord {
  return {
    id: `${entity.id}-${CASE_RECORD_SUFFIX}`,
    mcn: entity.mcn,
    applicationDate: toDateOnly(entity.createdAt),
    caseType: 'General',
    personId,
    spouseId: '',
    status: entity.status,
    description: '',
    priority: false,
    livingArrangement: 'Unknown',
    withWaiver: false,
    admissionDate: '',
    organizationId: '',
    authorizedReps: [],
    retroRequested: '',
    financials: clone(DEFAULT_FINANCIALS),
    notes: clone(DEFAULT_NOTES),
    createdDate: entity.createdAt,
    updatedDate: entity.updatedAt,
  };
}

function normaliseCaseDisplay(base: CaseDisplay, entity: Case): CaseDisplay {
  const display = clone(base);
  display.id = entity.id;
  display.mcn = entity.mcn;
  display.name = entity.name;
  display.status = entity.status;
  display.createdAt = entity.createdAt;
  display.updatedAt = entity.updatedAt;
  display.person = {
    ...display.person,
    id: display.person.id || entity.personId,
    name: buildCaseName(display.person.firstName, display.person.lastName) || display.person.name,
  };
  display.caseRecord = {
    ...display.caseRecord,
    id: display.caseRecord.id || `${entity.id}-${CASE_RECORD_SUFFIX}`,
    mcn: entity.mcn,
    status: entity.status,
    personId: display.person.id,
    createdDate: display.caseRecord.createdDate || entity.createdAt,
    updatedDate: entity.updatedAt,
  };
  return display;
}

function toDateOnly(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let idCounter = 0;

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  idCounter += 1;
  const randomSegment = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${randomSegment}`;
}

function buildCaseName(firstName: string, lastName: string): string {
  return [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ').trim();
}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

export function personFromLegacyMetadata(metadata: MetadataRecord, fallbackId: string, createdAt: string): LegacyPerson {
  const legacy = extractLegacyCaseDisplay(metadata);
  if (legacy) {
    return clone(legacy.person);
  }
  return fallbackPerson(undefined, fallbackId, createdAt);
}

export function deriveCaseRecordFromMetadata(metadata: MetadataRecord, entity: Case, personId: string): CaseRecord {
  const legacy = extractLegacyCaseDisplay(metadata);
  if (legacy) {
    return clone({
      ...legacy.caseRecord,
      mcn: entity.mcn,
      status: entity.status,
      personId,
      updatedDate: entity.updatedAt,
    });
  }
  return fallbackCaseRecord(entity, personId);
}

export function personSnapshotFromLegacy(person: LegacyPerson): PersonSnapshot {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    fullName: person.name,
    dateOfBirth: person.dateOfBirth,
    contactInfo: {
      email: person.email,
      phone: person.phone,
    },
    metadata: {
      organizationId: person.organizationId,
      livingArrangement: person.livingArrangement,
      authorizedRepIds: clone(person.authorizedRepIds),
      familyMembers: clone(person.familyMembers),
      status: person.status,
      address: clone(person.address),
      mailingAddress: clone(person.mailingAddress),
    },
  };
}

export function legacyCaseDisplayToCase(display: CaseDisplay, previous?: Case | null): Case {
  const metadata = createLegacyMetadata(display, previous?.metadata);

  return Case.rehydrate({
    id: display.id,
    mcn: display.mcn,
    name: display.name,
    status: display.status,
    personId: display.person.id,
    createdAt: display.createdAt,
    updatedAt: display.updatedAt,
    metadata,
    person: personSnapshotFromLegacy(display.person),
  });
}

export function personPropsFromNewPerson(data: NewPersonData): PersonProps {
  return {
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    dateOfBirth: data.dateOfBirth,
    contactInfo: {
      email: data.email.trim(),
      phone: data.phone.trim(),
    },
    metadata: {
      organizationId: data.organizationId ?? null,
      livingArrangement: data.livingArrangement,
      authorizedRepIds: clone(data.authorizedRepIds ?? []),
      familyMembers: clone(data.familyMembers ?? []),
      status: data.status,
      address: clone(data.address),
      mailingAddress: clone(data.mailingAddress),
    },
  };
}
