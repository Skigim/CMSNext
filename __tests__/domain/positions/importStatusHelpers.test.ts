import { describe, expect, it } from "vitest";
import { buildStatusImportPlan } from "@/domain/positions/importStatusHelpers";
import type { CaseStatusUpdate } from "@/domain/positions/matching";
import type { StatusConfig } from "@/types/categoryConfig";
import type { CaseStatus, StoredCase } from "@/types/case";

function createCase(id: string, status: CaseStatus = "Active"): StoredCase {
  return {
    id,
    name: `Case ${id}`,
    mcn: `MCN-${id}`,
    status,
    priority: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    person: {
      id: `person-${id}`,
      firstName: "Test",
      lastName: "User",
      name: "Test User",
      email: "",
      phone: "",
      dateOfBirth: "1990-01-01",
      ssn: "",
      organizationId: null,
      livingArrangement: "Alone",
      address: { street: "", city: "", state: "", zip: "" },
      mailingAddress: { street: "", city: "", state: "", zip: "", sameAsPhysical: true },
      authorizedRepIds: [],
      familyMembers: [],
      createdAt: new Date().toISOString(),
      dateAdded: new Date().toISOString(),
    },
    caseRecord: {
      id: `record-${id}`,
      mcn: `MCN-${id}`,
      applicationDate: new Date().toISOString(),
      caseType: "SNAP",
      applicationType: "New",
      personId: `person-${id}`,
      spouseId: "",
      status,
      description: "",
      priority: false,
      livingArrangement: "Alone",
      withWaiver: false,
      admissionDate: new Date().toISOString(),
      organizationId: "",
      authorizedReps: [],
      retroRequested: "",
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
    },
  };
}

describe("buildStatusImportPlan", () => {
  it("canonicalizes imported status to configured casing", () => {
    const existingStatuses: StatusConfig[] = [
      { name: "Pending", colorSlot: "amber" },
      { name: "Active", colorSlot: "green" },
    ];
    const selectedUpdates: CaseStatusUpdate[] = [
      { case: createCase("1"), currentStatus: "Active", importedStatus: "pending" },
      { case: createCase("2"), currentStatus: "Active", importedStatus: " PENDING " },
    ];

    const result = buildStatusImportPlan(selectedUpdates, existingStatuses);

    expect(result.newStatuses).toEqual([]);
    expect(Array.from(result.statusUpdatesByStatus.keys())).toEqual(["Pending"]);
    expect(result.statusUpdatesByStatus.get("Pending")).toEqual(["1", "2"]);
  });

  it("adds unknown statuses and groups updates by canonical status", () => {
    const existingStatuses: StatusConfig[] = [{ name: "Active", colorSlot: "green" }];
    const selectedUpdates: CaseStatusUpdate[] = [
      { case: createCase("1"), currentStatus: "Active", importedStatus: "Review" },
      { case: createCase("2"), currentStatus: "Active", importedStatus: "review" },
    ];

    const result = buildStatusImportPlan(selectedUpdates, existingStatuses);

    expect(result.newStatuses).toHaveLength(1);
    expect(result.newStatuses[0].name).toBe("Review");
    expect(result.statusUpdatesByStatus.get("Review")).toEqual(["1", "2"]);
    expect(result.updatedCaseCount).toBe(2);
  });
});
