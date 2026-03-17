import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAlertsIndexFromAlerts, parseStackedAlerts } from '../utils/alertsData';
import { DEFAULT_ALERT_COLORS, COLOR_SLOTS, type ColorSlot } from '../types/colorSlots';
import { mergeCategoryConfig } from '../types/categoryConfig';

interface AlertTypeCandidate {
  alertType?: string;
}

function assignAlertColorSlot(alertType: string, usedSlots: Set<ColorSlot>): ColorSlot {
  const defaultColor = DEFAULT_ALERT_COLORS[alertType];
  if (defaultColor && !usedSlots.has(defaultColor)) {
    return defaultColor;
  }

  for (const slot of COLOR_SLOTS) {
    if (!usedSlots.has(slot)) {
      return slot;
    }
  }

  const hash = alertType.split('').reduce(
    (total, character) => total + (character.codePointAt(0) ?? 0),
    0,
  );
  return COLOR_SLOTS[hash % COLOR_SLOTS.length];
}

function buildAlertTypes(alertTypeNames: string[]) {
  const usedSlots = new Set<ColorSlot>();

  return alertTypeNames.map((alertType) => {
    const colorSlot = assignAlertColorSlot(alertType, usedSlots);
    usedSlots.add(colorSlot);
    return {
      name: alertType,
      colorSlot,
    };
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const csvPath = path.resolve(projectRoot, 'Alerts.csv');

  if (!existsSync(csvPath)) {
    console.error(`[generateAlertsSample] Alerts.csv not found at ${csvPath}.`);
    console.error('Provide a stacked alerts export to regenerate samples/sample-alerts.json.');
    process.exitCode = 1;
    return;
  }

  const csvContent = readFileSync(csvPath, 'utf8');

  const parsed = parseStackedAlerts(csvContent, []);
  const index = createAlertsIndexFromAlerts(parsed.alerts);
  const timestamp = new Date().toISOString();
  const alertTypeNames: string[] = Array.from(
    new Set(
      (index.alerts as AlertTypeCandidate[])
        .map((alert) => alert.alertType?.trim())
        .filter((alertType): alertType is string => Boolean(alertType)),
    ),
  );
  const categoryConfig = mergeCategoryConfig({
    alertTypes: buildAlertTypes(alertTypeNames),
  });

  const samplePayload = {
    version: '2.1',
    people: [],
    cases: [],
    financials: [],
    notes: [],
    alerts: index.alerts,
    exported_at: timestamp,
    total_cases: 0,
    categoryConfig,
    activityLog: [],
  };

  const samplesDirectory = path.resolve(projectRoot, 'samples');
  mkdirSync(samplesDirectory, { recursive: true });
  const outputPath = path.resolve(samplesDirectory, 'sample-alerts.json');
  writeFileSync(outputPath, JSON.stringify(samplePayload, null, 2));
  console.info(`[generateAlertsSample] Wrote sample alert payload to ${outputPath}`);
}

main();
