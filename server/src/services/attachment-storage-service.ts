import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

export class AttachmentStorageUnavailableError extends Error {
  readonly code = "ATTACHMENT_STORAGE_UNAVAILABLE";

  constructor() {
    super("Attachment storage is unavailable");
    this.name = "AttachmentStorageUnavailableError";
  }
}

export type AttachmentStorage = {
  save: (storageKey: string, content: Buffer) => Promise<void>;
  read: (storageKey: string) => Promise<Buffer>;
  remove: (storageKey: string) => Promise<void>;
};

const defaultStorageDirectory = fileURLToPath(
  new URL("../../.local-storage/attachments/", import.meta.url),
);

function storageDirectory() {
  return path.resolve(
    process.env.ATTACHMENT_STORAGE_DIR ?? defaultStorageDirectory,
  );
}

function storagePath(storageKey: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(storageKey)) {
    throw new AttachmentStorageUnavailableError();
  }

  const directory = storageDirectory();
  const resolved = path.resolve(directory, storageKey);
  if (
    resolved !== directory &&
    !resolved.startsWith(`${directory}${path.sep}`)
  ) {
    throw new AttachmentStorageUnavailableError();
  }

  return resolved;
}

async function save(storageKey: string, content: Buffer) {
  try {
    const filePath = storagePath(storageKey);
    await mkdir(storageDirectory(), { recursive: true });
    await writeFile(filePath, content, { flag: "wx" });
  } catch {
    throw new AttachmentStorageUnavailableError();
  }
}

async function read(storageKey: string) {
  try {
    return await readFile(storagePath(storageKey));
  } catch {
    throw new AttachmentStorageUnavailableError();
  }
}

async function remove(storageKey: string) {
  try {
    await unlink(storagePath(storageKey));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw new AttachmentStorageUnavailableError();
  }
}

export const localAttachmentStorage: AttachmentStorage = { save, read, remove };

export function generateStorageKey() {
  return `${randomUUID()}-${randomUUID()}`;
}
