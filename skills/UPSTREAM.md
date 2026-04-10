This directory vendors the upstream Superpowers skills tree.

CMSNext keeps this tree repo-local because plugin-based Superpowers discovery has been unreliable in practice. Repository instructions and startup hooks intentionally reference files in this directory directly so required workflow guidance remains available even when the installed plugin does not surface the expected skills consistently.

Source repository: https://github.com/obra/superpowers
Source commit: 917e5f53b16b115b70a3a355ed5f4993b9f8b73d
Imported on: 2026-04-07

Notes:

- The full upstream skills directory was copied so supporting prompt/reference files remain intact.
- Upstream license text is preserved in this directory at UPSTREAM-LICENSE.
- This vendored tree is a reliability fallback and repo-local source for explicit skill-path loading; `.github/skills/` remains the workspace-native location for CMSNext-owned skills.
