# ADR 0028: Build a compact, visually verified LaTeX report

- Status: Accepted
- Date: 2026-08-04

## Context

The Lab 1 submission must be one concise PDF, but it also needs enough evidence to be gradeable. A source file can compile successfully while still producing clipped screenshots, orphaned headings, awkward page breaks, or large accidental blank areas.

## Decision

Structure the report as:

1. compact title page;
2. table of contents;
3. Answer Part 1: Git workflow;
4. Answer Part 2: tests;
5. Answer Part 3: AI use and reflection;
6. Answer Part 4: app demo.

Use representative evidence slices: show the smallest set of screenshots, outputs, and links that proves each requirement. Keep intentional whitespace for readability, but avoid decorative padding, duplicated instructions, orphan headings, and unnecessary appendices.

Use a human-in-the-loop PDF QA cycle after every meaningful report update:

1. compile with XeLaTeX through `latexmk`;
2. inspect page count and compilation warnings;
3. render every final page to images;
4. visually check that text, screenshots, captions, tables, headers, and page breaks stay within the page;
5. check for clipping, overflow, overlap, accidental blank space/pages, unreadable evidence, and poor evidence slicing;
6. revise and repeat until the rendered PDF is clean.

## Consequences

- The final artifact is compact without sacrificing proof.
- Visual correctness is treated as a tested property, not assumed from a successful build.
- The final report should be delivered only after the rendered pages pass human inspection.
