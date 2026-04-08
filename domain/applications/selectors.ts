import type { Application } from "@/types/application";

function toTimestamp(value: string): number | null {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function compareDates(leftValue: string, rightValue: string): number | null {
  const leftTimestamp = toTimestamp(leftValue);
  const rightTimestamp = toTimestamp(rightValue);

  if (leftTimestamp !== null && rightTimestamp !== null) {
    return leftTimestamp - rightTimestamp;
  }

  if (leftTimestamp !== null) {
    return -1;
  }

  if (rightTimestamp !== null) {
    return 1;
  }

  return null;
}

export function selectOldestNonTerminalApplication(
  applications: Application[],
  completionStatuses: Set<string>,
): Application | null {
  const normalizedCompletionStatuses = new Set(
    [...completionStatuses].map((status) => status.toLowerCase()),
  );

  const openApplications = applications.filter(
    (application) =>
      !normalizedCompletionStatuses.has(application.status.toLowerCase()),
  );

  if (openApplications.length === 0) {
    return null;
  }

  return [...openApplications].sort((left, right) => {
    const applicationDateDifference = compareDates(
      left.applicationDate,
      right.applicationDate,
    );
    if (applicationDateDifference !== null && applicationDateDifference !== 0) {
      return applicationDateDifference;
    }

    const createdAtDifference = compareDates(left.createdAt, right.createdAt);
    if (createdAtDifference !== null && createdAtDifference !== 0) {
      return createdAtDifference;
    }

    return left.id.localeCompare(right.id);
  })[0];
}