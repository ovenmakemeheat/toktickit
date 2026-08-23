import { config } from "dotenv";
import { fileURLToPath } from "node:url";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const fallbackTestDatabaseUrl =
  "postgresql://toktickit:toktickit@localhost:5432/toktickit_test?schema=public";
process.env.TEST_DATABASE_URL ??= fallbackTestDatabaseUrl;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.PORT = "3001";
