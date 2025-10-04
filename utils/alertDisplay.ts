import type { AlertWithMatch } from "./alertsData";

const mediumDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export interface AlertDueDateInfo {
  label: string;
  hasDate: boolean;
}

export function getAlertDisplayDescription(alert: AlertWithMatch): string {
  const parts = [alert.description, alert.alertType, alert.alertCode].map(value =>
    typeof value === "string" ? value.trim() : "",
  );

  for (const part of parts) {
    if (part.length > 0) {
      return part;
    }
  }

  return "No description provided";
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
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
}

export function getAlertMcn(alert: AlertWithMatch): string | null {
  const value = typeof alert.mcNumber === "string" ? alert.mcNumber.trim() : "";
  if (value.length > 0) {
    return value;
  }

  return null;
}
