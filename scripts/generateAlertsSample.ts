import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAlertsIndexFromAlerts, parseStackedAlerts } from '../utils/alertsData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const csvPath = path.resolve(projectRoot, 'Alerts.csv');

  if (!existsSync(csvPath)) {
    console.error(`[generateAlertsSample] Alerts.csv not found at ${csvPath}.`);
    console.error('Provide a stacked alerts export to regenerate sample-alerts.json.');
    process.exitCode = 1;
    return;
  }

  const csvContent = readFileSync(csvPath, 'utf8');

  const parsed = parseStackedAlerts(csvContent, []);
  const index = createAlertsIndexFromAlerts(parsed.alerts);
  const timestamp = new Date().toISOString();

  const samplePayload = {
    version: 3,
    generatedAt: timestamp,
    updatedAt: timestamp,
    sourceFile: path.basename(csvPath),
    summary: index.summary,
    uniqueAlerts: new Set(index.alerts.map(alert => alert.id ?? alert.reportId ?? '')).size,
    alerts: index.alerts,
  };

  const outputPath = path.resolve(projectRoot, 'sample-alerts.json');
  writeFileSync(outputPath, JSON.stringify(samplePayload, null, 2));
  console.info(`[generateAlertsSample] Wrote sample alert payload to ${outputPath}`);
}

main();
