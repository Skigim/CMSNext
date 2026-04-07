import type { Application, ApplicationStatusHistory } from "@/types/application";
import { readDataAndRequireCase, type FileDataReader } from "@/utils/serviceHelpers";

import type { FileStorageService } from "./FileStorageService";

export type ApplicationFileStorage = FileDataReader &
  Pick<FileStorageService, "writeNormalizedData">;

interface ApplicationServiceConfig {
  fileStorage: ApplicationFileStorage;
}

/**
 * Returns a deep clone of an application record to ensure runtime mutations
 * do not bleed back into the storage layer or other shared references.
 */
function cloneApplication(application: Application): Application {
  return globalThis.structuredClone(application);
}

export class ApplicationService {
  private readonly fileStorage: ApplicationFileStorage;

  constructor(config: ApplicationServiceConfig) {
    this.fileStorage = config.fileStorage;
  }

  private getApplicationIndexAndValidate(
    currentData: Awaited<ReturnType<ApplicationFileStorage["readFileData"]>> extends infer T
      ? NonNullable<T>
      : never,
    applicationId: string,
    caseId: string,
  ): {
    applications: Application[];
    applicationIndex: number;
    existingApplication: Application;
  } {
    const applications = currentData.applications ?? [];
    const applicationIndex = applications.findIndex(
      (application) => application.id === applicationId,
    );

    if (applicationIndex === -1) {
      throw new Error("Application not found");
    }

    const existingApplication = applications[applicationIndex];
    if (existingApplication.caseId !== caseId) {
      throw new Error("Application does not belong to the specified case");
    }

    return {
      applications,
      applicationIndex,
      existingApplication,
    };
  }

  async getApplicationsForCase(caseId: string): Promise<Application[]> {
    const data = await readDataAndRequireCase(this.fileStorage, caseId);

    return (data.applications ?? [])
      .filter((application) => application.caseId === caseId)
      .map(cloneApplication);
  }

  async addApplication(application: Application): Promise<Application> {
    const currentData = await readDataAndRequireCase(this.fileStorage, application.caseId);

    const existingApplication = (currentData.applications ?? []).find(
      (candidate) => candidate.id === application.id,
    );

    if (existingApplication) {
      throw new Error(`Application ${application.id} already exists`);
    }

    const updatedData = {
      ...currentData,
      applications: [...(currentData.applications ?? []), cloneApplication(application)],
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    return cloneApplication(application);
  }

  async updateApplication(
    caseId: string,
    applicationId: string,
    updates: Partial<Application>,
  ): Promise<Application> {
    const currentData = await readDataAndRequireCase(
      this.fileStorage,
      caseId,
    );

    const { applications, applicationIndex, existingApplication } =
      this.getApplicationIndexAndValidate(currentData, applicationId, caseId);

    const updatedApplication: Application = {
      ...existingApplication,
      ...updates,
      id: existingApplication.id,
      caseId: existingApplication.caseId,
      retroMonths: [...(updates.retroMonths ?? existingApplication.retroMonths)],
      statusHistory: (updates.statusHistory ?? existingApplication.statusHistory).map(
        (entry: ApplicationStatusHistory) => ({
          ...entry,
        }),
      ),
      verification: {
        ...existingApplication.verification,
        ...updates.verification,
      },
      updatedAt: new Date().toISOString(),
    };

    const updatedApplications = applications.map((application, index) =>
      index === applicationIndex ? updatedApplication : cloneApplication(application),
    );

    await this.fileStorage.writeNormalizedData({
      ...currentData,
      applications: updatedApplications,
    });

    return cloneApplication(updatedApplication);
  }

  async addStatusHistory(
    caseId: string,
    applicationId: string,
    entry: ApplicationStatusHistory,
  ): Promise<Application> {
    const currentData = await readDataAndRequireCase(
      this.fileStorage,
      caseId,
    );

    const { applications, applicationIndex, existingApplication } =
      this.getApplicationIndexAndValidate(currentData, applicationId, caseId);

    const updatedApplication: Application = {
      ...existingApplication,
      status: entry.status,
      statusHistory: [
        ...globalThis.structuredClone(existingApplication.statusHistory),
        globalThis.structuredClone(entry),
      ],
      updatedAt: new Date().toISOString(),
    };

    const updatedApplications = applications.map((application, index) =>
      index === applicationIndex ? updatedApplication : cloneApplication(application),
    );

    await this.fileStorage.writeNormalizedData({
      ...currentData,
      applications: updatedApplications,
    });

    return cloneApplication(updatedApplication);
  }
}