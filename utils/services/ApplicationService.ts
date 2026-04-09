import { v4 as uuidv4 } from "uuid";

import { formatCaseDisplayName } from "@/domain/cases/formatting";
import type { CaseActivityEntry } from "@/types/activityLog";
import type { Application, ApplicationStatusHistory } from "@/types/application";
import {
  readDataAndFindCase,
  readDataAndRequireCase,
  type FileDataReader,
} from "@/utils/serviceHelpers";

import { ActivityLogService } from "./ActivityLogService";
import type { FileStorageService } from "./FileStorageService";

export type ApplicationFileStorage = FileDataReader &
  Pick<FileStorageService, "getApplicationsForCase" | "touchCaseTimestamps" | "writeNormalizedData">;

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

function getChangedApplicationFields(
  existingApplication: Application,
  updatedApplication: Application,
): string[] {
  const changedFields: string[] = [];

  if (existingApplication.applicationDate !== updatedApplication.applicationDate) {
    changedFields.push("applicationDate");
  }
  if (existingApplication.applicationType !== updatedApplication.applicationType) {
    changedFields.push("applicationType");
  }
  if (existingApplication.status !== updatedApplication.status) {
    changedFields.push("status");
  }
  if (existingApplication.hasWaiver !== updatedApplication.hasWaiver) {
    changedFields.push("hasWaiver");
  }
  if (existingApplication.retroRequestedAt !== updatedApplication.retroRequestedAt) {
    changedFields.push("retroRequestedAt");
  }
  if (
    globalThis.JSON.stringify(existingApplication.retroMonths) !==
    globalThis.JSON.stringify(updatedApplication.retroMonths)
  ) {
    changedFields.push("retroMonths");
  }
  if (
    globalThis.JSON.stringify(existingApplication.statusHistory) !==
    globalThis.JSON.stringify(updatedApplication.statusHistory)
  ) {
    changedFields.push("statusHistory");
  }
  if (
    globalThis.JSON.stringify(existingApplication.verification) !==
    globalThis.JSON.stringify(updatedApplication.verification)
  ) {
    changedFields.push("verification");
  }

  return changedFields;
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

  private replaceApplicationAtIndex(
    applications: Application[],
    applicationIndex: number,
    updatedApplication: Application,
  ): Application[] {
    return applications.map((application, index) =>
      index === applicationIndex ? updatedApplication : cloneApplication(application),
    );
  }

  private async writeApplicationUpdate(params: {
    currentData: NonNullable<Awaited<ReturnType<ApplicationFileStorage["readFileData"]>>>;
    targetCase: NonNullable<Awaited<ReturnType<typeof readDataAndFindCase>>["targetCase"]>;
    caseId: string;
    updatedApplications: Application[];
    activityEntries: CaseActivityEntry[];
    timestamp: string;
  }): Promise<void> {
    const updatedCases = this.fileStorage.touchCaseTimestamps(
      params.currentData.cases,
      [params.caseId],
      params.timestamp,
    );

    await this.fileStorage.writeNormalizedData({
      ...params.currentData,
      cases: updatedCases,
      applications: params.updatedApplications,
      activityLog: ActivityLogService.mergeActivityEntries(
        params.currentData.activityLog,
        params.activityEntries,
      ),
    });
  }

  async getApplicationsForCase(caseId: string): Promise<Application[]> {
    const data = await readDataAndRequireCase(this.fileStorage, caseId);

    return this.fileStorage.getApplicationsForCase(data, caseId).map(cloneApplication);
  }

  async addApplication(application: Application): Promise<Application> {
    const { data: currentData, targetCase } = await readDataAndFindCase(
      this.fileStorage,
      application.caseId,
    );

    const existingApplication = (currentData.applications ?? []).find(
      (candidate) => candidate.id === application.id,
    );

    if (existingApplication) {
      throw new Error(`Application ${application.id} already exists`);
    }

    const timestamp = new Date().toISOString();
    const updatedCases = this.fileStorage.touchCaseTimestamps(
      currentData.cases,
      [application.caseId],
      timestamp,
    );
    const activityEntry: CaseActivityEntry = {
      id: uuidv4(),
      timestamp,
      caseId: targetCase.id,
      caseName: formatCaseDisplayName(targetCase),
      caseMcn: targetCase.caseRecord?.mcn ?? targetCase.mcn ?? null,
      type: "application-added",
      payload: {
        applicationId: application.id,
        applicationType: application.applicationType,
        status: application.status,
        applicationDate: application.applicationDate,
      },
    };

    const updatedData = {
      ...currentData,
      cases: updatedCases,
      applications: [...(currentData.applications ?? []), cloneApplication(application)],
      activityLog: ActivityLogService.mergeActivityEntries(currentData.activityLog, [activityEntry]),
    };

    await this.fileStorage.writeNormalizedData(updatedData);

    return cloneApplication(application);
  }

  async updateApplication(
    caseId: string,
    applicationId: string,
    updates: Partial<Application>,
  ): Promise<Application> {
    const { data: currentData, targetCase } = await readDataAndFindCase(
      this.fileStorage,
      caseId,
    );

    const { applications, applicationIndex, existingApplication } =
      this.getApplicationIndexAndValidate(currentData, applicationId, caseId);

    const timestamp = new Date().toISOString();
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
      updatedAt: timestamp,
    };

    const updatedApplications = this.replaceApplicationAtIndex(
      applications,
      applicationIndex,
      updatedApplication,
    );
    const changedFields = getChangedApplicationFields(existingApplication, updatedApplication);
    const activityEntries: CaseActivityEntry[] =
      changedFields.length === 0
        ? []
        : [
            {
              id: uuidv4(),
              timestamp: updatedApplication.updatedAt,
              caseId: targetCase.id,
              caseName: formatCaseDisplayName(targetCase),
              caseMcn: targetCase.caseRecord?.mcn ?? targetCase.mcn ?? null,
              type: "application-updated",
              payload: {
                applicationId: updatedApplication.id,
                changedFields,
              },
            },
          ];

    await this.writeApplicationUpdate({
      currentData,
      targetCase,
      caseId,
      updatedApplications,
      activityEntries,
      timestamp,
    });

    return cloneApplication(updatedApplication);
  }

  async addStatusHistory(
    caseId: string,
    applicationId: string,
    entry: ApplicationStatusHistory,
  ): Promise<Application> {
    const { data: currentData, targetCase } = await readDataAndFindCase(
      this.fileStorage,
      caseId,
    );

    const { applications, applicationIndex, existingApplication } =
      this.getApplicationIndexAndValidate(currentData, applicationId, caseId);

    const timestamp = entry.changedAt;
    const updatedApplication: Application = {
      ...existingApplication,
      status: entry.status,
      statusHistory: [
        ...globalThis.structuredClone(existingApplication.statusHistory),
        globalThis.structuredClone(entry),
      ],
      updatedAt: timestamp,
    };

    const updatedApplications = this.replaceApplicationAtIndex(
      applications,
      applicationIndex,
      updatedApplication,
    );
    const activityEntry: CaseActivityEntry = {
      id: uuidv4(),
      timestamp: updatedApplication.updatedAt,
      caseId: targetCase.id,
      caseName: formatCaseDisplayName(targetCase),
      caseMcn: targetCase.caseRecord?.mcn ?? targetCase.mcn ?? null,
      type: "application-status-change",
      payload: {
        applicationId: updatedApplication.id,
        fromStatus: existingApplication.status,
        toStatus: entry.status,
        effectiveDate: entry.effectiveDate,
        source: entry.source,
      },
    };

    await this.writeApplicationUpdate({
      currentData,
      targetCase,
      caseId,
      updatedApplications,
      activityEntries: [activityEntry],
      timestamp,
    });

    return cloneApplication(updatedApplication);
  }
}