import "dotenv/config";

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    TEST_DATABASE_URL: z.string().url(),
    PORT: z.coerce.number().int().positive().default(3000),
    LAB3_SEED_PASSWORD: z.string().min(12).max(128).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
