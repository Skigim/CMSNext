import type { AlertWithMatch } from "./alertsData";

const mediumDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export interface AlertDueDateInfo {
  label: string;
  hasDate: boolean;
}

export function getAlertDisplayDescription(alert: AlertWithMatch): string {
  const parts = [alert.description, alert.alertType, alert.alertCode];
  const firstValid = parts.find(
    value => typeof value === "string" && value.trim().length > 0,
  );
  return firstValid ? firstValid.trim() : "No description provided";
}

export function getAlertDueDateInfo(alert: AlertWithMatch): AlertDueDateInfo {
  const raw = alert.alertDate ?? alert.createdAt ?? null;
  if (!raw) {
    return { label: "Due date not set", hasDate: false };
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return { label: String(raw), hasDate: false };
  }

  return { label: mediumDateFormatter.format(date), hasDate: true };
}

export function getAlertClientName(alert: AlertWithMatch): string | null {
  const candidates = [alert.personName, alert.matchedCaseName];
  const firstValid = candidates.find(
    candidate => typeof candidate === "string" && candidate.trim().length > 0,
  );
  return firstValid ? firstValid.trim() : null;
}

export function getAlertMcn(alert: AlertWithMatch): string | null {
  const value = typeof alert.mcNumber === "string" ? alert.mcNumber.trim() : "";
  return value.length > 0 ? value : null;
}
