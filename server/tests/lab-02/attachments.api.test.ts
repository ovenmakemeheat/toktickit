import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedReferenceData } from "../../prisma/seed-reference-data.js";
import { app } from "../../src/app.js";
import { prisma } from "../../src/db.js";
import { localAttachmentStorage } from "../../src/services/attachment-storage-service.js";
import {
  attachmentMaxSizeBytes,
  maxActiveAttachmentCount,
} from "../../src/services/attachment-policy-service.js";

const createdTicketIds = new Set<number>();

let requesterAId!: number;
let requesterBId!: number;
let lifecycleTicketId!: number;
let limitTicketId!: number;
let lifecycleAttachmentId!: number;
let activeAttachmentId!: number;

async function createTicket(requesterId: number, summary: string) {
  const [category, relatedSystem] = await Promise.all([
    prisma.category.findUnique({
      where: { name: "Hardware" },
      select: { id: true },
    }),
    prisma.relatedSystem.findUnique({
      where: { name: "VPN" },
      select: { id: true },
    }),
  ]);

  if (!category || !relatedSystem) {
    throw new Error("Expected Lab 2 reference data was not seeded");
  }

  const response = await request(app)
    .post("/api/tickets")
    .set("X-Development-Requester-Id", String(requesterId))
    .send({
      clientRequestId: randomUUID(),
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      requestedPriority: "MEDIUM",
      summary,
      description: `${summary} has enough detail for attachment testing.`,
    });

  expect(response.status).toBe(201);
  createdTicketIds.add(response.body.id);
  return response.body.id as number;
}

async function uploadAttachment(
  ticketId: number,
  requesterId: number,
  filename = "evidence.pdf",
  contentType = "application/pdf",
  contents: Buffer = Buffer.from("%PDF-1.4 attachment test"),
) {
  return request(app)
    .post(`/api/tickets/${ticketId}/attachments`)
    .set("X-Development-Requester-Id", String(requesterId))
    .attach("file", contents, { filename, contentType });
}

function expectError(response: request.Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({
    error: expect.objectContaining({ code }),
  });
}

