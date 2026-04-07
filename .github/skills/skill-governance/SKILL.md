---
name: skill-governance
description: "Centralize CMSNext skill selection. Use when deciding which skill must cover the next action, tool batch, phase change, review step, delegation step, or closeout step."
argument-hint: "Describe the current action or phase, such as startup, review response, delegation, implementation, debugging, testing, or closeout."
---

# CMSNext Skill Governance

Use this skill to choose the correct skill coverage for the next CMSNext action. Load it immediately after `repo-memories`, and use it again whenever the task changes phase.

## Purpose

- Centralize the allowed skill-selection process for CMSNext work.
- Assume the Obra Superpowers plugin is the intended source of advanced workflow skills for this repository.
- Keep every action or tool batch grounded in an explicit skill decision.
- Reduce duplicated selection rules across repo instructions.

## When To Use

- Immediately after loading `repo-memories` at task start.
- Before any new action category: exploration, planning, implementation, debugging, review, testing, delegation, documentation, or closeout.
- When the current skill coverage is unclear or may have become stale.

## Environment Assumption

- CMSNext assumes Obra Superpowers has been installed for the user environment.
- Expected install flow:
  - `copilot plugin marketplace add obra/superpowers-marketplace`
  - `copilot plugin install superpowers@superpowers-marketplace`
- If an Obra Superpowers skill that should exist for the current action is missing, treat that as an environment/setup problem rather than a reason to silently skip skill coverage.

## Selection Order

1. Load `repo-memories` first for every CMSNext task.
2. Load `skill-governance` to classify the next action.
3. Prefer the matching Obra Superpowers skill when the action maps to one.
4. If a more specific skill clearly applies, load it before taking the action.
5. If no more specific skill exists for the action, proceed explicitly under `repo-memories` as the baseline skill.
6. When the task changes phase, repeat this decision instead of assuming the previous skill still applies.

## Action Map

- Repo startup and baseline repo workflow: `repo-memories`
- Choosing between agents, skills, instructions, or delegation prompts: `agent-delegation`
- Editing agent customization files, instructions, prompts, skills, or agents: `agent-customization`
- Addressing pull request review comments: `address-pr-comments`
- Summarizing a GitHub issue, pull request, or notification: `summarize-github-issue-pr-notification`
- Suggesting a fix for a GitHub issue: `suggest-fix-issue`
- Forming a GitHub issue or PR search query: `form-github-search-query`
- Presenting GitHub search results: `show-github-search-result`
- Ambiguous multi-stage implementation planning: Obra Superpowers `writing-plans`, `brainstorming`, or `subagent-driven-development`
- Bug investigation: Obra Superpowers `systematic-debugging`
- Behavior-changing implementation: Obra Superpowers `test-driven-development`
- Final verification or pre-closeout checks: Obra Superpowers `verification-before-completion`

## Operating Rules

- Do not treat skill loading as a one-time startup ritual; it must match the current action.
- Do not keep using a broad baseline skill when a more specific skill clearly applies.
- Do not invent a parallel workflow when the expected Obra Superpowers skill exists for the action.
- If no specific skill exists for the action, state that the action is proceeding under `repo-memories`.
- Do not treat an uninstalled Obra Superpowers setup as evidence that the skill workflow is optional.

## Closeout Rule

- If CMSNext skill-selection policy changes, update this skill first and then simplify any duplicated repo instructions that reference it.
