export const maxAttachmentSizeBytes = 5 * 1024 * 1024;
export const maxActiveAttachmentCount = 5;

const allowedMimeTypesByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

export type AttachmentValidationResult = {
  file: File;
  error: string | null;
};

export function validateAttachmentFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const expectedMimeType = allowedMimeTypesByExtension[extension];

  if (!expectedMimeType) {
    return "Only JPG, JPEG, PNG, WEBP, and PDF files are allowed.";
  }

  if (file.type.toLowerCase() !== expectedMimeType) {
    return "The file type does not match its filename extension.";
  }

  if (file.size > maxAttachmentSizeBytes) {
    return "Each attachment must be 5 MB or smaller.";
  }

  return null;
}

export function validateAttachmentSelection(
  files: readonly File[],
  activeAttachmentCount = 0,
): AttachmentValidationResult[] {
  let acceptedCount = 0;

  return files.map((file) => {
    const fileError = validateAttachmentFile(file);
    if (fileError) {
      return { file, error: fileError };
    }

    if (activeAttachmentCount + acceptedCount >= maxActiveAttachmentCount) {
      return {
        file,
        error: "A Ticket can have at most five active attachments.",
      };
    }

    acceptedCount += 1;
    return { file, error: null };
  });
}

export function validateRemovalReason(value: string): string | null {
  const reason = value.trim();
  if (reason.length < 3 || reason.length > 200) {
    return "Removal reason must contain 3-200 characters after trimming.";
  }

  return null;
}
