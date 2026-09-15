import express, { type Response } from "express";
import multer, { MulterError } from "multer";

import { prisma } from "./db.js";
import {
  AccountInactiveError,
  changePassword,
  CurrentPasswordInvalidError,
  InvalidCredentialsError,
  login,
  PasswordReuseNotAllowedError,
} from "./services/auth-service.js";
import {
  attachAuthContext,
  clearSessionCookies,
  ensureCsrfToken,
  getAuthContext,
  requireAuthentication,
  requireCsrfToken,
  setSessionCookies,
} from "./services/auth-middleware.js";
import { AuthInputValidationError } from "./services/auth-validation-service.js";
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
  listTickets,
  TicketQueryValidationError,
} from "./services/ticket-query-service.js";
import {
  CommunicationContentValidationError,
  createInternalNote,
  createPublicComment,
  indicateRequesterResolution,
  listInternalNotes,
  listPublicComments,
  ResolutionIndicationValidationError,
} from "./services/ticket-communication-service.js";
import {
  ItPriorityValidationError,
  OwnerInvalidError,
  assignStaffTicket,
  claimStaffTicket,
  getStaffTicketDetail,
  TicketAlreadyAssignedError,
  updateStaffTicketPriority,
  updateStaffTicketStatus,
} from "./services/staff-ticket-service.js";
import {
  listStaffTickets,
  StaffQueueQueryValidationError,
} from "./services/staff-ticket-query-service.js";
import {
  StatusConfirmationRequiredError,
  TicketStatusTransitionInvalidError,
} from "./services/ticket-status-service.js";
import { TicketInputValidationError } from "./services/ticket-validation-service.js";
import {
  listCategories,
  listRelatedSystems,
  ReferenceDataStoreUnavailableError,
} from "./services/reference-data-service.js";

function sendError(
  response: Response,
  status: number,
  code: string,
  message: string,
  fields?: unknown,
) {
  response.status(status).json({
    error: {
      code,
      message,
      ...(fields ? { fields } : {}),
    },
  });
}

function isMalformedJsonError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const bodyParserError = error as Error & {
    status?: number;
    type?: string;
  };
  return (
    bodyParserError.status === 400 &&
    bodyParserError.type === "entity.parse.failed"
  );
}

function sendReferenceDataError(response: Response, error: unknown) {
  if (error instanceof ReferenceDataStoreUnavailableError) {
    sendError(response, 503, error.code, error.message);
    return;
  }

  sendError(
    response,
    500,
    "REFERENCE_DATA_FAILED",
    "Unable to load reference data",
  );
}

function sendTicketCreateError(response: Response, error: unknown) {
  if (error instanceof TicketInputValidationError) {
    sendError(response, 400, error.code, error.message, error.fields);
    return;
  }

  if (
    error instanceof CategoryNotFoundError ||
    error instanceof RelatedSystemNotFoundError
  ) {
    sendError(response, 404, error.code, error.message);
    return;
  }

  if (error instanceof IdempotencyKeyReusedError) {
    sendError(response, 409, error.code, error.message);
    return;
  }

  sendError(response, 500, "TICKET_CREATE_FAILED", "Unable to create ticket");
}

function sendTicketDetailError(response: Response, error: unknown) {
  if (error instanceof TicketIdValidationError) {
    sendError(response, 400, error.code, error.message);
    return;
  }

  if (error instanceof TicketNotFoundError) {
    sendError(response, 404, error.code, error.message);
    return;
  }

  sendError(
    response,
    500,
    "TICKET_DETAIL_FAILED",
    "Unable to load ticket detail",
  );
}

function sendTicketListError(response: Response, error: unknown) {
  if (error instanceof TicketQueryValidationError) {
    sendError(response, 400, error.code, error.message, error.fields);
    return;
  }

  sendError(response, 500, "TICKET_LIST_FAILED", "Unable to load tickets");
}

function sendStaffQueueError(response: Response, error: unknown) {
  if (error instanceof StaffQueueQueryValidationError) {
    sendError(response, 400, error.code, error.message, error.fields);
    return;
  }

  sendError(
    response,
    500,
    "STAFF_QUEUE_FAILED",
    "Unable to load the Staff Ticket Queue",
  );
}

