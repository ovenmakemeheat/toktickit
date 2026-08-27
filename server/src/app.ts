import express, { type Response } from "express";

import { prisma } from "./db.js";
import {
  listCategories,
  listDevelopmentRequesters,
  listRelatedSystems,
  ReferenceDataStoreUnavailableError,
} from "./services/reference-data-service.js";
import {
  CategoryNotFoundError,
  IdempotencyKeyReusedError,
  RelatedSystemNotFoundError,
  createTicket,
} from "./services/ticket-service.js";
import {
  RequesterContextInvalidError,
  RequesterContextRequiredError,
} from "./services/requester-context-service.js";
import { TicketInputValidationError } from "./services/ticket-validation-service.js";

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

function sendTicketCreateError(response: Response, error: unknown) {
  if (
    error instanceof RequesterContextRequiredError ||
    error instanceof RequesterContextInvalidError
  ) {
    response.status(400).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (error instanceof TicketInputValidationError) {
    response.status(400).json({
      error: {
        code: error.code,
        message: error.message,
        fields: error.fields,
      },
    });
    return;
  }

  if (
    error instanceof CategoryNotFoundError ||
    error instanceof RelatedSystemNotFoundError
  ) {
    response.status(404).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (error instanceof IdempotencyKeyReusedError) {
    response.status(409).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  response.status(500).json({
    error: {
      code: "TICKET_CREATE_FAILED",
      message: "Unable to create ticket",
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

app.post("/api/tickets", async (request, response) => {
  try {
    const result = await createTicket(
      prisma,
      request.get("X-Development-Requester-Id"),
      request.body,
    );
    response.status(result.replayed ? 200 : 201).json(result.ticket);
  } catch (error) {
    sendTicketCreateError(response, error);
  }
});

app.get("/", (_request, response) => {
  response.json({ service: "TokTickIT API" });
});
