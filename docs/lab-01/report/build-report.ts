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
    "docs/lab-01/toktickit-lab1-report.tex",
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
