import express from "express";

import { prisma } from "./db.js";
import {
  CategoryStoreUnavailableError,
  listCategories,
} from "./services/category-service.js";

export const app = express();

app.disable("x-powered-by");
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "TokTickIT API" });
});

app.get("/api/categories", async (_request, response) => {
  try {
    response.json(await listCategories(prisma));
  } catch (error) {
    if (error instanceof CategoryStoreUnavailableError) {
      response.status(503).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    response.status(500).json({
      error: {
        code: "CATEGORY_LIST_FAILED",
        message: "Unable to load categories",
      },
    });
  }
});

app.get("/", (_request, response) => {
  response.json({ service: "TokTickIT API" });
});
