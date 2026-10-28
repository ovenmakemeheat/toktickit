import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "../src/env.js";

function databaseIdentity(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return {
    hostname: ["localhost", "127.0.0.1", "::1"].includes(hostname)
      ? "loopback"
      : hostname,
    port: url.port || "5432",
    database: decodeURIComponent(url.pathname.slice(1)),
  };
}

const developmentDatabase = databaseIdentity(env.DATABASE_URL);
const testDatabase = databaseIdentity(env.TEST_DATABASE_URL);
if (!testDatabase.database.endsWith("_test")) {
  throw new Error(
    "TEST_DATABASE_URL must name a database ending in _test; refusing to reset another database.",
  );
}
if (
  developmentDatabase.hostname === testDatabase.hostname &&
  developmentDatabase.port === testDatabase.port &&
  developmentDatabase.database === testDatabase.database
) {
  throw new Error(
    "DATABASE_URL and TEST_DATABASE_URL must refer to different databases; refusing to reset the development database.",
  );
}

const binDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../node_modules/.bin",
);
const prismaCommand = resolve(
  binDirectory,
  process.platform === "win32" ? "prisma.exe" : "prisma",
);
const runtimePasswordSuffix = String.fromCharCode(65, 49, 33);
const lab3SeedPassword =
  process.env.LAB3_TEST_PASSWORD ||
  process.env.LAB3_SEED_PASSWORD ||
  `${randomBytes(24).toString("base64url")}${runtimePasswordSuffix}`;
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
