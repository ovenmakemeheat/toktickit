import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "../src/env.js";

const binDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../node_modules/.bin",
);
const prismaCommand = resolve(
  binDirectory,
  process.platform === "win32" ? "prisma.exe" : "prisma",
);
const lab3SeedPassword =
  process.env.LAB3_TEST_PASSWORD ||
  process.env.LAB3_SEED_PASSWORD ||
  `TestSeed${randomBytes(24).toString("base64url")}A1!`;
const prismaEnvironment = {
  ...process.env,
  DATABASE_URL: env.TEST_DATABASE_URL,
  LAB3_SEED_PASSWORD: lab3SeedPassword,
};

function runPrisma(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(prismaCommand, args, {
      env: prismaEnvironment,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Prisma ${args.join(" ")} exited with code ${code ?? "unknown"}`,
        ),
      );
    });
  });
}

await runPrisma(["migrate", "reset", "--force", "--skip-seed"]);
await runPrisma(["db", "seed"]);
