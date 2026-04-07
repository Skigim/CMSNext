import fs from "node:fs";
import path from "node:path";

const skillName = process.argv[2] ?? "none";
const cwd = process.cwd();
const statePath = getStatePath(cwd);

fs.mkdirSync(path.dirname(statePath), { recursive: true });

let existingState = {};
if (fs.existsSync(statePath)) {
  try {
    existingState = JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch (error) {
    process.stderr.write(
      `Warning: failed to read startup state at ${statePath}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    existingState = {};
  }
}

const nextState = {
  ...existingState,
  status: "complete",
  completedAt: new Date().toISOString(),
  recordedSkill: skillName,
};

fs.writeFileSync(statePath, JSON.stringify(nextState, null, 2), "utf8");
process.stdout.write(`CMSNext startup marker recorded with skill: ${skillName}\n`);

function getStatePath(cwd) {
  const gitStatePath = path.join(cwd, ".git", "copilot-hooks", "startup-status.json");
  if (fs.existsSync(path.join(cwd, ".git"))) {
    return gitStatePath;
  }

  return path.join(cwd, ".github", ".copilot-hooks", "startup-status.json");
}