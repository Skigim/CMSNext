# Gemini CLI Tool Mapping

Skills use Claude Code tool names. When you encounter these in a skill, use your platform equivalent:

| Skill references                | Gemini CLI equivalent                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Read` (file reading)           | `read_file`                                                                                                                                       |
| `Write` (file creation)         | `write_file`                                                                                                                                      |
| `Edit` (file editing)           | `replace`                                                                                                                                         |
| `Bash` (run commands)           | `run_shell_command`                                                                                                                               |
| `Grep` (search file content)    | `grep_search`                                                                                                                                     |
| `Glob` (search files by name)   | `glob`                                                                                                                                            |
| `TodoWrite` (task tracking)     | `write_todos`                                                                                                                                     |
| `Skill` tool (invoke a skill)   | Use the current Gemini CLI skill-activation entry point documented by the harness; do not assume `activate_skill` without verification            |
| `WebSearch`                     | `google_web_search`                                                                                                                               |
| `WebFetch`                      | `web_fetch`                                                                                                                                       |
| `Task` tool (dispatch subagent) | Invoke the subagent by its published tool/name entry point (for example `codebase_investigator`, `cli_help`, `generalist_agent`, `browser_agent`) |

## Subagent support

Gemini CLI supports subagents exposed as tool/name entry points. When a skill expects Claude Code's `Task` tool, dispatch the Gemini subagent that matches the requested capability instead of assuming single-session fallback.

## Additional Gemini CLI tools

These tools are available in Gemini CLI but have no Claude Code equivalent:

| Tool                                 | Purpose                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| `list_directory`                     | List files and subdirectories                           |
| `save_memory`                        | Persist facts to GEMINI.md across sessions              |
| `ask_user`                           | Request structured input from the user                  |
| `tracker_create_task`                | Rich task management (create, update, list, visualize)  |
| `enter_plan_mode` / `exit_plan_mode` | Switch to read-only research mode before making changes |
