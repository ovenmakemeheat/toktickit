export const apiErrorMessage = "Unable to connect to TokTickIT API";

export type Category = {
  id: number;
  name: string;
};

export type DevelopmentRequester = {
  id: number;
  name: string;
  email: string;
};

export type RelatedSystem = {
  id: number;
  name: string;
};

export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";

export type TicketSortBy =
  | "ticketDate"
  | "updatedAt"
  | "ticketNumber"
  | "summary";

export type TicketSortDirection = "asc" | "desc";

export type TicketListQuery = {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: RequestedPriority;
  currentStatus?: "NEW";
  sortBy?: TicketSortBy;
  sortDirection?: TicketSortDirection;
  page?: number;
  pageSize?: 10 | 20 | 50;
};

export type CreateTicketInput = {
  clientRequestId: string;
  categoryId: number;
  relatedSystemId: number;
  requestedPriority: RequestedPriority;
  summary: string;
  description: string;
};

export type AttachmentMetadata = {
  id: number;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  removedAt: string | null;
  removalReason: string | null;
  isActive: boolean;
  downloadUrl: string | null;
};

export type TicketDetail = {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  requester: { id: number; name: string };
  category: Category;
  relatedSystem: RelatedSystem;
  requestedPriority: RequestedPriority;
  summary: string;
  description: string;
  currentStatus: "NEW";
  createdAt: string;
  lastUpdated: string;
  attachments: AttachmentMetadata[];
};

export type TicketSummary = Pick<
  TicketDetail,
  | "id"
  | "ticketNumber"
  | "ticketDate"
  | "requester"
  | "category"
  | "relatedSystem"
  | "requestedPriority"
  | "summary"
  | "currentStatus"
  | "lastUpdated"
>;

