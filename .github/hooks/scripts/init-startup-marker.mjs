import fs from "node:fs";
import path from "node:path";

const input = await readJsonFromStdin();
const statePath = getStatePath(input.cwd);

fs.mkdirSync(path.dirname(statePath), { recursive: true });
fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      status: "pending",
      sessionId: input.sessionId ?? null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      recordedSkill: null,
    },
    null,
    2,
  ),
  "utf8",
);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext:
        "CMSNext startup guard is active. Load repo-memories first, then skill-governance, then any more specific applicable skill, and run `node .github/hooks/scripts/mark-startup-complete.mjs <skill-name|none>` before any non-startup tool action.",
    },
  }),
);

function getStatePath(cwd) {
  const gitStatePath = path.join(cwd, ".git", "copilot-hooks", "startup-status.json");
  if (fs.existsSync(path.join(cwd, ".git"))) {
    return gitStatePath;
  }

  return path.join(cwd, ".github", ".copilot-hooks", "startup-status.json");
}

async function readJsonFromStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}