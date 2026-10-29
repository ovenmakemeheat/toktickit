import { rm } from "node:fs/promises";
import { resolve } from "node:path";

export async function removeE2eAttachment(storageKey: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(storageKey)) {
    throw new Error("Refusing to remove an invalid attachment storage key.");
  }

  const storageDirectory = resolve(
    process.env.ATTACHMENT_STORAGE_DIR ?? "server/.local-storage/attachments",
  );
  await rm(resolve(storageDirectory, storageKey), { force: true });
}
