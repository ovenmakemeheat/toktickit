export const apiErrorMessage = "Unable to connect to TokTickIT API";

export type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
export type RequestedPriority = "LOW" | "MEDIUM" | "HIGH";
export type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

export type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
};

export type Category = {
  id: number;
  name: string;
};

export type RelatedSystem = Category;

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
  currentStatus?: TicketStatus;
  sortBy?: TicketSortBy;
  sortDirection?: TicketSortDirection;
  page?: number;
  pageSize?: 10 | 20 | 50;
};

export type TicketCommunicationEntry = {
  id: number;
  author: { id: number; name: string; role: Role };
  content: string;
  createdAt: string;
};

export type StaffOwner = {
  id: number;
  name: string;
  role: "IT_STAFF" | "ADMINISTRATOR";
};

export type StaffTicketSortBy =
  | "ticketDate"
  | "updatedAt"
  | "ticketNumber"
  | "itPriority"
  | "currentStatus"
  | "owner";

export type StaffTicketListQuery = {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: RequestedPriority;
  itPriority?: RequestedPriority;
  currentStatus?: TicketStatus;
  owner?: "unassigned" | "me" | number;
  sortBy?: StaffTicketSortBy;
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
  currentStatus: TicketStatus;
  requesterResolutionIndicatedAt?: string | null;
  createdAt: string;
  lastUpdated: string;
  publicComments?: TicketCommunicationEntry[];
  attachments: AttachmentMetadata[];
};

export type StaffTicketSummary = {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  requester: { id: number; name: string };
  category: Category;
  relatedSystem: RelatedSystem;
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  summary: string;
  currentStatus: TicketStatus;
  owner: StaffOwner | null;
  lastUpdated: string;
};

