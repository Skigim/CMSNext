import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStackedAlerts } from '../utils/alertsData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const csvPath = path.resolve(projectRoot, 'Alerts.csv');

  let csvContent: string;
  try {
    csvContent = readFileSync(csvPath, 'utf8');
  } catch (error) {
    console.error(`[generateAlertsSample] Failed to read Alerts.csv at ${csvPath}`);
    throw error;
  }

  const parsed = parseStackedAlerts(csvContent, []);
  const uniqueById = new Map<string, typeof parsed.alerts[number]>();

  for (const alert of parsed.alerts) {
    if (!uniqueById.has(alert.id)) {
      uniqueById.set(alert.id, alert);
    }
  }

  const samplePayload = {
    generatedAt: new Date().toISOString(),
    sourceFile: path.basename(csvPath),
    summary: parsed.summary,
    uniqueAlerts: uniqueById.size,
    alerts: Array.from(uniqueById.values()).map(alert => ({
      id: alert.id,
      reportId: alert.reportId ?? null,
      alertCode: alert.alertCode,
      alertType: alert.alertType,
      severity: alert.severity,
      alertDate: alert.alertDate,
      personName: alert.personName,
      program: alert.program,
      description: alert.description,
      mcNumber: alert.mcNumber,
      matchStatus: alert.matchStatus,
      status: alert.status,
      resolvedAt: alert.resolvedAt ?? null,
      resolutionNotes: alert.resolutionNotes ?? null,
      metadata: alert.metadata,
    })),
  };

  const outputPath = path.resolve(projectRoot, 'sample-alerts.json');
  writeFileSync(outputPath, JSON.stringify(samplePayload, null, 2));
  console.info(`[generateAlertsSample] Wrote sample alert payload to ${outputPath}`);
}

main();
