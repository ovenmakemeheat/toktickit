# Lab 4 reviewer record

Status: updated 2026-10-22. Feature PRs #91–#93 have been merged into `lab4-staging` by reviewer MadMax168 after human comments and readiness replies. No formal GitHub `APPROVED` review is recorded for those PRs; this ledger does not equate comments, automated review, or merge state with formal approval. Issue #90 has no PR yet, and the release integration to `main` remains pending.

Scope: Issues #86–#90, their feature Pull Requests into `lab4-staging`, and the separately reviewed release integration to `main`.

- Student/author: `GUNTEE DOUNGMANEE` (`ovenmakemeheat`)
- Student ID: `67070501003`
- Record opened: 2026-09-27; updated: 2026-10-22

## Review and merge rules

- Every feature Pull Request links its corresponding issue and targets `lab4-staging`.
- The feature Pull Request author answers every human review comment, either recording the fix or explaining why a request is not adopted.
- After review, the reviewer—not the feature PR author—performs the merge into `lab4-staging`.
- The release integration to `main` is reviewed separately; a human reviewer performs the merge.
- Record formal GitHub review state accurately. A comment, automated review, or passing CI is not a formal approval unless GitHub records it as such.
- Do not mark an issue Done until its acceptance criteria, tests, peer review, and required integration/release merge are complete.
- Never infer review identity, approval, response, or merge from an open PR, an automated result, or a branch name.

## Feature Pull Request ledger

| Issue | Feature branch | Pull Request | Human reviewer / formal review state | Comments and author responses | Merge evidence |
| --- | --- | --- | --- | --- | --- |
| #87 Contract and test plan | `feature/20-lab4-contract-test-plan` | [PR #91](https://github.com/ovenmakemeheat/toktickit/pull/91) → `lab4-staging` | MadMax168 reviewed via comments; no formal `APPROVED` review is recorded. The contract's formal review status remains pending. | [Human review comment](https://github.com/ovenmakemeheat/toktickit/pull/91#issuecomment-6017639317); author [consolidated response](https://github.com/ovenmakemeheat/toktickit/pull/91#issuecomment-6019690579) and replies to all four inline threads; reviewer [“nice, MERGE!!”](https://github.com/ovenmakemeheat/toktickit/pull/91#issuecomment-6052380896). | Merged by MadMax168 at [`c945062c41b2fa85b8f279cc7cc852e07a5aa8fb`](https://github.com/ovenmakemeheat/toktickit/commit/c945062c41b2fa85b8f279cc7cc852e07a5aa8fb). |
| #88 Actions Taken and Ticket workflow | `feature/21-lab4-actions-taken-ticket-workflow` | [PR #92](https://github.com/ovenmakemeheat/toktickit/pull/92) → `lab4-staging` | MadMax168 commented ready to merge; no formal GitHub review is recorded. Automated Codex review is not peer approval. | [Reviewer readiness comment](https://github.com/ovenmakemeheat/toktickit/pull/92#issuecomment-6098930825). No unaddressed human review request is recorded in the issue-comment evidence. | Merged by MadMax168 at [`8608a312d298ecfd480ea67b0fe9ffd5ccf5db5f`](https://github.com/ovenmakemeheat/toktickit/commit/8608a312d298ecfd480ea67b0fe9ffd5ccf5db5f). |
| #89 Role dashboards | `feature/22-lab4-role-dashboards` | [PR #93](https://github.com/ovenmakemeheat/toktickit/pull/93) → `lab4-staging` | MadMax168 reviewed via comments and said ready to merge; no formal `APPROVED` review is recorded. | Author replied to [human feedback](https://github.com/ovenmakemeheat/toktickit/pull/93#issuecomment-6335063616); reviewer [confirmed readiness](https://github.com/ovenmakemeheat/toktickit/pull/93#issuecomment-6342480985). | Merged by MadMax168 at [`47d6487b638939835403ea0da7c0e3f011078b7b`](https://github.com/ovenmakemeheat/toktickit/commit/47d6487b638939835403ea0da7c0e3f011078b7b). |
| #90 Regression and demo readiness | `feature/23-lab4-regression-demo-readiness` | Pending | Pending; this branch has not yet been submitted for peer review. | Pending. | Pending. |

## Contract review record — Issue #87

- Contract documents: `specification.md`, `api-spec.md`, `ui-spec.md`, and `tests.md`.
- Human reviewer/commenter: MadMax168.
- Review comment and author response are linked above. The reviewer invited merge, and merged PR #91 into `lab4-staging`.
- Formal GitHub `APPROVED` review: not recorded. Keep the contract's formal approval state pending rather than inferring approval from the comment or merge.
- No feature implementation or automated result substitutes for the human's responsibility to verify the contract against the complete Lab 4 handout and parent issue #86.

## Release Pull Request ledger

| Source | Target | Pull Request | Human reviewer / formal review | Responses | Merger and merge evidence |
| --- | --- | --- | --- | --- | --- |
| `lab4-staging` | `main` | Pending | Pending | Pending | Pending |

## Closeout requirements

Update this file from actual GitHub Pull Request/review/merge records. Add exact PR links, reviewer identity, formal review state, comment/response evidence, and merge commit only after those events occur. Keep open or pending work visibly pending; do not fabricate Lab 4 completion evidence.
