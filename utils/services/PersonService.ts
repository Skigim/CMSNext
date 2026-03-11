import { v4 as uuidv4 } from "uuid";

import type { NewPersonData, Person } from "@/types/case";
import type { FileStorageService, NormalizedFileData } from "./FileStorageService";
import { readDataAndFindCase } from "@/utils/serviceHelpers";

interface PersonServiceConfig {
  fileStorage: FileStorageService;
}

function buildDisplayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export class PersonService {
  private readonly fileStorage: FileStorageService;

  constructor(config: PersonServiceConfig) {
    this.fileStorage = config.fileStorage;
  }

  async getAllPeople(): Promise<Person[]> {
    const data = await this.fileStorage.readFileData();
    return data?.people ?? [];
  }

  async getPersonById(personId: string): Promise<Person | null> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      return null;
    }

    return data.people.find((person) => person.id === personId) ?? null;
  }

  async getPrimaryPersonForCase(caseId: string): Promise<Person | null> {
    const { targetCase } = await readDataAndFindCase(this.fileStorage, caseId);
    return targetCase.person;
  }

  buildNewPerson(personData: NewPersonData, options?: { personId?: string; timestamp?: string }): Person {
    const timestamp = options?.timestamp ?? new Date().toISOString();

    return {
      id: options?.personId ?? uuidv4(),
      firstName: personData.firstName,
      lastName: personData.lastName,
      name: buildDisplayName(personData.firstName, personData.lastName),
      dateOfBirth: personData.dateOfBirth || "",
      ssn: personData.ssn || "",
      phone: personData.phone || "",
      email: personData.email || "",
      organizationId: personData.organizationId || null,
      livingArrangement: personData.livingArrangement || "",
      address: personData.address || {
        street: "",
        city: "",
        state: "",
        zip: "",
      },
      mailingAddress: personData.mailingAddress || {
        street: "",
        city: "",
        state: "",
        zip: "",
        sameAsPhysical: true,
      },
      authorizedRepIds: personData.authorizedRepIds || [],
      familyMembers: personData.familyMembers || [],
      familyMemberIds: personData.familyMembers || [],
      legacyFamilyMemberNames: [],
      relationships: personData.relationships || [],
      normalizedRelationships: [],
      status: personData.status || "Active",
      createdAt: timestamp,
      updatedAt: timestamp,
      dateAdded: timestamp,
    };
  }

  mergePerson(existingPerson: Person, personData: NewPersonData, timestamp = new Date().toISOString()): Person {
    return {
      ...existingPerson,
      firstName: personData.firstName,
      lastName: personData.lastName,
      name: buildDisplayName(personData.firstName, personData.lastName),
      dateOfBirth: personData.dateOfBirth || "",
      ssn: personData.ssn || "",
      phone: personData.phone || "",
      email: personData.email || "",
      organizationId: personData.organizationId || null,
      livingArrangement: personData.livingArrangement || "",
      address: personData.address || existingPerson.address,
      mailingAddress: personData.mailingAddress || existingPerson.mailingAddress,
      authorizedRepIds: personData.authorizedRepIds || [],
      familyMembers: personData.familyMembers || [],
      familyMemberIds: personData.familyMembers || existingPerson.familyMemberIds || [],
      legacyFamilyMemberNames: existingPerson.legacyFamilyMemberNames ?? [],
      relationships: personData.relationships || [],
      normalizedRelationships: existingPerson.normalizedRelationships ?? [],
      status: personData.status || "Active",
      updatedAt: timestamp,
    };
  }

  upsertPerson(data: NormalizedFileData, person: Person): NormalizedFileData {
    const people = data.people.some((existingPerson) => existingPerson.id === person.id)
      ? data.people.map((existingPerson) => (existingPerson.id === person.id ? person : existingPerson))
      : [...data.people, person];

    return {
      ...data,
      people,
    };
  }
}
