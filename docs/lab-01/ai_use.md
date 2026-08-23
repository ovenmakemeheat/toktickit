# Lab 1 AI-use reflection

This record describes the actual AI-assisted workflow used for this repository.

## Tool and model

- Tool: OpenAI Codex coding agent in ChatGPT
- Model: GPT-5
- Supporting tools: GitHub connector, browser-use CLI, Bun, XeLaTeX, and Poppler

## Selected prompts

The following prompts are representative excerpts from the actual conversation.

| Prompt | What changed |
| --- | --- |
| `read @docs/requirements, $grill-with-docs` | Loaded the requirements and used the grilling workflow to identify scope and risks. |
| `now follow the plan, first create the issues` | Converted the requirements into the Lab 1 issue structure. |
| `all subissues should be inside the main 4 issues` | Kept exactly four parent issues and attached implementation work as native sub-issues. |
| `please keep insturction in AGENTS.md strictly about don't close any PR or main issue you can only do check the checklists or closing subissue, closing main issue / PR close is human job` | Established the human-only rules for pull-request and main-issue state changes. |
| `add biome, left-hook, prisma validation on git sub-issues of issue 1` | Added the requested quality gates and connected them to the foundation work. |
| `yes, and pdf should be built in latex` | Chose a reproducible XeLaTeX report source and PDF build command. |
| `do capture those for me from http://localhost:5173/` | Defined the required loading, success, and failure evidence for the running app. |
| `do use browseruse cli` | Used browser-use CLI to verify the visible UI states and save the captures. |
| `this is student - reviewer details Student ... also checkout all pr and review records; update reviewer part` | Audited PRs #44-#47 and recorded the student, peer, review comments, responses, and unresolved automated threads. |

## Reflection

The prompts became more useful as they added concrete constraints: Bun, the server-owned database stack, four parent issues, native sub-issues, acceptance criteria, and human-only pull-request state changes. Those constraints kept the implementation aligned with Lab 1 instead of expanding into later features.

The AI-assisted workflow still required human-in-the-loop checks. The browser capture was inspected visually; an initial loading attempt was detected as a completed success state and recaptured correctly. The final PDF was rendered page by page and checked for readable evidence, clipping, overlap, and excessive empty space. GitHub review records were also checked directly so positive peer comments were not mislabeled as formal approvals, and unresolved automated threads were preserved rather than reported as fixed.
