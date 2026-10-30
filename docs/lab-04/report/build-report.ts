import { mkdir } from "node:fs/promises";

await mkdir("output/pdf", { recursive: true });

const latexProcess = Bun.spawn(
  [
    "latexmk",
    "-g",
    "-xelatex",
    "-interaction=nonstopmode",
    "-halt-on-error",
    "-outdir=output/pdf",
    "docs/lab-04/report/toktickit-lab4-report.tex",
  ],
  {
    stderr: "inherit",
    stdout: "inherit",
  },
);

const exitCode = await latexProcess.exited;
if (exitCode !== 0) {
  process.exit(exitCode);
}