export type StaffTicketListResponse = {
  items: StaffTicketSummary[];
  eligibleOwners: StaffOwner[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type StaffTicketDetail = {
  id: number;
  ticketNumber: string;
  ticketDate: string;
  requester: { id: number; name: string };
  category: Category;
  relatedSystem: RelatedSystem;
  requestedPriority: RequestedPriority;
  itPriority: RequestedPriority;
  summary: string;
  description: string;
  currentStatus: TicketStatus;
  owner: StaffOwner | null;
  eligibleOwners?: StaffOwner[];
  requesterResolutionIndicatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: AttachmentMetadata[];
  publicComments: TicketCommunicationEntry[];
  internalNotes: TicketCommunicationEntry[];
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

export type AuthResponse = {
  user: PublicUser;
  session: { expiresAt: string };
  csrfToken: string;
};

let csrfToken: string | undefined;

export class ApiRequestError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly fields: ApiErrorField[] | undefined;

  constructor(
    status?: number,
    code?: string,
    fields?: ApiErrorField[],
    message = apiErrorMessage,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export type ApiErrorField = {
  field: string;
  code: string;
  message: string;
};

function readCookie(name: string) {
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : undefined;
}

export function setCsrfToken(token: string | undefined) {
  csrfToken = token;
}

function currentCsrfToken() {
  return csrfToken ?? readCookie("toktickit_csrf");
}

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

function isReference(value: unknown): value is Category {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const reference = value as Record<string, unknown>;
  return Number.isInteger(reference.id) && typeof reference.name === "string";
}

function isCategoryList(payload: unknown): payload is Category[] {
  return Array.isArray(payload) && payload.every(isReference);
}

function isRelatedSystemList(payload: unknown): payload is RelatedSystem[] {
  return isCategoryList(payload);
}

function isRole(value: unknown): value is Role {
  return ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"].includes(value as string);
}

function isPublicUser(payload: unknown): payload is PublicUser {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const user = payload as Record<string, unknown>;
  return (
    Number.isInteger(user.id) &&
    typeof user.name === "string" &&
    typeof user.email === "string" &&
    isRole(user.role) &&
    typeof user.active === "boolean" &&
    typeof user.mustChangePassword === "boolean"
  );
}

function isAuthResponse(payload: unknown): payload is AuthResponse {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const response = payload as Record<string, unknown>;
  const session = response.session as Record<string, unknown> | undefined;
  return (
    isPublicUser(response.user) &&
    typeof response.csrfToken === "string" &&
    session !== undefined &&
    typeof session.expiresAt === "string"
  );
}

function isTicketStatus(value: unknown): value is TicketStatus {
  return [
    "NEW",
    "OPEN",
    "IN_PROGRESS",
    "WAITING_FOR_REQUESTER",
    "RESOLVED",
    "CLOSED",
    "REOPENED",
    "CANCELLED",
  ].includes(value as string);
}

function isPriority(value: unknown): value is RequestedPriority {
  return ["LOW", "MEDIUM", "HIGH"].includes(value as string);
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

function isTicketDetail(payload: unknown): payload is TicketDetail {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const ticket = payload as Record<string, unknown>;
  return (
    Number.isInteger(ticket.id) &&
    typeof ticket.ticketNumber === "string" &&
    typeof ticket.ticketDate === "string" &&
    typeof ticket.summary === "string" &&
    typeof ticket.description === "string" &&
    isPriority(ticket.requestedPriority) &&
    isTicketStatus(ticket.currentStatus) &&
    (ticket.requesterResolutionIndicatedAt === undefined ||
      typeof ticket.requesterResolutionIndicatedAt === "string" ||
      ticket.requesterResolutionIndicatedAt === null) &&
    typeof ticket.createdAt === "string" &&
    typeof ticket.lastUpdated === "string" &&
    isReference(ticket.requester) &&
    isReference(ticket.category) &&
    isReference(ticket.relatedSystem) &&
    (ticket.publicComments === undefined ||
      (Array.isArray(ticket.publicComments) &&
        ticket.publicComments.every(isCommunicationEntry))) &&
    Array.isArray(ticket.attachments) &&
    ticket.attachments.every(isAttachmentMetadata)
  );
}

function isTicketSummary(payload: unknown): payload is TicketSummary {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const ticket = payload as Record<string, unknown>;
  return (
    Number.isInteger(ticket.id) &&
    typeof ticket.ticketNumber === "string" &&
    typeof ticket.ticketDate === "string" &&
    typeof ticket.summary === "string" &&
    isPriority(ticket.requestedPriority) &&
    isTicketStatus(ticket.currentStatus) &&
    typeof ticket.lastUpdated === "string" &&
    isReference(ticket.requester) &&
    isReference(ticket.category) &&
    isReference(ticket.relatedSystem)
  );
}

function isCommunicationEntry(
  payload: unknown,
): payload is TicketCommunicationEntry {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const entry = payload as Record<string, unknown>;
  const author = entry.author as Record<string, unknown> | undefined;
  return (
    Number.isInteger(entry.id) &&
    typeof entry.content === "string" &&
    typeof entry.createdAt === "string" &&
    author !== undefined &&
    Number.isInteger(author.id) &&
    typeof author.name === "string" &&
    isRole(author.role)
  );
}

function isStaffOwner(payload: unknown): payload is StaffOwner {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const owner = payload as Record<string, unknown>;
  return (
    Number.isInteger(owner.id) &&
    typeof owner.name === "string" &&
    (owner.role === "IT_STAFF" || owner.role === "ADMINISTRATOR")
  );
}

function isStaffTicketSummary(payload: unknown): payload is StaffTicketSummary {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const ticket = payload as Record<string, unknown>;
  return (
    Number.isInteger(ticket.id) &&
    typeof ticket.ticketNumber === "string" &&
    typeof ticket.ticketDate === "string" &&
    typeof ticket.summary === "string" &&
    isPriority(ticket.requestedPriority) &&
    isPriority(ticket.itPriority) &&
    isTicketStatus(ticket.currentStatus) &&
    typeof ticket.lastUpdated === "string" &&
    isReference(ticket.requester) &&
    isReference(ticket.category) &&
    isReference(ticket.relatedSystem) &&
    (ticket.owner === null || isStaffOwner(ticket.owner))
  );
}

function isStaffTicketListResponse(
  payload: unknown,
): payload is StaffTicketListResponse {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const list = payload as Record<string, unknown>;
  return (
    Array.isArray(list.items) &&
    list.items.every(isStaffTicketSummary) &&
    Array.isArray(list.eligibleOwners) &&
    list.eligibleOwners.every(isStaffOwner) &&
    Number.isInteger(list.page) &&
    Number.isInteger(list.pageSize) &&
    Number.isInteger(list.totalItems) &&
    Number.isInteger(list.totalPages)
  );
}

function isStaffTicketDetail(payload: unknown): payload is StaffTicketDetail {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const ticket = payload as Record<string, unknown>;
  return (
    Number.isInteger(ticket.id) &&
    typeof ticket.ticketNumber === "string" &&
    typeof ticket.ticketDate === "string" &&
    typeof ticket.summary === "string" &&
    typeof ticket.description === "string" &&
    isPriority(ticket.requestedPriority) &&
    isPriority(ticket.itPriority) &&
    isTicketStatus(ticket.currentStatus) &&
    isReference(ticket.requester) &&
    isReference(ticket.category) &&
    isReference(ticket.relatedSystem) &&
    (ticket.owner === null || isStaffOwner(ticket.owner)) &&
    (ticket.eligibleOwners === undefined ||
      (Array.isArray(ticket.eligibleOwners) &&
        ticket.eligibleOwners.every(isStaffOwner))) &&
    (typeof ticket.requesterResolutionIndicatedAt === "string" ||
      ticket.requesterResolutionIndicatedAt === null) &&
    typeof ticket.createdAt === "string" &&
    typeof ticket.updatedAt === "string" &&
    Array.isArray(ticket.attachments) &&
    ticket.attachments.every(isAttachmentMetadata) &&
    Array.isArray(ticket.publicComments) &&
    ticket.publicComments.every(isCommunicationEntry) &&
    Array.isArray(ticket.internalNotes) &&
    ticket.internalNotes.every(isCommunicationEntry)
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

function getApiErrorDetails(payload: unknown) {
  if (typeof payload !== "object" || payload === null) {
    return { code: undefined, fields: undefined, message: undefined };
  }

  const error = (payload as Record<string, unknown>).error;
  if (typeof error !== "object" || error === null) {
    return { code: undefined, fields: undefined, message: undefined };
  }

  const details = error as Record<string, unknown>;
  const fields = Array.isArray(details.fields)
    ? details.fields.filter(isApiErrorField)
    : undefined;

  return {
    code: typeof details.code === "string" ? details.code : undefined,
    fields: fields?.length ? fields : undefined,
    message: typeof details.message === "string" ? details.message : undefined,
  };
}

function throwApiRequestError(response: Response, payload: unknown): never {
  const { code, fields, message } = getApiErrorDetails(payload);
  throw new ApiRequestError(response.status, code, fields, message);
}

async function requestJson(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = init.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init.headers);
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const token = currentCsrfToken();
    if (token) {
      headers.set("X-CSRF-Token", token);
    }
  }
  const response = await fetch(input, {
    ...init,
    credentials: "same-origin",
    headers,
  });
  const payload = await readJson(response);
  return { response, payload };
}

export async function fetchHealth(): Promise<HealthResponse> {
  const { response, payload } = await requestJson("/api/health");
  if (!response.ok || !isHealthResponse(payload)) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { response, payload } = await requestJson("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok || !isAuthResponse(payload)) {
    throwApiRequestError(response, payload);
  }
  setCsrfToken(payload.csrfToken);
  return payload;
}

export async function fetchCurrentUser(): Promise<AuthResponse> {
  const { response, payload } = await requestJson("/api/auth/me");
  if (!response.ok || !isAuthResponse(payload)) {
    throwApiRequestError(response, payload);
  }
  setCsrfToken(payload.csrfToken);
  return payload;
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<AuthResponse> {
  const { response, payload } = await requestJson("/api/auth/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok || !isAuthResponse(payload)) {
    throwApiRequestError(response, payload);
  }
  setCsrfToken(payload.csrfToken);
  return payload;
}

export async function logout() {
  const { response, payload } = await requestJson("/api/auth/logout", {
    method: "POST",
  });
  if (!response.ok) {
    throwApiRequestError(response, payload);
  }
  setCsrfToken(undefined);
}

export async function fetchCategories(): Promise<Category[]> {
  const { response, payload } = await requestJson("/api/categories");
  if (!response.ok || !isCategoryList(payload)) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  const { response, payload } = await requestJson("/api/related-systems");
  if (!response.ok || !isRelatedSystemList(payload)) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function createTicket(
  input: CreateTicketInput,
): Promise<TicketDetail> {
  const { response, payload } = await requestJson("/api/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok || !isTicketDetail(payload)) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function fetchTicketDetail(
  ticketId: number | string,
): Promise<TicketDetail> {
  const { response, payload } = await requestJson(`/api/tickets/${ticketId}`);
  if (!response.ok || !isTicketDetail(payload)) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function fetchTicketAttachments(
  ticketId: number | string,
): Promise<AttachmentMetadata[]> {
  const { response, payload } = await requestJson(
    `/api/tickets/${ticketId}/attachments`,
  );
  if (
    !response.ok ||
    !Array.isArray(payload) ||
    !payload.every(isAttachmentMetadata)
  ) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function uploadTicketAttachment(
  ticketId: number | string,
  file: File,
): Promise<AttachmentMetadata> {
  const formData = new FormData();
  formData.append("file", file);
  const { response, payload } = await requestJson(
    `/api/tickets/${ticketId}/attachments`,
    {
      method: "POST",
      body: formData,
    },
  );
  if (!response.ok || !isAttachmentMetadata(payload)) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function downloadTicketAttachment(
  ticketId: number | string,
  attachmentId: number | string,
): Promise<Blob> {
  const response = await fetch(
    `/api/tickets/${ticketId}/attachments/${attachmentId}/download`,
    { credentials: "same-origin" },
  );
  if (!response.ok) {
    throwApiRequestError(response, await readJson(response));
  }
  return response.blob();
}

export async function removeTicketAttachment(
  ticketId: number | string,
  attachmentId: number | string,
  removalReason: string,
): Promise<void> {
  const { response, payload } = await requestJson(
    `/api/tickets/${ticketId}/attachments/${attachmentId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removalReason }),
    },
  );
  if (!response.ok) {
    throwApiRequestError(response, payload);
  }
}

export async function fetchTickets(
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
  const { response, payload } = await requestJson(
    queryString ? `/api/tickets?${queryString}` : "/api/tickets",
    { signal },
  );
  if (!response.ok || !isTicketListResponse(payload)) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

function buildStaffTicketQuery(query: StaffTicketListQuery) {
  const searchParams = new URLSearchParams();
  const entries: Array<[string, string | number | undefined]> = [
    ["search", query.search?.trim() || undefined],
    ["categoryId", query.categoryId],
    ["relatedSystemId", query.relatedSystemId],
    ["requestedPriority", query.requestedPriority],
    ["itPriority", query.itPriority],
    ["currentStatus", query.currentStatus],
    ["owner", query.owner],
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
  return searchParams.toString();
}

export async function fetchStaffTickets(
  query: StaffTicketListQuery = {},
  signal?: AbortSignal,
): Promise<StaffTicketListResponse> {
  const queryString = buildStaffTicketQuery(query);
  const { response, payload } = await requestJson(
    queryString ? `/api/staff/tickets?${queryString}` : "/api/staff/tickets",
    { signal },
  );
  if (!response.ok || !isStaffTicketListResponse(payload)) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function fetchStaffTicketDetail(
  ticketId: number | string,
): Promise<StaffTicketDetail> {
  const { response, payload } = await requestJson(
    `/api/staff/tickets/${ticketId}`,
  );
  if (!response.ok || !isStaffTicketDetail(payload)) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function claimStaffTicket(
  ticketId: number | string,
): Promise<StaffTicketDetail> {
  const { response, payload } = await requestJson(
    `/api/staff/tickets/${ticketId}/claim`,
    { method: "POST" },
  );
  if (!response.ok || !isStaffTicketDetail(payload)) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function assignStaffTicket(
  ticketId: number | string,
  ownerId: number,
): Promise<StaffTicketDetail> {
  const { response, payload } = await requestJson(
    `/api/staff/tickets/${ticketId}/owner`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId }),
    },
  );
  if (!response.ok || !isStaffTicketDetail(payload)) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function updateStaffTicketPriority(
  ticketId: number | string,
  itPriority: RequestedPriority,
): Promise<StaffTicketDetail> {
  const { response, payload } = await requestJson(
    `/api/staff/tickets/${ticketId}/priority`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itPriority }),
    },
  );
  if (!response.ok || !isStaffTicketDetail(payload)) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function updateStaffTicketStatus(
  ticketId: number | string,
  status: TicketStatus,
  confirmation = false,
): Promise<StaffTicketDetail> {
  const { response, payload } = await requestJson(
    `/api/staff/tickets/${ticketId}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, confirmation }),
    },
  );
  if (!response.ok || !isStaffTicketDetail(payload)) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function fetchPublicComments(
  ticketId: number | string,
): Promise<TicketCommunicationEntry[]> {
  const { response, payload } = await requestJson(
    `/api/tickets/${ticketId}/comments`,
  );
  if (
    !response.ok ||
    !Array.isArray(payload) ||
    !payload.every(isCommunicationEntry)
  ) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function postPublicComment(
  ticketId: number | string,
  content: string,
): Promise<TicketCommunicationEntry> {
  const { response, payload } = await requestJson(
    `/api/tickets/${ticketId}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    },
  );
  if (!response.ok || !isCommunicationEntry(payload)) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function fetchInternalNotes(
  ticketId: number | string,
): Promise<TicketCommunicationEntry[]> {
  const { response, payload } = await requestJson(
    `/api/tickets/${ticketId}/internal-notes`,
  );
  if (
    !response.ok ||
    !Array.isArray(payload) ||
    !payload.every(isCommunicationEntry)
  ) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function postInternalNote(
  ticketId: number | string,
  content: string,
): Promise<TicketCommunicationEntry> {
  const { response, payload } = await requestJson(
    `/api/tickets/${ticketId}/internal-notes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    },
  );
  if (!response.ok || !isCommunicationEntry(payload)) {
    throwApiRequestError(response, payload);
  }
  return payload;
}

export async function indicateTicketResolution(
  ticketId: number | string,
): Promise<{ ticketId: number; requesterResolutionIndicatedAt: string }> {
  const { response, payload } = await requestJson(
    `/api/tickets/${ticketId}/resolution-indication`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appearsResolved: true }),
    },
  );
  if (
    !response.ok ||
    typeof payload !== "object" ||
    payload === null ||
    !Number.isInteger((payload as Record<string, unknown>).ticketId) ||
    typeof (payload as Record<string, unknown>)
      .requesterResolutionIndicatedAt !== "string"
  ) {
    throwApiRequestError(response, payload);
  }
  return payload as {
    ticketId: number;
    requesterResolutionIndicatedAt: string;
  };
}
