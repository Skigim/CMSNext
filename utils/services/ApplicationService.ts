import type { Application, ApplicationStatusHistory } from "@/types/application";

import type { FileStorageService } from "./FileStorageService";
import { readDataAndRequireCase } from "@/utils/serviceHelpers";

interface ApplicationServiceConfig {
  fileStorage: FileStorageService;
}

function cloneApplication(application: Application): Application {
  return {
    ...application,
    retroMonths: [...application.retroMonths],
    statusHistory: application.statusHistory.map((entry) => ({ ...entry })),
    verification: { ...application.verification },
  };
}

export class ApplicationService {
  private readonly fileStorage: FileStorageService;

  constructor(config: ApplicationServiceConfig) {
    this.fileStorage = config.fileStorage;
  }

  async getApplicationsForCase(caseId: string): Promise<Application[]> {
    const data = await this.fileStorage.readFileData();
    if (!data) {
      return [];
    }

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
    applicationId: string,
    updates: Partial<Application>,
  ): Promise<Application> {
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error("Failed to read current data");
    }

    const applications = currentData.applications ?? [];
    const applicationIndex = applications.findIndex(
      (application) => application.id === applicationId,
    );

    if (applicationIndex === -1) {
      throw new Error("Application not found");
    }

    const existingApplication = applications[applicationIndex];
    const updatedApplication: Application = {
      ...existingApplication,
      ...updates,
      id: existingApplication.id,
      caseId: existingApplication.caseId,
      retroMonths: [...(updates.retroMonths ?? existingApplication.retroMonths)],
      statusHistory: (updates.statusHistory ?? existingApplication.statusHistory).map((entry: ApplicationStatusHistory) => ({
        ...entry,
      })),
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
    applicationId: string,
    entry: ApplicationStatusHistory,
  ): Promise<Application> {
    const currentData = await this.fileStorage.readFileData();
    if (!currentData) {
      throw new Error("Failed to read current data");
    }

    const applications = currentData.applications ?? [];
    const applicationIndex = applications.findIndex(
      (application) => application.id === applicationId,
    );

    if (applicationIndex === -1) {
      throw new Error("Application not found");
    }

    const existingApplication = applications[applicationIndex];
    const updatedApplication: Application = {
      ...existingApplication,
      status: entry.status,
      statusHistory: [...existingApplication.statusHistory.map((historyEntry: ApplicationStatusHistory) => ({ ...historyEntry })), { ...entry }],
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