function sendStaffTicketError(response: Response, error: unknown) {
  if (error instanceof TicketIdValidationError) {
    sendError(response, 400, error.code, error.message);
    return;
  }

  if (error instanceof TicketNotFoundError) {
    sendError(response, 404, error.code, error.message);
    return;
  }

  if (error instanceof TicketAlreadyAssignedError) {
    sendError(response, 409, error.code, error.message);
    return;
  }

  if (
    error instanceof OwnerInvalidError ||
    error instanceof ItPriorityValidationError ||
    error instanceof TicketStatusTransitionInvalidError ||
    error instanceof StatusConfirmationRequiredError
  ) {
    sendError(response, 400, error.code, error.message);
    return;
  }

  sendError(
    response,
    500,
    "STAFF_TICKET_FAILED",
    "Unable to complete the Staff Ticket operation",
  );
}

function sendCommunicationError(
  response: Response,
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string,
) {
  if (error instanceof TicketIdValidationError) {
    sendError(response, 400, error.code, error.message);
    return;
  }

  if (
    error instanceof CommunicationContentValidationError ||
    error instanceof ResolutionIndicationValidationError
  ) {
    sendError(response, 400, error.code, error.message, error.fields);
    return;
  }

  if (error instanceof TicketNotFoundError) {
    sendError(response, 404, error.code, error.message);
    return;
  }

  sendError(response, 500, fallbackCode, fallbackMessage);
}

function sendAttachmentUploadError(response: Response, error: unknown) {
  if (
    error instanceof TicketIdValidationError ||
    error instanceof AttachmentFileRequiredError ||
    error instanceof AttachmentUploadInvalidError
  ) {
    sendError(response, 400, error.code, error.message);
    return;
  }

  if (error instanceof MulterError) {
    sendError(
      response,
      error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
      error.code === "LIMIT_FILE_SIZE"
        ? "ATTACHMENT_TOO_LARGE"
        : "ATTACHMENT_UPLOAD_INVALID",
      error.code === "LIMIT_FILE_SIZE"
        ? "Each attachment must be 5 MB or smaller."
        : "Attachment upload is invalid.",
    );
    return;
  }

  if (error instanceof TicketNotFoundError) {
    sendError(response, 404, error.code, error.message);
    return;
  }

  if (error instanceof AttachmentTooLargeError) {
    sendError(response, 413, error.code, error.message);
    return;
  }

  if (error instanceof AttachmentTypeNotAllowedError) {
    sendError(response, 415, error.code, error.message);
    return;
  }

  if (error instanceof ActiveAttachmentLimitReachedError) {
    sendError(response, 409, error.code, error.message);
    return;
  }

  if (error instanceof AttachmentStorageUnavailableError) {
    sendError(response, 503, error.code, error.message);
    return;
  }

  sendError(
    response,
    500,
    error instanceof AttachmentUploadFailedError
      ? error.code
      : "ATTACHMENT_UPLOAD_FAILED",
    "Unable to upload attachment",
  );
}

function sendAttachmentReadError(
  response: Response,
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string,
) {
  if (error instanceof TicketIdValidationError) {
    sendError(response, 400, error.code, error.message);
    return;
  }

  if (
    error instanceof TicketNotFoundError ||
    error instanceof AttachmentNotFoundError
  ) {
    sendError(response, 404, error.code, error.message);
    return;
  }

  if (error instanceof AttachmentRemovedError) {
    sendError(response, 410, error.code, error.message);
    return;
  }

  if (error instanceof AttachmentStorageUnavailableError) {
    sendError(response, 503, error.code, error.message);
    return;
  }

  sendError(response, 500, fallbackCode, fallbackMessage);
}

function sendAttachmentRemoveError(response: Response, error: unknown) {
  if (
    error instanceof TicketIdValidationError ||
    error instanceof RemovalReasonInvalidError
  ) {
    sendError(response, 400, error.code, error.message);
    return;
  }

  if (
    error instanceof TicketNotFoundError ||
    error instanceof AttachmentNotFoundError
  ) {
    sendError(response, 404, error.code, error.message);
    return;
  }

  if (error instanceof AttachmentAlreadyRemovedError) {
    sendError(response, 409, error.code, error.message);
    return;
  }

  sendError(
    response,
    500,
    "ATTACHMENT_REMOVE_FAILED",
    "Unable to remove attachment",
  );
}

