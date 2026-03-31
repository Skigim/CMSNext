import { createBlankHouseholdMemberData } from "@/domain/cases";
import { dateInputValueToISO } from "@/domain/common";
import type { IntakeFormData } from "@/domain/validation/intake.schema";
import { createBlankIntakeForm } from "@/domain/validation/intake.schema";

export type MarkdownImportSectionName =
  | "Person Info"
  | "Case Info"
  | "Contact Info"
  | "Household";

export interface MarkdownImportMappedField {
  section: MarkdownImportSectionName;
  label: string;
  value: string;
  target: string;
}

export interface MarkdownImportUnsupportedField {
  section: string;
  label: string;
  value: string;
  reason: string;
}

export interface MarkdownImportHouseholdPreviewRow {
  name: string;
  relationship: string;
  dateOfBirth: string;
  phone: string;
}

export interface MarkdownCaseImportResult {
  initialData: Partial<IntakeFormData>;
  mappedFields: MarkdownImportMappedField[];
  unsupportedFields: MarkdownImportUnsupportedField[];
  unsupportedSections: string[];
  warnings: string[];
  householdPreview: MarkdownImportHouseholdPreviewRow[];
  hasImportedData: boolean;
}

interface ParsedSection {
  title: string;
  lines: string[];
}

interface AddressParseResult {
  street: string;
  apt: string;
  city: string;
  state: string;
  zip: string;
}

const SUPPORTED_SECTIONS = new Map<string, MarkdownImportSectionName>([
  ["person info", "Person Info"],
  ["case info", "Case Info"],
  ["contact info", "Contact Info"],
  ["household", "Household"],
]);

const PERSON_FIELD_TARGETS = new Map<string, string>([
  ["first name", "firstName"],
  ["last name", "lastName"],
  ["applicant name", "firstName/lastName"],
  ["dob", "dateOfBirth"],
  ["date of birth", "dateOfBirth"],
  ["marital status", "maritalStatus"],
  ["phone", "phone"],
  ["phone number", "phone"],
  ["email", "email"],
  ["email address", "email"],
  ["ssn", "ignored"],
  ["social security number", "ignored"],
]);

const CASE_FIELD_TARGETS = new Map<string, string>([
  ["case id", "mcn"],
  ["mcn", "mcn"],
  ["waiver requested", "withWaiver"],
  ["retro months requested", "retroRequested"],
  ["retro requested", "retroRequested"],
  ["retro text", "retroRequested"],
  ["application date", "applicationDate"],
  ["case type", "ignored"],
  ["application type", "ignored"],
  ["living arrangement", "ignored"],
]);

const CONTACT_FIELD_TARGETS = new Map<string, string>([
  ["physical address", "address"],
  ["mailing same as physical", "mailingAddress.sameAsPhysical"],
  ["mailing address", "mailingAddress"],
  ["phone", "phone"],
  ["phone number", "phone"],
  ["email", "email"],
  ["email address", "email"],
  ["best contact number", "phone"],
  ["additional contact number", "ignored"],
  ["preferred message delivery", "ignored"],
  ["email for notices", "email"],
]);

const HOUSEHOLD_SUPPORTED_COLUMNS = new Set([
  "name",
  "household member name",
  "relationship",
  "dob",
  "date of birth",
  "phone",
]);

const FIELD_VALUE_TABLE_LABEL_HEADERS = new Set(["field", "label", "key"]);
const FIELD_VALUE_TABLE_VALUE_HEADERS = new Set(["value", "answer"]);
const HOUSEHOLD_NAME_COLUMNS = ["name", "household member name"] as const;
const HOUSEHOLD_DOB_COLUMNS = ["dob", "date of birth"] as const;

