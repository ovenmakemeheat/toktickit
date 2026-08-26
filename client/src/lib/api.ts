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

type HealthResponse = {
  service: string;
  status: "ok";
};

export class ApiRequestError extends Error {
  constructor() {
    super(apiErrorMessage);
    this.name = "ApiRequestError";
  }
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
    throw new ApiRequestError();
  }

  return payload;
}

export async function fetchDevelopmentRequesters(): Promise<
  DevelopmentRequester[]
> {
  const response = await fetch("/api/development-requesters");
  const payload = await readJson(response);

  if (!response.ok || !isDevelopmentRequesterList(payload)) {
    throw new ApiRequestError();
  }

  return payload;
}