function sendAuthRouteError(
  response: Response,
  error: unknown,
  fallbackCode: "LOGIN_FAILED" | "PASSWORD_CHANGE_FAILED",
) {
  if (error instanceof AuthInputValidationError) {
    sendError(response, 400, error.code, error.message, error.fields);
    return;
  }

  if (error instanceof InvalidCredentialsError) {
    sendError(response, 401, error.code, error.message);
    return;
  }

  if (error instanceof AccountInactiveError) {
    sendError(response, 403, error.code, error.message);
    return;
  }

  if (error instanceof CurrentPasswordInvalidError) {
    sendError(response, 401, error.code, error.message);
    return;
  }

  if (error instanceof PasswordReuseNotAllowedError) {
    sendError(response, 409, error.code, error.message);
    return;
  }

  sendError(response, 500, fallbackCode, "Unable to complete authentication");
}

function sessionResponse(result: {
  user: ReturnType<typeof import("./services/session-service.js").toPublicUser>;
  session: { expiresAt: Date; csrfToken: string };
}) {
  return {
    user: result.user,
    session: { expiresAt: result.session.expiresAt.toISOString() },
    csrfToken: result.session.csrfToken,
  };
}

function requireCsrf(
  request: express.Request,
  response: Response,
  next: express.NextFunction,
) {
  if (requireCsrfToken(request, response)) {
    next();
  }
}

export const app = express();

app.disable("x-powered-by");
app.use(express.json());
app.use(attachAuthContext(prisma));

const parseSingleAttachment = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: attachmentMaxSizeBytes },
}).single("file");

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "TokTickIT API" });
});

app.post("/api/auth/login", async (request, response) => {
  try {
    const result = await login(prisma, request.body);
    setSessionCookies(
      response,
      result.session.token,
      result.session.csrfToken,
      result.session.expiresAt.getTime() - Date.now(),
    );
    response.json(sessionResponse(result));
  } catch (error) {
    sendAuthRouteError(response, error, "LOGIN_FAILED");
  }
});

