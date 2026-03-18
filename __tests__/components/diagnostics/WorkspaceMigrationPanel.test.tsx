import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceMigrationPanel } from "@/components/diagnostics/WorkspaceMigrationPanel";
import type { WorkspaceMigrationReport } from "@/utils/workspaceV21Migration";

expect.extend(toHaveNoViolations);

const mocks = vi.hoisted(() => ({
  migrateWorkspaceToV21: vi.fn(),
  toastLoading: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    loading: mocks.toastLoading,
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
    error: mocks.toastError,
  },
}));

vi.mock("@/contexts/DataManagerContext", () => ({
  useDataManagerSafe: () => ({
    migrateWorkspaceToV21: mocks.migrateWorkspaceToV21,
  }),
}));

function createMigrationReport(
  fileName: string,
  disposition: WorkspaceMigrationReport["files"][number]["disposition"] = "migrated",
): WorkspaceMigrationReport {
  return {
    processedAt: "2026-03-18T00:00:00.000Z",
    summary: {
      migrated: disposition === "migrated" ? 1 : 0,
      alreadyV21: disposition === "already-v2.1" ? 1 : 0,
      failed: disposition === "failed" ? 1 : 0,
      skipped: 0,
    },
    files: [
      {
        fileName,
        fileKind: "workspace",
        disposition,
        sourceVersion: "2.0",
        counts: {
          people: 1,
          cases: 1,
          financials: 0,
          notes: 0,
          alerts: 0,
        },
        validationErrors: disposition === "failed" ? ["Validation failed"] : [],
        message: "Migration finished.",
      },
    ],
  };
}

describe("WorkspaceMigrationPanel", () => {
  let pendingMigrationResolver: ((value: WorkspaceMigrationReport) => void) | null = null;

  beforeEach(() => {
    mocks.migrateWorkspaceToV21.mockReset();
    mocks.toastLoading.mockClear();
    mocks.toastSuccess.mockClear();
    mocks.toastWarning.mockClear();
    mocks.toastError.mockClear();
    mocks.toastLoading.mockReturnValue("toast-id");
  });

  afterEach(() => {
    pendingMigrationResolver?.(createMigrationReport("cleanup.json"));
    pendingMigrationResolver = null;
  });

  it("clears the previous report immediately when a new migration starts", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const initialReport = createMigrationReport("case-tracker-data.json");
    const updatedReport = createMigrationReport("archived-cases-2026.json", "already-v2.1");
    let resolveSecondRun!: (value: WorkspaceMigrationReport) => void;

    mocks.migrateWorkspaceToV21
      .mockResolvedValueOnce(initialReport)
      .mockImplementationOnce(
        () =>
          new Promise<WorkspaceMigrationReport>((resolve) => {
            resolveSecondRun = resolve;
            pendingMigrationResolver = resolve;
          }),
      );

    render(<WorkspaceMigrationPanel />);

    // ACT
    await user.click(screen.getByRole("button", { name: /run migration/i }));
    expect(await screen.findByText("Migration validation succeeded")).toBeInTheDocument();
    expect(screen.getAllByText("case-tracker-data.json")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: /run migration/i }));

    // ASSERT
    await waitFor(() => {
      expect(screen.getAllByText("case-tracker-data.json")).toHaveLength(1);
    });
    expect(screen.getByRole("button", { name: /migrating/i })).toBeDisabled();

    resolveSecondRun(updatedReport);
    pendingMigrationResolver = null;
    expect(await screen.findByText("archived-cases-2026.json")).toBeInTheDocument();
  });

  it("leaves the report cleared when a rerun fails", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const initialReport = createMigrationReport("case-tracker-data.json");

    mocks.migrateWorkspaceToV21
      .mockResolvedValueOnce(initialReport)
      .mockRejectedValueOnce(new Error("permission denied"));

    render(<WorkspaceMigrationPanel />);

    // ACT
    await user.click(screen.getByRole("button", { name: /run migration/i }));
    expect(await screen.findByText("Migration validation succeeded")).toBeInTheDocument();
    expect(screen.getAllByText("case-tracker-data.json")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: /run migration/i }));

    // ASSERT
    await waitFor(() => {
      expect(screen.getAllByText("case-tracker-data.json")).toHaveLength(1);
    });
    expect(mocks.toastError).toHaveBeenCalledWith("Failed to run workspace migration", {
      id: "toast-id",
      description: "permission denied",
    });
  });

  it("has no accessibility violations", async () => {
    // ARRANGE
    const { container } = render(<WorkspaceMigrationPanel />);

    // ACT
    const results = await axe(container);

    // ASSERT
    expect(results).toHaveNoViolations();
  });
});
