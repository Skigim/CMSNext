import { afterEach, describe, expect, it, vi } from 'vitest';
import { Case, type CaseCreateInput } from '@/domain/cases/entities/Case';
import { CASE_STATUS } from '@/types/case';
import { Person } from '@/domain/cases/entities/Person';
import DomainError from '@/domain/common/errors/DomainError';
import ValidationError from '@/domain/common/errors/ValidationError';

const createInput = (overrides: Partial<CaseCreateInput> = {}): CaseCreateInput => ({
  mcn: 'MCN-1001',
  name: 'Sample Case',
  personId: 'person-001',
  metadata: { source: 'unit-test' },
  person: new Person({
    name: 'Sample Person',
    dateOfBirth: '1985-05-20T00:00:00.000Z',
    contactInfo: { email: 'sample@example.com', phone: '5555555555' },
  }),
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Case aggregate', () => {
  it('creates a case with defaults via factory', () => {
    const result = Case.create(createInput());

    expect(result.id).toMatch(/case-|[0-9a-f-]{8,}/i);
  expect(result.status).toBe(CASE_STATUS.Active);
    expect(result.metadata).toEqual({ source: 'unit-test' });
    expect(result.personId).toBe('person-001');
    expect(result.person?.name).toBe('Sample Person');
  });

  it('updates status along valid transitions and refreshes timestamp', () => {
    vi.useFakeTimers();
    const initialTimestamp = new Date('2025-01-01T08:00:00.000Z');
    vi.setSystemTime(initialTimestamp);

    const base = Case.create(createInput());
    const initialUpdatedAt = base.updatedAt;

    const nextTimestamp = new Date('2025-02-01T12:00:00.000Z');
    vi.setSystemTime(nextTimestamp);

  base.updateStatus(CASE_STATUS.Pending);

  expect(base.status).toBe(CASE_STATUS.Pending);
    expect(Date.parse(base.updatedAt)).toBe(nextTimestamp.getTime());
    expect(Date.parse(initialUpdatedAt)).toBeLessThan(Date.parse(base.updatedAt));
  });

  it('prevents invalid status transitions', () => {
    const base = Case.create(createInput());

  expect(() => base.updateStatus(CASE_STATUS.Archived)).toThrow(DomainError);

  base.updateStatus(CASE_STATUS.Closed);
  expect(() => base.updateStatus(CASE_STATUS.Active)).toThrow(DomainError);
  });

  it('only allows archiving closed cases', () => {
    const base = Case.create(createInput());

    expect(() => base.archive()).toThrow(DomainError);

  base.updateStatus(CASE_STATUS.Closed);
    base.archive();

  expect(base.status).toBe(CASE_STATUS.Archived);
  });

  it('validates structural invariants', () => {
    expect(() => Case.create(createInput({ mcn: 'invalid' })) ).toThrow(ValidationError);
    expect(() => Case.create(createInput({ name: '   ' })) ).toThrow(ValidationError);
    expect(() => Case.create(createInput({ personId: '' })) ).toThrow(ValidationError);
  });
});
