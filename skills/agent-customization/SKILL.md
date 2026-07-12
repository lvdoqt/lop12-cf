---
name: agent-customization
version: 1.0.0
summary: Guidance for creating a reusable SKILL.md that captures conversation-driven workflows and agent-customization patterns.
tags:
  - agent
  - customization
  - workflow
---

## Purpose

This skill helps capture a multi-step workflow or methodology observed during a conversation and turn it into a reusable `SKILL.md` file for agent-customization. It standardizes how to extract step-by-step processes, decision points, quality checks, and example prompts so the skill can be used repeatedly.

## Scope

- Intended as a workspace-scoped skill (store under `skills/agent-customization/SKILL.md`).
- Lightweight enough to be adapted for personal use if desired.

## When to Use

- A conversation has produced a repeatable process or checklist.
- You want to codify a stepwise developer workflow, review checklist, or editorial process for future automation.

## Inputs

- Conversation history or a short description of the workflow to capture.
- Desired scope: `workspace` or `personal`.

## Outputs

- A `SKILL.md` file containing:
  - a clear description of the workflow,
  - step-by-step instructions,
  - decision points and branching logic,
  - quality criteria / completion checks,
  - example prompts and usage notes,
  - clarifying questions for ambiguous parts.

## Step-by-step process

1. Identify the workflow boundaries: inputs, outputs, and who performs each step.
2. Extract explicit steps in order; name each step concisely.
3. Note decision points and the conditions that select different branches.
4. Specify quality criteria and completion checks for each step.
5. Draft short example prompts that invoke the skill in realistic contexts.
6. Save the draft `SKILL.md` to the workspace under a logical path.
7. Ask clarifying questions for ambiguous steps or missing details.
8. Iterate until criteria and examples are clear.

## Decision points (examples)

- If the workflow requires external access (repo files, CI), note the permission/credential needs.
- If steps can be parallelized, indicate which are independent vs. sequential.
- If outputs require verification (tests, lints), list the minimal checks and acceptance thresholds.

## Quality criteria / Completion checks

- Each step has a measurable outcome (file created, test passing, checklist item).
- Branches include explicit guard conditions.
- Examples run end-to-end without missing inputs.
- Minimal reproducibility: another agent or developer can follow the skill without extra context.

## Example prompts to try

- "Create a SKILL.md that captures our code-review checklist and saves it to `skills/code-review/SKILL.md`."
- "Draft a workspace-scoped skill that automates adding a new README section for each microservice."

## Clarifying questions (template)

- What is the intended scope: `workspace` or `personal`?
- Who must be able to run this skill (human + agent, agent-only)?
- Are there required files, directories, or CI checks the skill should interact with?
- Any hard constraints or non-goals (e.g., don’t modify production configs)?

## Iteration guidance

- Save an initial minimal draft and run a quick sanity check by asking the agent to follow the skill for a small example.
- Triage unclear steps into specific clarifying questions and update the skill.
- Keep the skill focused — prefer small, composable skills rather than large monoliths.

## Related customizations

- Create small helper prompts for common subroutines (e.g., "extract steps", "summarize decision points").
- Add example test cases or canned inputs under `skills/<name>/examples/`.

## Maintenance notes

- Version the skill and include a brief changelog at the top when making non-trivial edits.
- Keep examples up-to-date with changing repository layout or CI requirements.

---
Produced by agent on behalf of the user. Review and adapt to your repository conventions.