export type TicketListResponse = {
  items: TicketSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type HealthResponse = {
  service: string;
  status: "ok";
};

export class ApiRequestError extends Error {
  readonly code: string | undefined;
  readonly fields: ApiErrorField[] | undefined;

  constructor(code?: string, fields?: ApiErrorField[]) {
    super(apiErrorMessage);
    this.name = "ApiRequestError";
    this.code = code;
    this.fields = fields;
  }
}

export type ApiErrorField = {
  field: string;
  code: string;
  message: string;
};

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isHealthResponse(payload: unknown): payload is HealthResponse {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const health = payload as Record<string, unknown>;
  return health.status === "ok" && typeof health.service === "string";
}

function isCategoryList(payload: unknown): payload is Category[] {
  return (
    Array.isArray(payload) &&
    payload.every(
      (category) =>
        typeof category === "object" &&
        category !== null &&
        Number.isInteger((category as Record<string, unknown>).id) &&
        typeof (category as Record<string, unknown>).name === "string",
    )
  );
}

function isDevelopmentRequesterList(
  payload: unknown,
): payload is DevelopmentRequester[] {
  return (
    Array.isArray(payload) &&
    payload.every(
      (requester) =>
        typeof requester === "object" &&
        requester !== null &&
        Number.isInteger((requester as Record<string, unknown>).id) &&
        typeof (requester as Record<string, unknown>).name === "string" &&
        typeof (requester as Record<string, unknown>).email === "string",
    )
  );
}

function isRelatedSystemList(payload: unknown): payload is RelatedSystem[] {
  return (
    Array.isArray(payload) &&
    payload.every(
      (relatedSystem) =>
        typeof relatedSystem === "object" &&
        relatedSystem !== null &&
        Number.isInteger((relatedSystem as Record<string, unknown>).id) &&
        typeof (relatedSystem as Record<string, unknown>).name === "string",
    )
  );
}

function isTicketDetail(payload: unknown): payload is TicketDetail {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const ticket = payload as Record<string, unknown>;
  const requester = ticket.requester as Record<string, unknown> | undefined;
  const category = ticket.category as Record<string, unknown> | undefined;
  const relatedSystem = ticket.relatedSystem as
    | Record<string, unknown>
    | undefined;

  return (
    Number.isInteger(ticket.id) &&
    typeof ticket.ticketNumber === "string" &&
    typeof ticket.ticketDate === "string" &&
    typeof ticket.summary === "string" &&
    typeof ticket.description === "string" &&
    ["LOW", "MEDIUM", "HIGH"].includes(ticket.requestedPriority as string) &&
    ticket.currentStatus === "NEW" &&
    typeof ticket.createdAt === "string" &&
    typeof ticket.lastUpdated === "string" &&
    isReference(requester) &&
    isReference(category) &&
    isReference(relatedSystem) &&
    Array.isArray(ticket.attachments) &&
    ticket.attachments.every(isAttachmentMetadata)
  );
}

function isAttachmentMetadata(payload: unknown): payload is AttachmentMetadata {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const attachment = payload as Record<string, unknown>;
  return (
    Number.isInteger(attachment.id) &&
    typeof attachment.displayName === "string" &&
    typeof attachment.mimeType === "string" &&
    Number.isInteger(attachment.sizeBytes) &&
    typeof attachment.uploadedAt === "string" &&
    (typeof attachment.removedAt === "string" ||
      attachment.removedAt === null) &&
    (typeof attachment.removalReason === "string" ||
      attachment.removalReason === null) &&
    typeof attachment.isActive === "boolean" &&
    (typeof attachment.downloadUrl === "string" ||
      attachment.downloadUrl === null)
  );
}

function isTicketSummary(payload: unknown): payload is TicketSummary {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const ticket = payload as Record<string, unknown>;
  const requester = ticket.requester as Record<string, unknown> | undefined;
  const category = ticket.category as Record<string, unknown> | undefined;
  const relatedSystem = ticket.relatedSystem as
    | Record<string, unknown>
    | undefined;

  return (
    Number.isInteger(ticket.id) &&
    typeof ticket.ticketNumber === "string" &&
    typeof ticket.ticketDate === "string" &&
    typeof ticket.summary === "string" &&
    ["LOW", "MEDIUM", "HIGH"].includes(ticket.requestedPriority as string) &&
    ticket.currentStatus === "NEW" &&
    typeof ticket.lastUpdated === "string" &&
    isReference(requester) &&
    isReference(category) &&
    isReference(relatedSystem)
  );
}

function isTicketListResponse(payload: unknown): payload is TicketListResponse {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const list = payload as Record<string, unknown>;
  return (
    Array.isArray(list.items) &&
    list.items.every(isTicketSummary) &&
    Number.isInteger(list.page) &&
    Number.isInteger(list.pageSize) &&
    Number.isInteger(list.totalItems) &&
    Number.isInteger(list.totalPages)
  );
}

function isReference(
  value: Record<string, unknown> | null | undefined,
): value is { id: number; name: string } {
  return (
    value !== undefined &&
    value !== null &&
    Number.isInteger(value.id) &&
    typeof value.name === "string"
  );
}

function getApiErrorDetails(payload: unknown) {
  if (typeof payload !== "object" || payload === null) {
    return { code: undefined, fields: undefined };
  }

  const error = (payload as Record<string, unknown>).error;
  if (typeof error !== "object" || error === null) {
    return { code: undefined, fields: undefined };
  }

  const details = error as Record<string, unknown>;
  const fields = Array.isArray(details.fields)
    ? details.fields.filter(isApiErrorField)
    : undefined;

  return {
    code: typeof details.code === "string" ? details.code : undefined,
    fields: fields?.length ? fields : undefined,
  };
}

function isApiErrorField(value: unknown): value is ApiErrorField {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const field = value as Record<string, unknown>;
  return (
    typeof field.field === "string" &&
    typeof field.code === "string" &&
    typeof field.message === "string"
  );
}

function throwApiRequestError(payload: unknown): never {
  const { code, fields } = getApiErrorDetails(payload);
  throw new ApiRequestError(code, fields);
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/health");
  const payload = await readJson(response);

  if (!response.ok || !isHealthResponse(payload)) {
    throw new ApiRequestError();
  }

  return payload;
}

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch("/api/categories");
  const payload = await readJson(response);

  if (!response.ok || !isCategoryList(payload)) {
    throwApiRequestError(payload);
  }

  return payload;
}

