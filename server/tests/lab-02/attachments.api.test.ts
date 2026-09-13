import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  app,
  loginAgent,
  prepareLab3Data,
  prisma,
} from "../lab-03/test-helpers.js";
import { localAttachmentStorage } from "../../src/services/attachment-storage-service.js";
import {
  attachmentMaxSizeBytes,
  maxActiveAttachmentCount,
} from "../../src/services/attachment-policy-service.js";

const createdTicketIds = new Set<number>();

let requesterA!: Awaited<ReturnType<typeof loginAgent>>;
let requesterB!: Awaited<ReturnType<typeof loginAgent>>;
let lifecycleTicketId!: number;
let limitTicketId!: number;
let concurrentTicketId!: number;
let lifecycleAttachmentId!: number;
let activeAttachmentId!: number;

async function createTicket(
  authenticated: Awaited<ReturnType<typeof loginAgent>>,
  summary: string,
) {
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
    throw new Error("Expected Lab 3 reference data was not seeded");
  }

  const response = await authenticated.agent
    .post("/api/tickets")
    .set("X-CSRF-Token", authenticated.csrfToken)
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
  authenticated: Awaited<ReturnType<typeof loginAgent>>,
  ticketId: number,
  filename = "evidence.pdf",
  contentType = "application/pdf",
  contents: Buffer = Buffer.from("%PDF-1.4 attachment test"),
) {
  return authenticated.agent
    .post(`/api/tickets/${ticketId}/attachments`)
    .set("X-CSRF-Token", authenticated.csrfToken)
    .attach("file", contents, { filename, contentType });
}

function expectError(response: request.Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({
    error: expect.objectContaining({ code }),
  });
}