function normalizeLabel(value: string): string {
  return value
    .replaceAll(/[*_`]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/:$/, "")
    .toLowerCase();
}

function normalizeWhitespace(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function normalizeImportedValue(value: string): string {
  const normalized = normalizeWhitespace(value);
  return normalized === "-" ? "" : normalized;
}

function getFirstColumnValue(
  row: Record<string, string>,
  columnNames: readonly string[],
): string {
  for (const columnName of columnNames) {
    const value = normalizeImportedValue(row[columnName] ?? "");
    if (value.length > 0) {
      return value;
    }
  }

  return "";
}

function unwrapDelimitedSectionTitle(
  line: string,
  delimiter: "**" | "__",
): string | null {
  const trimmed = line.trim();
  const withoutColon = trimmed.endsWith(":")
    ? trimmed.slice(0, -1).trimEnd()
    : trimmed;

  if (
    !withoutColon.startsWith(delimiter)
    || !withoutColon.endsWith(delimiter)
    || withoutColon.length <= delimiter.length * 2
  ) {
    return null;
  }

  const innerTitle = normalizeWhitespace(
    withoutColon.slice(delimiter.length, -delimiter.length),
  );

  return innerTitle.length > 0 ? innerTitle : null;
}

function isSectionTitleLine(line: string): boolean {
  const trimmed = line.trim();

  if (trimmed.startsWith("#")) {
    let hashCount = 0;
    while (hashCount < trimmed.length && trimmed[hashCount] === "#") {
      hashCount += 1;
    }

    return (
      hashCount > 0
      && hashCount <= 6
      && trimmed[hashCount] === " "
      && normalizeWhitespace(trimmed.slice(hashCount + 1)).length > 0
    );
  }

  return (
    unwrapDelimitedSectionTitle(trimmed, "**") !== null
    || unwrapDelimitedSectionTitle(trimmed, "__") !== null
  );
}

function extractHeadingTitle(line: string): string {
  const boldTitle =
    unwrapDelimitedSectionTitle(line, "**")
    ?? unwrapDelimitedSectionTitle(line, "__");

  if (boldTitle) {
    return boldTitle;
  }

  return normalizeWhitespace(
    line
      .trim()
      .replace(/^#{1,6}\s+/, "")
      .replace(/:$/, "")
      .replaceAll(/[*_`]/g, ""),
  );
}

function extractSections(input: string): ParsedSection[] {
  const normalized = input.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;

  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trimEnd();
    if (isSectionTitleLine(line)) {
      const title = extractHeadingTitle(line);
      currentSection = { title, lines: [] };
      sections.push(currentSection);
      continue;
    }

    if (!currentSection) {
      continue;
    }

    currentSection.lines.push(line);
  }

  return sections;
}

function splitTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => normalizeWhitespace(cell));
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

interface ParsedMarkdownTable {
  headers: string[];
  rows: Array<Record<string, string>>;
}

function parseMarkdownTable(lines: string[]): ParsedMarkdownTable | null {
  const tableLines = lines.filter((line) => line.trim().startsWith("|"));
  if (tableLines.length < 2) {
    return null;
  }

  const headerCells = splitTableCells(tableLines[0] ?? "");
  if (headerCells.length === 0) {
    return null;
  }

  const rows = tableLines.slice(1).map(splitTableCells).filter((cells) => cells.length > 0);
  const dataRows = rows.filter((cells) => !isSeparatorRow(cells));

  return {
    headers: headerCells,
    rows: dataRows.map((cells) => {
      const record: Record<string, string> = {};
      headerCells.forEach((header, index) => {
        record[normalizeLabel(header)] = cells[index] ?? "";
      });
      return record;
    }),
  };
}

function parseKeyValueLines(lines: string[]): Array<{ label: string; value: string }> {
  const table = parseMarkdownTable(lines);
  if (table && table.rows.length > 0) {
    const normalizedHeaders = table.headers.map(normalizeLabel);
    const isFieldValueTable = normalizedHeaders.length >= 2
      && FIELD_VALUE_TABLE_LABEL_HEADERS.has(normalizedHeaders[0] ?? "")
      && FIELD_VALUE_TABLE_VALUE_HEADERS.has(normalizedHeaders[1] ?? "");

    if (isFieldValueTable) {
      return table.rows
        .map((row) => {
          const label = normalizeImportedValue(row[normalizedHeaders[0] ?? ""] ?? "");
          const value = normalizeImportedValue(row[normalizedHeaders[1] ?? ""] ?? "");
          return {
            label,
            value,
          };
        })
        .filter(({ label, value }) => label.length > 0 && value.length > 0);
    }

    const firstRow = table.rows[0];
    if (!firstRow) {
      return [];
    }

    return table.headers
      .map((header) => ({
        label: normalizeWhitespace(header),
        value: normalizeImportedValue(firstRow[normalizeLabel(header)] ?? ""),
      }))
      .filter(({ label, value }) => label.length > 0 && value.length > 0);
  }

  return lines
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length > 0)
    .map((line) => {
      const withoutListMarker = line.startsWith("- ") || line.startsWith("* ")
        ? line.slice(2).trimStart()
        : line;
      const separatorIndex = withoutListMarker.indexOf(":");

      if (
        separatorIndex <= 0
        || separatorIndex === withoutListMarker.length - 1
      ) {
        return null;
      }

      const rawLabel = withoutListMarker.slice(0, separatorIndex).trim();
      const rawValue = withoutListMarker.slice(separatorIndex + 1).trim();
      const trimmedLabel = rawLabel.trim();
      const label = unwrapDelimitedSectionTitle(trimmedLabel, "**")
        ?? unwrapDelimitedSectionTitle(trimmedLabel, "__")
        ?? trimmedLabel;

      if (
        label.length === 0
        || label.includes(":")
        || rawValue.length === 0
      ) {
        return null;
      }

      return {
        label: normalizeWhitespace(label),
        value: normalizeImportedValue(rawValue),
      };
    })
    .filter((entry): entry is { label: string; value: string } => entry !== null);
}

