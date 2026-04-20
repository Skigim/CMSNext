import fs from "node:fs";
import path from "node:path";

const input = await readJsonFromStdin();
const toolName = normalizeToolName(input.tool_name);
const statePath = getStatePath(input.cwd);
const state = readState(statePath);

const ALLOWED_STARTUP_TOOLS = new Set([
  "read_file",
  "file_search",
  "grep_search",
  "list_dir",
  "fetch_webpage",
  "semantic_search",
  "memory",
]);

if (state?.status === "complete") {
  respond("allow");
  process.exit(0);
}

if (isAllowedStartupTool(toolName, input.tool_input)) {
  respond(
    "allow",
    "Startup guard still pending. Load `skills/using-superpowers/SKILL.md`, then `repo-memories`, then `skill-governance`, then any more specific applicable skill, and run `node .github/hooks/scripts/mark-startup-complete.mjs <skill-name|none>`."
  );
  process.exit(0);
}

if (toolName === "run_in_terminal" && isMarkerCommand(input.tool_input)) {
  respond("allow");
  process.exit(0);
}

respond(
  "deny",
  "CMSNext startup guard: load `skills/using-superpowers/SKILL.md`, then `repo-memories`, then `skill-governance`, then any more specific applicable skill, and run `node .github/hooks/scripts/mark-startup-complete.mjs <skill-name|none>` before using other tools."
);

function isAllowedStartupTool(toolName, toolInput) {
  if (ALLOWED_STARTUP_TOOLS.has(toolName)) {
    return true;
  }

  if (toolName === "parallel") {
    return isAllowedParallelStartupTool(toolInput);
  }

  return false;
}

function isAllowedParallelStartupTool(toolInput) {
  const toolUses = Array.isArray(toolInput?.tool_uses) ? toolInput.tool_uses : [];
  if (toolUses.length === 0) {
    return false;
  }

  return toolUses.every((toolUse) => {
    const nestedToolName = normalizeToolName(toolUse?.recipient_name);
    if (ALLOWED_STARTUP_TOOLS.has(nestedToolName)) {
      return true;
    }

    return (
      nestedToolName === "run_in_terminal" &&
      isMarkerCommand(toolUse?.parameters)
    );
  });
}

function isMarkerCommand(toolInput) {
  const command = typeof toolInput?.command === "string" ? toolInput.command : "";
  return command.includes(".github/hooks/scripts/mark-startup-complete.mjs");
}

function normalizeToolName(toolName) {
  if (typeof toolName !== "string") {
    return "";
  }

  const segments = toolName.split(".");
  return segments.at(-1) ?? "";
}

function getStatePath(cwd) {
  const gitStatePath = path.join(cwd, ".git", "copilot-hooks", "startup-status.json");
  if (fs.existsSync(path.join(cwd, ".git"))) {
    return gitStatePath;
  }

  return path.join(cwd, ".github", ".copilot-hooks", "startup-status.json");
}

function readState(statePath) {
  if (!fs.existsSync(statePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch (error) {
    process.stderr.write(
      `Warning: failed to parse startup state at ${statePath}: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return null;
  }
}

function respond(permissionDecision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision,
        permissionDecisionReason: reason,
        additionalContext: reason,
      },
    }),
  );
}

async function readJsonFromStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}