export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const response = await fetch("/api/related-systems");
  const payload = await readJson(response);

  if (!response.ok || !isRelatedSystemList(payload)) {
    throwApiRequestError(payload);
  }

  return payload;
}

export async function fetchDevelopmentRequesters(): Promise<
  DevelopmentRequester[]
> {
  const response = await fetch("/api/development-requesters");
  const payload = await readJson(response);

  if (!response.ok || !isDevelopmentRequesterList(payload)) {
    throwApiRequestError(payload);
  }

  return payload;
}

export async function createTicket(
  requesterId: number,
  input: CreateTicketInput,
): Promise<TicketDetail> {
  const response = await fetch("/api/tickets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Development-Requester-Id": String(requesterId),
    },
    body: JSON.stringify(input),
  });
  const payload = await readJson(response);

  if (!response.ok || !isTicketDetail(payload)) {
    throwApiRequestError(payload);
  }

  return payload;
}

export async function fetchTicketDetail(
  requesterId: number,
  ticketId: number | string,
): Promise<TicketDetail> {
  const response = await fetch(`/api/tickets/${ticketId}`, {
    headers: {
      "X-Development-Requester-Id": String(requesterId),
    },
  });
  const payload = await readJson(response);

  if (!response.ok || !isTicketDetail(payload)) {
    throwApiRequestError(payload);
  }

  return payload;
}

export async function fetchTicketAttachments(
  requesterId: number,
  ticketId: number | string,
): Promise<AttachmentMetadata[]> {
  const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
    headers: {
      "X-Development-Requester-Id": String(requesterId),
    },
  });
  const payload = await readJson(response);

  if (
    !response.ok ||
    !Array.isArray(payload) ||
    !payload.every(isAttachmentMetadata)
  ) {
    throwApiRequestError(payload);
  }

  return payload;
}

export async function uploadTicketAttachment(
  requesterId: number,
  ticketId: number | string,
  file: File,
): Promise<AttachmentMetadata> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    headers: {
      "X-Development-Requester-Id": String(requesterId),
    },
    body: formData,
  });
  const payload = await readJson(response);

  if (!response.ok || !isAttachmentMetadata(payload)) {
    throwApiRequestError(payload);
  }

  return payload;
}

export async function downloadTicketAttachment(
  requesterId: number,
  ticketId: number | string,
  attachmentId: number | string,
): Promise<Blob> {
  const response = await fetch(
    `/api/tickets/${ticketId}/attachments/${attachmentId}/download`,
    {
      headers: {
        "X-Development-Requester-Id": String(requesterId),
      },
    },
  );

  if (!response.ok) {
    throwApiRequestError(await readJson(response));
  }

  return response.blob();
}

export async function removeTicketAttachment(
  requesterId: number,
  ticketId: number | string,
  attachmentId: number | string,
  removalReason: string,
): Promise<void> {
  const response = await fetch(
    `/api/tickets/${ticketId}/attachments/${attachmentId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-Development-Requester-Id": String(requesterId),
      },
      body: JSON.stringify({ removalReason }),
    },
  );

  if (!response.ok) {
    throwApiRequestError(await readJson(response));
  }
}

export async function fetchTickets(
  requesterId: number,
  query: TicketListQuery = {},
  signal?: AbortSignal,
): Promise<TicketListResponse> {
  const searchParams = new URLSearchParams();
  const entries: Array<[string, string | number | undefined]> = [
    ["search", query.search?.trim() || undefined],
    ["categoryId", query.categoryId],
    ["relatedSystemId", query.relatedSystemId],
    ["requestedPriority", query.requestedPriority],
    ["currentStatus", query.currentStatus],
    ["sortBy", query.sortBy],
    ["sortDirection", query.sortDirection],
    ["page", query.page],
    ["pageSize", query.pageSize],
  ];

  for (const [key, value] of entries) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  const response = await fetch(
    queryString ? `/api/tickets?${queryString}` : "/api/tickets",
    {
      headers: {
        "X-Development-Requester-Id": String(requesterId),
      },
      signal,
    },
  );
  const payload = await readJson(response);

  if (!response.ok || !isTicketListResponse(payload)) {
    throwApiRequestError(payload);
  }

  return payload;
}