function splitName(value: string): { firstName: string; lastName: string; warning?: string } {
  const normalized = normalizeWhitespace(value);
  if (normalized.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (normalized.includes(",")) {
    const [lastName = "", firstName = ""] = normalized
      .split(",", 2)
      .map((part) => normalizeWhitespace(part));
    return { firstName, lastName };
  }

  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return {
      firstName: parts[0] ?? "",
      lastName: "",
      warning: `Could not confidently split name "${normalized}" into first and last name.`,
    };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1] ?? "",
  };
}

function parseBoolean(value: string): boolean | null {
  const normalized = normalizeLabel(value);
  if (["yes", "y", "true"].includes(normalized)) {
    return true;
  }
  if (["no", "n", "false"].includes(normalized)) {
    return false;
  }
  return null;
}

function parseDate(value: string): string | null {
  const normalized = normalizeWhitespace(value);
  const slashDateMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDateMatch) {
    const [, month, day, year] = slashDateMatch;
    const numericMonth = Number.parseInt(month, 10);
    const numericDay = Number.parseInt(day, 10);
    if (numericMonth >= 1 && numericMonth <= 12 && numericDay >= 1 && numericDay <= 31) {
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    return null;
  }

  return dateInputValueToISO(normalized);
}

function splitStreetAndApt(streetValue: string): { street: string; apt: string } {
  const normalized = normalizeWhitespace(streetValue);
  const aptMatch = normalized.match(/^(.*?)(?:,?\s+)(apt|apartment|unit|#)\s*([^,]+)$/i);
  if (!aptMatch) {
    return { street: normalized, apt: "" };
  }

  return {
    street: normalizeWhitespace(aptMatch[1] ?? ""),
    apt: normalizeWhitespace(`${aptMatch[2] ?? ""} ${aptMatch[3] ?? ""}`),
  };
}

function parseAddress(value: string): AddressParseResult | null {
  const normalized = normalizeWhitespace(value);
  if (normalized.length === 0) {
    return null;
  }

  const parts = normalized.split(",").map((part) => normalizeWhitespace(part)).filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  const stateZip = parts[parts.length - 1] ?? "";
  const city = parts[parts.length - 2] ?? "";
  const streetPart = parts.slice(0, -2).join(", ");
  const stateZipMatch = stateZip.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (!stateZipMatch || city.length === 0 || streetPart.length === 0) {
    return null;
  }

  const streetAndApt = splitStreetAndApt(streetPart);

  return {
    street: streetAndApt.street,
    apt: streetAndApt.apt,
    city,
    state: (stateZipMatch[1] ?? "").toUpperCase(),
    zip: stateZipMatch[2] ?? "",
  };
}

function recordMappedField(
  mappedFields: MarkdownImportMappedField[],
  section: MarkdownImportSectionName,
  label: string,
  value: string,
  target: string,
): void {
  mappedFields.push({
    section,
    label,
    value,
    target,
  });
}

function recordUnsupportedField(
  unsupportedFields: MarkdownImportUnsupportedField[],
  section: string,
  label: string,
  value: string,
  reason: string,
): void {
  unsupportedFields.push({
    section,
    label,
    value,
    reason,
  });
}

function shouldAssignScalarField(
  currentValue: unknown,
  supportedSection: MarkdownImportSectionName,
): boolean {
  if (currentValue === undefined) {
    return true;
  }

  // Contact Info can safely backfill shared phone/email fields, but it should not
  // overwrite explicit values already parsed from Person Info.
  return supportedSection !== "Contact Info";
}

function applyAddressValue(
  target: "address" | "mailingAddress",
  value: string,
  label: string,
  section: MarkdownImportSectionName,
  result: MarkdownCaseImportResult,
  blankForm: IntakeFormData,
): void {
  const parsedAddress = parseAddress(value);
  if (!parsedAddress) {
    result.warnings.push(
      `${section}: ${label} could not be confidently parsed into street/city/state/zip. Review it manually in intake.`,
    );
    return;
  }

  if (target === "address") {
    result.initialData.address = {
      ...blankForm.address,
      ...parsedAddress,
    };
  } else {
    result.initialData.mailingAddress = {
      ...blankForm.mailingAddress,
      ...(result.initialData.mailingAddress ?? {}),
      ...parsedAddress,
      sameAsPhysical: result.initialData.mailingAddress?.sameAsPhysical ?? false,
    };
  }

  recordMappedField(result.mappedFields, section, label, value, target);
}

function parseHouseholdSection(
  lines: string[],
  result: MarkdownCaseImportResult,
  blankForm: IntakeFormData,
): void {
  const table = parseMarkdownTable(lines);
  const rows = table?.rows ?? [];
  if (rows.length === 0) {
    return;
  }

  const members: IntakeFormData["householdMembers"] = rows
    .map((row) => {
      for (const [column, cellValue] of Object.entries(row)) {
        const normalizedValue = normalizeImportedValue(cellValue);
        if (!HOUSEHOLD_SUPPORTED_COLUMNS.has(column) && normalizedValue.length > 0) {
          recordUnsupportedField(
            result.unsupportedFields,
            "Household",
            column,
            normalizedValue,
            "Unsupported household column for MVP import.",
          );
        }
      }

      const name = getFirstColumnValue(row, HOUSEHOLD_NAME_COLUMNS);
      const relationship = normalizeImportedValue(row.relationship ?? "");
      const dateOfBirth = getFirstColumnValue(row, HOUSEHOLD_DOB_COLUMNS);
      const phone = normalizeImportedValue(row.phone ?? "");
      const split = splitName(name);
      if (split.warning) {
        result.warnings.push(`Household: ${split.warning}`);
      }

      const parsedDateOfBirth = parseDate(dateOfBirth);
      if (dateOfBirth.length > 0 && !parsedDateOfBirth) {
        result.warnings.push(`Household: could not parse DOB "${dateOfBirth}" for ${name || "unnamed member"}.`);
      }

      const blankMember = createBlankHouseholdMemberData({
        livingArrangement: blankForm.livingArrangement,
        defaultState: blankForm.address.state,
      });

      return {
        ...blankMember,
        firstName: split.firstName,
        lastName: split.lastName,
        relationshipType: relationship,
        phone: normalizeWhitespace(phone),
        dateOfBirth: parsedDateOfBirth ?? "",
        address: {
          ...blankMember.address,
          apt: blankMember.address.apt ?? "",
        },
        mailingAddress: {
          ...blankMember.mailingAddress,
          apt: blankMember.mailingAddress.apt ?? "",
        },
      };
    })
    .filter((member) => {
      return [member.firstName, member.lastName, member.relationshipType, member.phone, member.dateOfBirth]
        .some((value) => value.trim().length > 0);
    });

  if (members.length === 0) {
    return;
  }

  result.initialData.householdMembers = members;
  result.householdPreview = members.map((member) => ({
    name: normalizeWhitespace([member.firstName, member.lastName].filter(Boolean).join(" ")),
    relationship: member.relationshipType,
    dateOfBirth: member.dateOfBirth,
    phone: member.phone,
  }));
  recordMappedField(result.mappedFields, "Household", "Household members", `${members.length}`, "householdMembers");
}

export function parseMarkdownCaseImport(input: string): MarkdownCaseImportResult {
  const blankForm = createBlankIntakeForm();
  const result: MarkdownCaseImportResult = {
    initialData: {},
    mappedFields: [],
    unsupportedFields: [],
    unsupportedSections: [],
    warnings: [],
    householdPreview: [],
    hasImportedData: false,
  };

  const sections = extractSections(input);
  const personValues = new Map<string, { label: string; value: string }>();

  for (const section of sections) {
    const normalizedSectionTitle = normalizeLabel(section.title);
    const supportedSection = SUPPORTED_SECTIONS.get(normalizedSectionTitle);

    if (!supportedSection) {
      result.unsupportedSections.push(section.title);
      continue;
    }

    if (supportedSection === "Household") {
      parseHouseholdSection(section.lines, result, blankForm);
      continue;
    }

    const fieldEntries = parseKeyValueLines(section.lines);
    for (const entry of fieldEntries) {
      const normalizedFieldLabel = normalizeLabel(entry.label);
      const trimmedValue = normalizeWhitespace(entry.value);
      if (trimmedValue.length === 0) {
        continue;
      }

      const targetMap = supportedSection === "Person Info"
        ? PERSON_FIELD_TARGETS
        : supportedSection === "Case Info"
          ? CASE_FIELD_TARGETS
          : CONTACT_FIELD_TARGETS;
      const target = targetMap.get(normalizedFieldLabel);

      if (!target) {
        recordUnsupportedField(
          result.unsupportedFields,
          supportedSection,
          entry.label,
          trimmedValue,
          "Unsupported field for MVP import.",
        );
        continue;
      }

      if (target === "ignored") {
        recordUnsupportedField(
          result.unsupportedFields,
          supportedSection,
          entry.label,
          trimmedValue,
          supportedSection === "Person Info" && ["ssn", "social security number"].includes(normalizedFieldLabel)
            ? "SSN is intentionally out of scope for MVP import."
            : "Detected but intentionally unsupported for MVP import.",
        );
        continue;
      }

      if (supportedSection === "Person Info") {
        personValues.set(normalizedFieldLabel, { label: entry.label, value: trimmedValue });
      }

      switch (target) {
        case "firstName":
        case "lastName":
        case "maritalStatus":
        case "phone":
        case "email":
        case "mcn":
        case "retroRequested": {
          if (shouldAssignScalarField((result.initialData as Record<string, unknown>)[target], supportedSection)) {
            (result.initialData as Record<string, unknown>)[target] = trimmedValue;
            recordMappedField(result.mappedFields, supportedSection, entry.label, trimmedValue, target);
          }
          break;
        }
        case "dateOfBirth":
        case "applicationDate": {
          const parsedDate = parseDate(trimmedValue);
          if (!parsedDate) {
            result.warnings.push(`${supportedSection}: could not parse ${entry.label} value "${trimmedValue}" as a date.`);
            break;
          }
          (result.initialData as Record<string, unknown>)[target] = parsedDate;
          recordMappedField(result.mappedFields, supportedSection, entry.label, trimmedValue, target);
          break;
        }
        case "withWaiver": {
          const parsedBoolean = parseBoolean(trimmedValue);
          if (parsedBoolean === null) {
            result.warnings.push(`Case Info: could not interpret ${entry.label} value "${trimmedValue}" as yes/no.`);
            break;
          }
          result.initialData.withWaiver = parsedBoolean;
          recordMappedField(result.mappedFields, supportedSection, entry.label, trimmedValue, target);
          break;
        }
        case "address":
        case "mailingAddress": {
          applyAddressValue(target, trimmedValue, entry.label, supportedSection, result, blankForm);
          break;
        }
        case "mailingAddress.sameAsPhysical": {
          const parsedBoolean = parseBoolean(trimmedValue);
          if (parsedBoolean === null) {
            result.warnings.push(`Contact Info: could not interpret ${entry.label} value "${trimmedValue}" as yes/no.`);
            break;
          }
          result.initialData.mailingAddress = {
            ...blankForm.mailingAddress,
            ...(result.initialData.mailingAddress ?? {}),
            sameAsPhysical: parsedBoolean,
          };
          recordMappedField(result.mappedFields, supportedSection, entry.label, trimmedValue, target);
          break;
        }
      }
    }
  }

  const explicitFirstName = personValues.get("first name")?.value ?? "";
  const explicitLastName = personValues.get("last name")?.value ?? "";
  const applicantName = personValues.get("applicant name")?.value ?? "";

  if (explicitFirstName.length > 0 && explicitLastName.length > 0) {
    result.initialData.firstName = explicitFirstName;
    result.initialData.lastName = explicitLastName;
  } else if (applicantName.length > 0) {
    const split = splitName(applicantName);
    result.initialData.firstName = split.firstName;
    result.initialData.lastName = split.lastName;
    if (split.warning) {
      result.warnings.push(`Person Info: ${split.warning}`);
    }
    recordMappedField(result.mappedFields, "Person Info", "Applicant Name", applicantName, "firstName/lastName");
  }

  if (result.initialData.mailingAddress?.sameAsPhysical !== false && result.initialData.mailingAddress) {
    result.initialData.mailingAddress = {
      ...blankForm.mailingAddress,
      ...result.initialData.mailingAddress,
      sameAsPhysical: true,
    };
  }

  result.hasImportedData = result.mappedFields.length > 0;
  return result;
}
