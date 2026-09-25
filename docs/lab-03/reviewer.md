# Lab 3 reviewer record

Scope: Issues #72-#77 and the Lab 3 feature Pull Requests that integrate into
`lab3-staging`.

Target branch for feature work: `lab3-staging`

Student: `GUNTEE DOUNGMANEE`

Student ID: `67070501003`

Student GitHub: [`ovenmakemeheat`](https://github.com/ovenmakemeheat)

Peer reviewer: `POLWARIT WATTHANAHEMMARAT` (`MadMax168`)

Peer reviewer ID: `67070501067`

Peer reviewer GitHub: [`MadMax168`](https://github.com/MadMax168)

Human reviewer account: `MadMax168`

Record date: 2026-09-25 (post-release closeout)

This record distinguishes human review comments from automated review output.
A positive human comment is recorded as review evidence, but it is not relabeled
as a formal GitHub `APPROVED` review when GitHub reports `COMMENTED` or an empty
review decision.

## Integrated feature PR index

| Issue | Feature branch | Pull Request | Merge evidence |
| --- | --- | --- | --- |
| #72 | `feature/14-sprint-specification` | [PR #78](https://github.com/ovenmakemeheat/toktickit/pull/78) | Merged into `lab3-staging` by `MadMax168` on 2026-09-13. |
| #73 | `feature/15-authentication-and-requester` | [PR #79](https://github.com/ovenmakemeheat/toktickit/pull/79) | Merged into `lab3-staging` by `MadMax168` on 2026-09-15. |
| #74 | `feature/16-it-staff-ticket-workflow` | [PR #80](https://github.com/ovenmakemeheat/toktickit/pull/80) | Merged into `lab3-staging` by `MadMax168` on 2026-09-17. |
| #75 | `feature/17-administrator-user-management` | [PR #81](https://github.com/ovenmakemeheat/toktickit/pull/81) | Merged into `lab3-staging` by `MadMax168` on 2026-09-18. |
| #76 | `feature/18-zen-green-visual-inspection` | [PR #82](https://github.com/ovenmakemeheat/toktickit/pull/82) | Merged into `lab3-staging` by `MadMax168` on 2026-09-18. |
| #77 | `feature/19-e2e-evidence-release` | [PR #83](https://github.com/ovenmakemeheat/toktickit/pull/83) | Merged into `lab3-staging` by `MadMax168` on 2026-09-19; merge commit `d345420`. |

At the start of Issue #77 work, `lab3-staging` and the feature branch were at
`4cb1049` (`Merge pull request #82`). The separate release PR [#84](https://github.com/ovenmakemeheat/toktickit/pull/84)
merged `lab3-staging` into `main` by `MadMax168` on 2026-09-23. The resulting
main commit is `eddafe67d6fd8d742b98d4673a731b25540cc57d`; its Git tree is
identical to the verified staging tree at `d345420`.

## Human review comments and responses

| Pull Request | Human reviewer comment or decision | Author response / resulting change | State |
| --- | --- | --- | --- |
| [#78](https://github.com/ovenmakemeheat/toktickit/pull/78) | `MadMax168` requested consistency for Administrator IT Priority access, Administrator Ticket Review scope, migration password handoff, and the final evidence records. | The author replied with commit `fc60143`; the specification/API/UI/test contracts were aligned, the handoff workflow was documented, and the final `reviewer.md`/`ai-use.md` ownership was recorded for Issue #77. | Addressed and merged. |
| [#79](https://github.com/ovenmakemeheat/toktickit/pull/79) | `MadMax168` requested database-enforced requester ownership, repeat-safe migration with the same handoff path, and preservation of Lab 2 E2E tests. GitGuardian also reported password-like test literals. | The author replied with `b288ea1`: normal migration/deploy now runs the ownership migration, existing handoffs are reused, Lab 2 E2E coverage was restored, and runtime/configured test credentials replaced committed password-like literals. | Addressed and merged. |
| [#80](https://github.com/ovenmakemeheat/toktickit/pull/80) | `MadMax168` requested pagination preservation, complete owner options, stale-request loading protection, and typed concurrent status conflicts. | The author replied with `4e16ee0`; queue pagination and request guards were corrected, eligible owners are returned separately, and concurrent status updates return `409 TICKET_STATUS_CONFLICT` with refresh feedback. | Addressed and merged. |
| [#81](https://github.com/ovenmakemeheat/toktickit/pull/81) | `MadMax168` requested a mobile User Management representation, serialized last-Administrator protection, and coordination between deactivation and Ticket assignment. | The author replied with `7fe6fe3`; mobile cards and edit actions were added, PostgreSQL transaction safeguards serialize the account/assignment checks, and concurrent regressions were added. | Addressed and merged. |
| [#82](https://github.com/ovenmakemeheat/toktickit/pull/82) | `MadMax168` requested browser-level responsive/accessibility assertions and missing Requester screenshots at all required viewports. | The author replied with `d3db36c`; `e2e/lab-03/responsive-and-accessibility.spec.ts` and the nine Requester captures were added, the checklist was updated, and the verification gate was rerun. | Addressed and merged. |
| [#83](https://github.com/ovenmakemeheat/toktickit/pull/83) | `MadMax168` requested real seeded API coverage instead of mocked business routes, an immutable tested revision, stable report links, and exact labsheet alignment for Answer Parts 6–8. | The author added an unmocked seeded release regression, recorded verification at `32fc2b7`, split the report into Working IT Staff Ticket Queue, Working IT Staff Ticket Detail, and Working Administrator User Management sections, and prepared immutable evidence links. | Addressed; merged by `MadMax168` into `lab3-staging` on 2026-09-19. |

## Release PR and merge record

| Pull Request | Human reviewer / merger evidence | Recorded GitHub review state |
| --- | --- | --- |
| [#84](https://github.com/ovenmakemeheat/toktickit/pull/84) | `MadMax168` merged the `lab3-staging` to `main` release on 2026-09-23; merge commit `eddafe67d6fd8d742b98d4673a731b25540cc57d`. | `MERGED`; the API returned an empty formal `reviewDecision` and no formal `APPROVED` review. The automated GitGuardian comment is not peer approval. |

## Review and merge boundaries

- All feature PRs #78-#83 targeted `lab3-staging` and linked their
  corresponding Lab 3 Issues. Their merger was `MadMax168`, not the feature PR
  author.
- PR #84 is the separate release integration to `main`; its merge actor is
  `MadMax168`. This record distinguishes that human merge from a formal GitHub
  `APPROVED` review, which was not returned by the API.
- Automated Codex review comments and GitGuardian alerts are retained as audit
  history and are not counted as peer approval.
- The retrieved formal review states for PRs #78-#84 are `COMMENTED` or empty;
  this record does not infer `APPROVED` from a “ready to merge” or “look good”
  comment.
- GitHub reports Issues #72-#77 closed at closeout. Issue #77's closure was
  recorded on 2026-09-21; PR #84 merged later on 2026-09-23. No issue state was
  changed during this documentation closeout.
- The public [TokTickIT Lab 3 Project board](https://github.com/users/ovenmakemeheat/projects/3/views/1)
  was inspected read-only on 2026-09-25. Its six Lab 3 Issues (#72-#77) all
  display `Done`; no board fields were changed during this documentation work.
  The Kanban screenshot is retained at `docs/lab-03/report/evidence/lab3-project-board-kanban.png`.
