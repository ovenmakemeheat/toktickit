import express, { type Response } from "express";

import { prisma } from "./db.js";
import {
  listCategories,
  listDevelopmentRequesters,
  listRelatedSystems,
  ReferenceDataStoreUnavailableError,
} from "./services/reference-data-service.js";

function sendReferenceDataError(response: Response, error: unknown) {
  if (error instanceof ReferenceDataStoreUnavailableError) {
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
      code: "REFERENCE_DATA_FAILED",
      message: "Unable to load reference data",
    },
  });
}

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
    sendReferenceDataError(response, error);
  }
});

app.get("/api/related-systems", async (_request, response) => {
  try {
    response.json(await listRelatedSystems(prisma));
  } catch (error) {
    sendReferenceDataError(response, error);
  }
});

app.get("/api/development-requesters", async (_request, response) => {
  try {
    response.json(await listDevelopmentRequesters(prisma));
  } catch (error) {
    sendReferenceDataError(response, error);
  }
});

app.get("/", (_request, response) => {
  response.json({ service: "TokTickIT API" });
});
