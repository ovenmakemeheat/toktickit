import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const binDirectory = resolve(serverRoot, "node_modules", ".bin");
const prismaCommand = resolve(
  binDirectory,
  process.platform === "win32" ? "prisma.exe" : "prisma",
);
const tsxCommand = resolve(
  binDirectory,
  process.platform === "win32" ? "tsx.exe" : "tsx",
);
const mode = process.argv[2];
if (mode !== "dev" && mode !== "deploy") {
  throw new Error("Usage: bun run db:migrate[+:deploy]");
}

const handoffPath =
  process.env.LAB3_MIGRATION_HANDOFF_PATH || ".local/lab3-credentials.json";
const environment = { ...process.env };

function run(command: string, args: string[]) {
  return new Promise<void>((resolveProcess, reject) => {
    const child = spawn(command, args, {
      cwd: serverRoot,
      env: environment,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolveProcess();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} exited with ${
            code === null ? `signal ${signal ?? "unknown"}` : `code ${code}`
          }`,
        ),
      );
    });
  });
}

await run(prismaCommand, ["migrate", mode, ...process.argv.slice(3)]);
await run(tsxCommand, ["scripts/migrate-lab3.ts", "--handoff", handoffPath]);