describe("Lab 3 authenticated attachment lifecycle", () => {
  beforeAll(async () => {
    await prepareLab3Data();
    requesterA = await loginAgent("requester-a@toktickit.test");
    requesterB = await loginAgent("requester-b@toktickit.test");
    lifecycleTicketId = await createTicket(
      requesterA,
      `Attachment lifecycle ${randomUUID().slice(0, 8)}`,
    );
    limitTicketId = await createTicket(
      requesterA,
      `Attachment limit ${randomUUID().slice(0, 8)}`,
    );
    concurrentTicketId = await createTicket(
      requesterA,
      `Attachment concurrency ${randomUUID().slice(0, 8)}`,
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

  it("requires authentication and exactly one permitted file", async () => {
    const missingSession = await request(app).post(
      `/api/tickets/${lifecycleTicketId}/attachments`,
    );
    const missingFile = await requesterA.agent
      .post(`/api/tickets/${lifecycleTicketId}/attachments`)
      .set("X-CSRF-Token", requesterA.csrfToken);
    const unsupported = await uploadAttachment(
      requesterA,
      lifecycleTicketId,
      "evidence.txt",
      "text/plain",
      Buffer.from("plain text"),
    );
    const mismatch = await uploadAttachment(
      requesterA,
      lifecycleTicketId,
      "evidence.png",
      "image/jpeg",
      Buffer.from("not a png"),
    );
    const forgedContent = await uploadAttachment(
      requesterA,
      lifecycleTicketId,
      "evidence.pdf",
      "application/pdf",
      Buffer.from("this is not a PDF"),
    );

    expectError(missingSession, 401, "SESSION_REQUIRED");
    expectError(missingFile, 400, "ATTACHMENT_FILE_REQUIRED");
    expectError(unsupported, 415, "ATTACHMENT_TYPE_NOT_ALLOWED");
    expectError(mismatch, 415, "ATTACHMENT_TYPE_NOT_ALLOWED");
    expectError(forgedContent, 415, "ATTACHMENT_TYPE_NOT_ALLOWED");
  });

  it("rejects an attachment over the 5 MB server boundary", async () => {
    const oversized = await uploadAttachment(
      requesterA,
      lifecycleTicketId,
      "large.pdf",
      "application/pdf",
      Buffer.alloc(attachmentMaxSizeBytes + 1, "a"),
    );

    expectError(oversized, 413, "ATTACHMENT_TOO_LARGE");
  });

  it("stores permitted metadata and exposes active metadata without storage keys", async () => {
    await prisma.ticket.update({
      where: { id: lifecycleTicketId },
      data: { updatedAt: new Date("2020-01-01T00:00:00.000Z") },
    });
    const beforeUpload = await prisma.ticket.findUniqueOrThrow({
      where: { id: lifecycleTicketId },
      select: { updatedAt: true },
    });
    const response = await uploadAttachment(
      requesterA,
      lifecycleTicketId,
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
    const afterUpload = await prisma.ticket.findUniqueOrThrow({
      where: { id: lifecycleTicketId },
      select: { updatedAt: true },
    });
    expect(afterUpload.updatedAt.getTime()).toBeGreaterThan(
      beforeUpload.updatedAt.getTime(),
    );

    const metadata = await requesterA.agent.get(
      `/api/tickets/${lifecycleTicketId}/attachments`,
    );
    expect(metadata.status).toBe(200);
    expect(metadata.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: lifecycleAttachmentId, isActive: true }),
      ]),
    );
  });

  it("downloads active content with safe response headers", async () => {
    const download = await requesterA.agent.get(
      `/api/tickets/${lifecycleTicketId}/attachments/${lifecycleAttachmentId}/download`,
    );

    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("application/pdf");
    expect(download.headers["content-disposition"]).toContain(
      "incident-evidence.pdf",
    );
    expect(download.body).toEqual(Buffer.from("%PDF-1.4 attachment test"));
  });

  it("encodes Unicode display names in download headers", async () => {
    const uploaded = await uploadAttachment(
      requesterA,
      lifecycleTicketId,
      "evidence-📄.pdf",
    );
    expect(uploaded.status).toBe(201);

    const download = await requesterA.agent.get(
      `/api/tickets/${lifecycleTicketId}/attachments/${uploaded.body.id}/download`,
    );

    expect(download.status).toBe(200);
    expect(download.headers["content-disposition"]).toContain(
      'filename="evidence-__.pdf"',
    );
    expect(download.headers["content-disposition"]).toContain(
      "filename*=UTF-8''evidence-%F0%9F%93%84.pdf",
    );
  });

  it("soft-removes metadata, blocks download, and rejects repeat removal", async () => {
    await prisma.ticket.update({
      where: { id: lifecycleTicketId },
      data: { updatedAt: new Date("2020-01-01T00:00:00.000Z") },
    });
    const beforeRemoval = await prisma.ticket.findUniqueOrThrow({
      where: { id: lifecycleTicketId },
      select: { updatedAt: true },
    });
    const invalid = await requesterA.agent
      .delete(
        `/api/tickets/${lifecycleTicketId}/attachments/${lifecycleAttachmentId}`,
      )
      .set("X-CSRF-Token", requesterA.csrfToken)
      .send({ removalReason: "no" });
    const removed = await requesterA.agent
      .delete(
        `/api/tickets/${lifecycleTicketId}/attachments/${lifecycleAttachmentId}`,
      )
      .set("X-CSRF-Token", requesterA.csrfToken)
      .send({ removalReason: "  duplicate evidence  " });
    const repeated = await requesterA.agent
      .delete(
        `/api/tickets/${lifecycleTicketId}/attachments/${lifecycleAttachmentId}`,
      )
      .set("X-CSRF-Token", requesterA.csrfToken)
      .send({ removalReason: "another reason" });

    expectError(invalid, 400, "REMOVAL_REASON_INVALID");
    expect(removed.status).toBe(204);
    expect(repeated.status).toBe(409);
    expect(repeated.body.error.code).toBe("ATTACHMENT_ALREADY_REMOVED");
    const afterRemoval = await prisma.ticket.findUniqueOrThrow({
      where: { id: lifecycleTicketId },
      select: { updatedAt: true },
    });
    expect(afterRemoval.updatedAt.getTime()).toBeGreaterThan(
      beforeRemoval.updatedAt.getTime(),
    );

    const metadata = await requesterA.agent.get(
      `/api/tickets/${lifecycleTicketId}/attachments`,
    );
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

    const blockedDownload = await requesterA.agent.get(
      `/api/tickets/${lifecycleTicketId}/attachments/${lifecycleAttachmentId}/download`,
    );
    expectError(blockedDownload, 410, "ATTACHMENT_REMOVED");
  });

  it("counts only active attachments and enforces the five-file limit", async () => {
    const responses = [];
    for (let index = 0; index < maxActiveAttachmentCount; index += 1) {
      responses.push(
        await uploadAttachment(
          requesterA,
          limitTicketId,
          `active-${index}.pdf`,
        ),
      );
    }
    activeAttachmentId = responses[0].body.id;
    const sixth = await uploadAttachment(
      requesterA,
      limitTicketId,
      "sixth.pdf",
    );

    expect(responses.every((response) => response.status === 201)).toBe(true);
    expectError(sixth, 409, "ACTIVE_ATTACHMENT_LIMIT_REACHED");
  });

  it("serializes concurrent uploads at the five-active-file limit", async () => {
    for (let index = 0; index < maxActiveAttachmentCount - 1; index += 1) {
      const response = await uploadAttachment(
        requesterA,
        concurrentTicketId,
        `concurrent-${index}.pdf`,
      );
      expect(response.status).toBe(201);
    }

    const responses = await Promise.all([
      uploadAttachment(requesterA, concurrentTicketId, "concurrent-a.pdf"),
      uploadAttachment(requesterA, concurrentTicketId, "concurrent-b.pdf"),
    ]);

    expect(
      responses.filter((response) => response.status === 201),
    ).toHaveLength(1);
    expect(
      responses.filter((response) => response.status === 409),
    ).toHaveLength(1);
    const rejected = responses.find((response) => response.status === 409);
    if (!rejected) {
      throw new Error("Expected one concurrent upload to be rejected");
    }
    expectError(rejected, 409, "ACTIVE_ATTACHMENT_LIMIT_REACHED");

    await expect(
      prisma.attachment.count({
        where: { ticketId: concurrentTicketId, removedAt: null },
      }),
    ).resolves.toBe(maxActiveAttachmentCount);
  });

  it("does not disclose or mutate another Requester's Ticket attachments", async () => {
    const metadata = await requesterB.agent.get(
      `/api/tickets/${limitTicketId}/attachments`,
    );
    const upload = await uploadAttachment(
      requesterB,
      limitTicketId,
      "cross-owner.pdf",
    );
    const crossOwnerMultipleFiles = await requesterB.agent
      .post(`/api/tickets/${limitTicketId}/attachments`)
      .set("X-CSRF-Token", requesterB.csrfToken)
      .attach("file", Buffer.from("%PDF-1.4 first"), {
        filename: "first.pdf",
        contentType: "application/pdf",
      })
      .attach("file", Buffer.from("%PDF-1.4 second"), {
        filename: "second.pdf",
        contentType: "application/pdf",
      });
    const download = await requesterB.agent.get(
      `/api/tickets/${limitTicketId}/attachments/${activeAttachmentId}/download`,
    );
    const remove = await requesterB.agent
      .delete(`/api/tickets/${limitTicketId}/attachments/${activeAttachmentId}`)
      .set("X-CSRF-Token", requesterB.csrfToken)
      .send({ removalReason: "cross owner attempt" });

    expectError(metadata, 404, "TICKET_NOT_FOUND");
    expectError(upload, 404, "TICKET_NOT_FOUND");
    expectError(crossOwnerMultipleFiles, 404, "TICKET_NOT_FOUND");
    expectError(download, 404, "TICKET_NOT_FOUND");
    expectError(remove, 404, "TICKET_NOT_FOUND");
  });
});