describe("Lab 2 attachment lifecycle", () => {
  beforeAll(async () => {
    await seedReferenceData(prisma);

    const [requesterA, requesterB] = await Promise.all([
      prisma.developmentRequester.findUnique({
        where: { email: "requester-a@toktickit.test" },
        select: { id: true },
      }),
      prisma.developmentRequester.findUnique({
        where: { email: "requester-b@toktickit.test" },
        select: { id: true },
      }),
    ]);

    if (!requesterA || !requesterB) {
      throw new Error("Expected Lab 2 requesters were not seeded");
    }

    requesterAId = requesterA.id;
    requesterBId = requesterB.id;
    lifecycleTicketId = await createTicket(
      requesterAId,
      `Attachment lifecycle ${randomUUID().slice(0, 8)}`,
    );
    limitTicketId = await createTicket(
      requesterAId,
      `Attachment limit ${randomUUID().slice(0, 8)}`,
    );
  });

  afterAll(async () => {
    const attachments = await prisma.attachment.findMany({
      where: { ticketId: { in: [...createdTicketIds] } },
      select: { storageKey: true },
    });
    await Promise.all(
      attachments.map((attachment) =>
        localAttachmentStorage.remove(attachment.storageKey),
      ),
    );

    if (createdTicketIds.size > 0) {
      await prisma.attachment.deleteMany({
        where: { ticketId: { in: [...createdTicketIds] } },
      });
      await prisma.ticket.deleteMany({
        where: { id: { in: [...createdTicketIds] } },
      });
    }
    await prisma.$disconnect();
  });

  it("requires requester context and exactly one permitted file", async () => {
    const missingContext = await request(app).post(
      `/api/tickets/${lifecycleTicketId}/attachments`,
    );
    const missingFile = await request(app)
      .post(`/api/tickets/${lifecycleTicketId}/attachments`)
      .set("X-Development-Requester-Id", String(requesterAId));
    const unsupported = await uploadAttachment(
      lifecycleTicketId,
      requesterAId,
      "evidence.txt",
      "text/plain",
      Buffer.from("plain text"),
    );
    const mismatch = await uploadAttachment(
      lifecycleTicketId,
      requesterAId,
      "evidence.png",
      "image/jpeg",
      Buffer.from("not a png"),
    );

    expectError(missingContext, 400, "REQUESTER_CONTEXT_REQUIRED");
    expectError(missingFile, 400, "ATTACHMENT_FILE_REQUIRED");
    expectError(unsupported, 415, "ATTACHMENT_TYPE_NOT_ALLOWED");
    expectError(mismatch, 415, "ATTACHMENT_TYPE_NOT_ALLOWED");
  });

  it("rejects an attachment over the 5 MB server boundary", async () => {
    const oversized = await uploadAttachment(
      lifecycleTicketId,
      requesterAId,
      "large.pdf",
      "application/pdf",
      Buffer.alloc(attachmentMaxSizeBytes + 1, "a"),
    );

    expectError(oversized, 413, "ATTACHMENT_TOO_LARGE");
  });

  it("stores permitted metadata and exposes active metadata without storage keys", async () => {
    const response = await uploadAttachment(
      lifecycleTicketId,
      requesterAId,
      "incident-evidence.pdf",
    );

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        displayName: "incident-evidence.pdf",
        mimeType: "application/pdf",
        sizeBytes: expect.any(Number),
        uploadedAt: expect.any(String),
        removedAt: null,
        removalReason: null,
        isActive: true,
        downloadUrl: expect.stringContaining(
          `/api/tickets/${lifecycleTicketId}/attachments/`,
        ),
      }),
    );
    expect(response.body.storageKey).toBeUndefined();
    lifecycleAttachmentId = response.body.id;

    const metadata = await request(app)
      .get(`/api/tickets/${lifecycleTicketId}/attachments`)
      .set("X-Development-Requester-Id", String(requesterAId));
    expect(metadata.status).toBe(200);
    expect(metadata.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: lifecycleAttachmentId, isActive: true }),
      ]),
    );
  });

  it("downloads active content with safe response headers", async () => {
    const download = await request(app)
      .get(
        `/api/tickets/${lifecycleTicketId}/attachments/${lifecycleAttachmentId}/download`,
      )
      .set("X-Development-Requester-Id", String(requesterAId));

    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("application/pdf");
    expect(download.headers["content-disposition"]).toContain(
      "incident-evidence.pdf",
    );
    expect(download.body).toEqual(Buffer.from("%PDF-1.4 attachment test"));
  });

  it("soft-removes metadata, blocks download, and rejects repeat removal", async () => {
    const invalid = await request(app)
      .delete(
        `/api/tickets/${lifecycleTicketId}/attachments/${lifecycleAttachmentId}`,
      )
      .set("X-Development-Requester-Id", String(requesterAId))
      .send({ removalReason: "no" });
    const removed = await request(app)
      .delete(
        `/api/tickets/${lifecycleTicketId}/attachments/${lifecycleAttachmentId}`,
      )
      .set("X-Development-Requester-Id", String(requesterAId))
      .send({ removalReason: "  duplicate evidence  " });
    const repeated = await request(app)
      .delete(
        `/api/tickets/${lifecycleTicketId}/attachments/${lifecycleAttachmentId}`,
      )
      .set("X-Development-Requester-Id", String(requesterAId))
      .send({ removalReason: "another reason" });

    expectError(invalid, 400, "REMOVAL_REASON_INVALID");
    expect(removed.status).toBe(204);
    expect(repeated.status).toBe(409);
    expect(repeated.body.error.code).toBe("ATTACHMENT_ALREADY_REMOVED");

    const metadata = await request(app)
      .get(`/api/tickets/${lifecycleTicketId}/attachments`)
      .set("X-Development-Requester-Id", String(requesterAId));
    expect(metadata.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: lifecycleAttachmentId,
          isActive: false,
          removedAt: expect.any(String),
          removalReason: "duplicate evidence",
          downloadUrl: null,
        }),
      ]),
    );

    const blockedDownload = await request(app)
      .get(
        `/api/tickets/${lifecycleTicketId}/attachments/${lifecycleAttachmentId}/download`,
      )
      .set("X-Development-Requester-Id", String(requesterAId));
    expectError(blockedDownload, 410, "ATTACHMENT_REMOVED");
  });

  it("counts only active attachments and enforces the five-file limit", async () => {
    const responses = [];
    for (let index = 0; index < maxActiveAttachmentCount; index += 1) {
      responses.push(
        await uploadAttachment(
          limitTicketId,
          requesterAId,
          `active-${index}.pdf`,
        ),
      );
    }
    activeAttachmentId = responses[0].body.id;
    const sixth = await uploadAttachment(
      limitTicketId,
      requesterAId,
      "sixth.pdf",
    );

    expect(responses.every((response) => response.status === 201)).toBe(true);
    expectError(sixth, 409, "ACTIVE_ATTACHMENT_LIMIT_REACHED");
  });

  it("does not disclose or mutate another Requester's Ticket attachments", async () => {
    const metadata = await request(app)
      .get(`/api/tickets/${limitTicketId}/attachments`)
      .set("X-Development-Requester-Id", String(requesterBId));
    const upload = await uploadAttachment(
      limitTicketId,
      requesterBId,
      "cross-owner.pdf",
    );
    const download = await request(app)
      .get(
        `/api/tickets/${limitTicketId}/attachments/${activeAttachmentId}/download`,
      )
      .set("X-Development-Requester-Id", String(requesterBId));
    const remove = await request(app)
      .delete(`/api/tickets/${limitTicketId}/attachments/${activeAttachmentId}`)
      .set("X-Development-Requester-Id", String(requesterBId))
      .send({ removalReason: "cross owner attempt" });

    expectError(metadata, 404, "TICKET_NOT_FOUND");
    expectError(upload, 404, "TICKET_NOT_FOUND");
    expectError(download, 404, "TICKET_NOT_FOUND");
    expectError(remove, 404, "TICKET_NOT_FOUND");
  });
});
