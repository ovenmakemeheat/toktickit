import express, { type Response } from "express";
import multer, { MulterError } from "multer";

import { prisma } from "./db.js";
import {
  listCategories,
  listDevelopmentRequesters,
  listRelatedSystems,
  ReferenceDataStoreUnavailableError,
} from "./services/reference-data-service.js";
import {
  ActiveAttachmentLimitReachedError,
  AttachmentAlreadyRemovedError,
  AttachmentFileRequiredError,
  AttachmentNotFoundError,
  AttachmentRemovedError,
  AttachmentUploadFailedError,
  downloadTicketAttachment,
  listTicketAttachments,
  removeTicketAttachment,
  requireOwnedTicket,
  uploadTicketAttachment,
} from "./services/attachment-service.js";
import {
  attachmentMaxSizeBytes,
  AttachmentTooLargeError,
  AttachmentTypeNotAllowedError,
  AttachmentUploadInvalidError,
  RemovalReasonInvalidError,
} from "./services/attachment-policy-service.js";
import { AttachmentStorageUnavailableError } from "./services/attachment-storage-service.js";
import {
  CategoryNotFoundError,
  IdempotencyKeyReusedError,
  RelatedSystemNotFoundError,
  createTicket,
  getTicketDetail,
  TicketIdValidationError,
  TicketNotFoundError,
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

function sendTicketDetailError(response: Response, error: unknown) {
  if (
    error instanceof RequesterContextRequiredError ||
    error instanceof RequesterContextInvalidError ||
    error instanceof TicketIdValidationError
  ) {
    response.status(400).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (error instanceof TicketNotFoundError) {
    response.status(404).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  response.status(500).json({
    error: {
      code: "TICKET_DETAIL_FAILED",
      message: "Unable to load ticket detail",
    },
  });
}

function sendAttachmentUploadError(response: Response, error: unknown) {
  if (
    error instanceof RequesterContextRequiredError ||
    error instanceof RequesterContextInvalidError ||
    error instanceof TicketIdValidationError ||
    error instanceof AttachmentFileRequiredError ||
    error instanceof AttachmentUploadInvalidError
  ) {
    response.status(400).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (error instanceof MulterError) {
    response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error: {
        code:
          error.code === "LIMIT_FILE_SIZE"
            ? "ATTACHMENT_TOO_LARGE"
            : "ATTACHMENT_UPLOAD_INVALID",
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "ATTACHMENT_TOO_LARGE"
            : "ATTACHMENT_UPLOAD_INVALID",
      },
    });
    return;
  }

  if (error instanceof TicketNotFoundError) {
    response.status(404).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (error instanceof AttachmentTooLargeError) {
    response.status(413).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (error instanceof AttachmentTypeNotAllowedError) {
    response.status(415).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (error instanceof ActiveAttachmentLimitReachedError) {
    response.status(409).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (error instanceof AttachmentStorageUnavailableError) {
    response.status(503).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  response.status(500).json({
    error: {
      code:
        error instanceof AttachmentUploadFailedError
          ? error.code
          : "ATTACHMENT_UPLOAD_FAILED",
      message: "Unable to upload attachment",
    },
  });
}

function sendAttachmentReadError(
  response: Response,
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string,
) {
  if (
    error instanceof RequesterContextRequiredError ||
    error instanceof RequesterContextInvalidError ||
    error instanceof TicketIdValidationError
  ) {
    response.status(400).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (
    error instanceof TicketNotFoundError ||
    error instanceof AttachmentNotFoundError
  ) {
    response.status(404).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (error instanceof AttachmentRemovedError) {
    response.status(410).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (error instanceof AttachmentStorageUnavailableError) {
    response.status(503).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  response.status(500).json({
    error: { code: fallbackCode, message: fallbackMessage },
  });
}

function sendAttachmentRemoveError(response: Response, error: unknown) {
  if (
    error instanceof RequesterContextRequiredError ||
    error instanceof RequesterContextInvalidError ||
    error instanceof TicketIdValidationError ||
    error instanceof RemovalReasonInvalidError
  ) {
    response.status(400).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (
    error instanceof TicketNotFoundError ||
    error instanceof AttachmentNotFoundError
  ) {
    response.status(404).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  if (error instanceof AttachmentAlreadyRemovedError) {
    response.status(409).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  response.status(500).json({
    error: {
      code: "ATTACHMENT_REMOVE_FAILED",
      message: "Unable to remove attachment",
    },
  });
}

export const app = express();

app.disable("x-powered-by");
app.use(express.json());

const parseSingleAttachment = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: attachmentMaxSizeBytes },
}).single("file");

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

app.get("/api/tickets/:ticketId", async (request, response) => {
  try {
    response.json(
      await getTicketDetail(
        prisma,
        request.get("X-Development-Requester-Id"),
        request.params.ticketId,
      ),
    );
  } catch (error) {
    sendTicketDetailError(response, error);
  }
});

app.get("/api/tickets/:ticketId/attachments", async (request, response) => {
  try {
    response.json(
      await listTicketAttachments(
        prisma,
        request.get("X-Development-Requester-Id"),
        request.params.ticketId,
      ),
    );
  } catch (error) {
    sendAttachmentReadError(
      response,
      error,
      "ATTACHMENT_LIST_FAILED",
      "Unable to list attachments",
    );
  }
});

app.post("/api/tickets/:ticketId/attachments", (request, response) => {
  void requireOwnedTicket(
    prisma,
    request.get("X-Development-Requester-Id"),
    request.params.ticketId,
  )
    .then(() => {
      parseSingleAttachment(request, response, (error) => {
        if (error) {
          sendAttachmentUploadError(response, error);
          return;
        }

        void uploadTicketAttachment(
          prisma,
          request.get("X-Development-Requester-Id"),
          request.params.ticketId,
          request.file,
        )
          .then((attachment) => response.status(201).json(attachment))
          .catch((uploadError) =>
            sendAttachmentUploadError(response, uploadError),
          );
      });
    })
    .catch((error) => sendAttachmentUploadError(response, error));
});

function contentDispositionHeader(displayName: string) {
  const safeName = displayName.replace(/["\r\n\\]/g, "_");
  const asciiFallback = safeName.replace(/[^\x20-\x7e]/g, "_") || "attachment";
  const encodedName = encodeURIComponent(safeName).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`;
}

app.get(
  "/api/tickets/:ticketId/attachments/:attachmentId/download",
  async (request, response) => {
    try {
      const result = await downloadTicketAttachment(
        prisma,
        request.get("X-Development-Requester-Id"),
        request.params.ticketId,
        request.params.attachmentId,
      );
      response
        .type(result.attachment.mimeType)
        .set(
          "Content-Disposition",
          contentDispositionHeader(result.attachment.displayName),
        )
        .send(result.content);
    } catch (error) {
      sendAttachmentReadError(
        response,
        error,
        "ATTACHMENT_DOWNLOAD_FAILED",
        "Unable to download attachment",
      );
    }
  },
);

app.delete(
  "/api/tickets/:ticketId/attachments/:attachmentId",
  async (request, response) => {
    try {
      await removeTicketAttachment(
        prisma,
        request.get("X-Development-Requester-Id"),
        request.params.ticketId,
        request.params.attachmentId,
        request.body?.removalReason,
      );
      response.status(204).send();
    } catch (error) {
      sendAttachmentRemoveError(response, error);
    }
  },
);

app.get("/", (_request, response) => {
  response.json({ service: "TokTickIT API" });
});
