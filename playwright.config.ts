import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig } from "@playwright/test";

const serverEnvPath = resolve(__dirname, "server/.env");
const inheritedDatabaseUrl = process.env.DATABASE_URL;
if (inheritedDatabaseUrl !== undefined) {
  delete process.env.DATABASE_URL;
}
if (existsSync(serverEnvPath)) {
  process.loadEnvFile(serverEnvPath);
}
const configuredDevelopmentDatabaseUrl = process.env.DATABASE_URL;
if (inheritedDatabaseUrl !== undefined) {
  process.env.DATABASE_URL = inheritedDatabaseUrl;
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL must be configured in server/.env before running Playwright.",
  );
}

const testDatabase = new URL(testDatabaseUrl);
const testDatabaseName = decodeURIComponent(testDatabase.pathname.slice(1));
if (!testDatabaseName.endsWith("_test")) {
  throw new Error(
    "Playwright requires a database whose name ends in _test; refusing to run against a development database.",
  );
}

function sameDatabase(left: string, right: URL) {
  const candidate = new URL(left);
  const normalizeHost = (hostname: string) => {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return ["localhost", "127.0.0.1", "::1"].includes(host) ? "loopback" : host;
  };
  return (
    normalizeHost(candidate.hostname) === normalizeHost(right.hostname) &&
    (candidate.port || "5432") === (right.port || "5432") &&
    decodeURIComponent(candidate.pathname.slice(1)) ===
      decodeURIComponent(right.pathname.slice(1))
  );
}

const developmentDatabaseUrls = [
  configuredDevelopmentDatabaseUrl,
  inheritedDatabaseUrl && !sameDatabase(inheritedDatabaseUrl, testDatabase)
    ? inheritedDatabaseUrl
    : undefined,
].filter((url): url is string => Boolean(url));
if (developmentDatabaseUrls.some((url) => sameDatabase(url, testDatabase))) {
  throw new Error(
    "DATABASE_URL and TEST_DATABASE_URL must refer to different databases before running Playwright.",
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
const attachmentStorageDirectory = resolve(
  __dirname,
  "server/.local-storage/e2e",
);
process.env.ATTACHMENT_STORAGE_DIR = attachmentStorageDirectory;

function configuredPort(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be a valid TCP port.`);
  }
  return value;
}

const apiPort = configuredPort("E2E_API_PORT", 3001);
const uiPort = configuredPort("E2E_UI_PORT", 5174);
if (apiPort === uiPort) {
  throw new Error("E2E_API_PORT and E2E_UI_PORT must be different ports.");
}

const apiOrigin = `http://127.0.0.1:${apiPort}`;
const uiOrigin = `http://127.0.0.1:${uiPort}`;
const clientEnvironment = {
  VITE_PORT: String(uiPort),
  API_PROXY_TARGET: apiOrigin,
};
const serverEnvironment = {
  PORT: String(apiPort),
  DATABASE_URL: testDatabaseUrl,
  APP_ORIGIN: uiOrigin,
  ATTACHMENT_STORAGE_DIR: attachmentStorageDirectory,
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  use: {
    baseURL: uiOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "bun run dev:server",
      url: `${apiOrigin}/api/health`,
      env: serverEnvironment,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "bun run dev:client",
      url: uiOrigin,
      env: clientEnvironment,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