app.get(
  "/api/auth/me",
  requireAuthentication({ allowPasswordChange: true }),
  async (request, response) => {
    try {
      const csrfToken = await ensureCsrfToken(prisma, request, response);
      const auth = getAuthContext(request);
      response.json({
        user: {
          id: auth.user.id,
          name: auth.user.name,
          email: auth.user.email,
          role: auth.user.role,
          active: auth.user.active,
          mustChangePassword: auth.user.mustChangePassword,
        },
        session: { expiresAt: auth.expiresAt.toISOString() },
        csrfToken,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "SessionRequiredError") {
        sendError(
          response,
          401,
          "SESSION_REQUIRED",
          "An authenticated session is required.",
        );
        return;
      }
      sendError(
        response,
        500,
        "AUTH_ME_FAILED",
        "Unable to load the current user",
      );
    }
  },
);

app.patch(
  "/api/auth/password",
  requireAuthentication({ allowPasswordChange: true }),
  requireCsrf,
  async (request, response) => {
    try {
      const auth = getAuthContext(request);
      const result = await changePassword(prisma, auth.user, request.body);
      setSessionCookies(
        response,
        result.session.token,
        result.session.csrfToken,
        result.session.expiresAt.getTime() - Date.now(),
      );
      response.json(sessionResponse(result));
    } catch (error) {
      sendAuthRouteError(response, error, "PASSWORD_CHANGE_FAILED");
    }
  },
);

app.post("/api/auth/logout", async (request, response) => {
  const auth = request.auth;
  if (auth && !requireCsrfToken(request, response)) {
    return;
  }

  if (auth) {
    await prisma.session.updateMany({
      where: { id: auth.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearSessionCookies(response);
  response.status(204).send();
});

app.get(
  "/api/categories",
  requireAuthentication(),
  async (_request, response) => {
    try {
      response.json(await listCategories(prisma));
    } catch (error) {
      sendReferenceDataError(response, error);
    }
  },
);

app.get(
  "/api/related-systems",
  requireAuthentication(),
  async (_request, response) => {
    try {
      response.json(await listRelatedSystems(prisma));
    } catch (error) {
      sendReferenceDataError(response, error);
    }
  },
);

app.post(
  "/api/tickets",
  requireAuthentication({ roles: ["REQUESTER"] }),
  requireCsrf,
  async (request, response) => {
    try {
      const auth = getAuthContext(request);
      const result = await createTicket(prisma, auth.user.id, request.body);
      response.status(result.replayed ? 200 : 201).json(result.ticket);
    } catch (error) {
      sendTicketCreateError(response, error);
    }
  },
);

app.get(
  "/api/tickets",
  requireAuthentication({ roles: ["REQUESTER"] }),
  async (request, response) => {
    try {
      const auth = getAuthContext(request);
      response.json(await listTickets(prisma, auth.user.id, request.query));
    } catch (error) {
      sendTicketListError(response, error);
    }
  },
);

app.get(
  "/api/tickets/:ticketId",
  requireAuthentication({ roles: ["REQUESTER"] }),
  async (request, response) => {
    try {
      const auth = getAuthContext(request);
      response.json(
        await getTicketDetail(prisma, auth.user.id, request.params.ticketId),
      );
    } catch (error) {
      sendTicketDetailError(response, error);
    }
  },
);

app.get(
  "/api/tickets/:ticketId/attachments",
  requireAuthentication({ roles: ["REQUESTER"] }),
  async (request, response) => {
    try {
      const auth = getAuthContext(request);
      response.json(
        await listTicketAttachments(
          prisma,
          auth.user.id,
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
  },
);

app.post(
  "/api/tickets/:ticketId/attachments",
  requireAuthentication({ roles: ["REQUESTER"] }),
  requireCsrf,
  (request, response) => {
    const auth = getAuthContext(request);
    void requireOwnedTicket(prisma, auth.user.id, request.params.ticketId)
      .then(() => {
        parseSingleAttachment(request, response, (error) => {
          if (error) {
            sendAttachmentUploadError(response, error);
            return;
          }

          void uploadTicketAttachment(
            prisma,
            auth.user.id,
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
  },
);

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
  requireAuthentication({ roles: ["REQUESTER"] }),
  async (request, response) => {
    try {
      const auth = getAuthContext(request);
      const result = await downloadTicketAttachment(
        prisma,
        auth.user.id,
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
  requireAuthentication({ roles: ["REQUESTER"] }),
  requireCsrf,
  async (request, response) => {
    try {
      const auth = getAuthContext(request);
      await removeTicketAttachment(
        prisma,
        auth.user.id,
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

app.get(
  "/api/tickets/:ticketId/comments",
  requireAuthentication({
    roles: ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"],
  }),
  async (request, response) => {
    try {
      const auth = getAuthContext(request);
      response.json(
        await listPublicComments(prisma, auth.user, request.params.ticketId),
      );
    } catch (error) {
      sendCommunicationError(
        response,
        error,
        "COMMENT_LIST_FAILED",
        "Unable to load Public Comments",
      );
    }
  },
);

app.post(
  "/api/tickets/:ticketId/comments",
  requireAuthentication({
    roles: ["REQUESTER", "IT_STAFF"],
    roleForbiddenCode: "COMMENT_FORBIDDEN",
  }),
  requireCsrf,
  async (request, response) => {
    try {
      const auth = getAuthContext(request);
      response
        .status(201)
        .json(
          await createPublicComment(
            prisma,
            auth.user,
            request.params.ticketId,
            request.body,
          ),
        );
    } catch (error) {
      sendCommunicationError(
        response,
        error,
        "COMMENT_CREATE_FAILED",
        "Unable to create Public Comment",
      );
    }
  },
);

app.post(
  "/api/tickets/:ticketId/resolution-indication",
  requireAuthentication({
    roles: ["REQUESTER"],
    roleForbiddenCode: "ROLE_FORBIDDEN",
  }),
  requireCsrf,
  async (request, response) => {
    try {
      const auth = getAuthContext(request);
      response.json(
        await indicateRequesterResolution(
          prisma,
          auth.user,
          request.params.ticketId,
          request.body,
        ),
      );
    } catch (error) {
      sendCommunicationError(
        response,
        error,
        "RESOLUTION_INDICATION_FAILED",
        "Unable to record the resolution indication",
      );
    }
  },
);

app.get(
  "/api/tickets/:ticketId/internal-notes",
  requireAuthentication({
    roles: ["IT_STAFF", "ADMINISTRATOR"],
    roleForbiddenCode: "INTERNAL_NOTES_FORBIDDEN",
  }),
  async (request, response) => {
    try {
      const auth = getAuthContext(request);
      response.json(
        await listInternalNotes(prisma, auth.user, request.params.ticketId),
      );
    } catch (error) {
      sendCommunicationError(
        response,
        error,
        "INTERNAL_NOTES_FAILED",
        "Unable to load Internal Notes",
      );
    }
  },
);

app.post(
  "/api/tickets/:ticketId/internal-notes",
  requireAuthentication({
    roles: ["IT_STAFF"],
    roleForbiddenCode: "INTERNAL_NOTES_FORBIDDEN",
  }),
  requireCsrf,
  async (request, response) => {
    try {
      const auth = getAuthContext(request);
      response
        .status(201)
        .json(
          await createInternalNote(
            prisma,
            auth.user,
            request.params.ticketId,
            request.body,
          ),
        );
    } catch (error) {
      sendCommunicationError(
        response,
        error,
        "INTERNAL_NOTE_CREATE_FAILED",
        "Unable to create Internal Note",
      );
    }
  },
);

app.get(
  "/api/staff/tickets",
  requireAuthentication({
    roles: ["IT_STAFF"],
    roleForbiddenCode: "STAFF_QUEUE_FORBIDDEN",
  }),
  async (request, response) => {
    try {
      const auth = getAuthContext(request);
      response.json(
        await listStaffTickets(prisma, auth.user.id, request.query),
      );
    } catch (error) {
      sendStaffQueueError(response, error);
    }
  },
);

app.get(
  "/api/staff/tickets/:ticketId",
  requireAuthentication({
    roles: ["IT_STAFF"],
    roleForbiddenCode: "STAFF_TICKET_FORBIDDEN",
  }),
  async (request, response) => {
    try {
      response.json(
        await getStaffTicketDetail(prisma, request.params.ticketId),
      );
    } catch (error) {
      sendStaffTicketError(response, error);
    }
  },
);

app.post(
  "/api/staff/tickets/:ticketId/claim",
  requireAuthentication({
    roles: ["IT_STAFF"],
    roleForbiddenCode: "STAFF_TICKET_FORBIDDEN",
  }),
  requireCsrf,
  async (request, response) => {
    try {
      const auth = getAuthContext(request);
      response.json(
        await claimStaffTicket(prisma, auth.user.id, request.params.ticketId),
      );
    } catch (error) {
      sendStaffTicketError(response, error);
    }
  },
);

app.patch(
  "/api/staff/tickets/:ticketId/owner",
  requireAuthentication({
    roles: ["IT_STAFF"],
    roleForbiddenCode: "STAFF_TICKET_FORBIDDEN",
  }),
  requireCsrf,
  async (request, response) => {
    try {
      response.json(
        await assignStaffTicket(prisma, request.params.ticketId, request.body),
      );
    } catch (error) {
      sendStaffTicketError(response, error);
    }
  },
);

app.patch(
  "/api/staff/tickets/:ticketId/priority",
  requireAuthentication({
    roles: ["IT_STAFF"],
    roleForbiddenCode: "STAFF_TICKET_FORBIDDEN",
  }),
  requireCsrf,
  async (request, response) => {
    try {
      response.json(
        await updateStaffTicketPriority(
          prisma,
          request.params.ticketId,
          request.body,
        ),
      );
    } catch (error) {
      sendStaffTicketError(response, error);
    }
  },
);

app.patch(
  "/api/staff/tickets/:ticketId/status",
  requireAuthentication({
    roles: ["IT_STAFF"],
    roleForbiddenCode: "STAFF_TICKET_FORBIDDEN",
  }),
  requireCsrf,
  async (request, response) => {
    try {
      response.json(
        await updateStaffTicketStatus(
          prisma,
          request.params.ticketId,
          request.body,
        ),
      );
    } catch (error) {
      sendStaffTicketError(response, error);
    }
  },
);

app.get("/", (_request, response) => {
  response.json({ service: "TokTickIT API" });
});

app.use((_request, response) => {
  sendError(response, 404, "NOT_FOUND", "Resource was not found");
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: Response,
    next: express.NextFunction,
  ) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (isMalformedJsonError(error)) {
      sendError(
        response,
        400,
        "INVALID_JSON",
        "Request body must be valid JSON",
      );
      return;
    }

    sendError(
      response,
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to complete request",
    );
  },
);
