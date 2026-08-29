import { useState, type ChangeEvent } from "react";

import {
  apiErrorMessage,
  ApiRequestError,
  downloadTicketAttachment,
  removeTicketAttachment,
  type AttachmentMetadata,
  uploadTicketAttachment,
} from "../lib/api";
import {
  maxActiveAttachmentCount,
  validateAttachmentSelection,
  validateRemovalReason,
} from "../lib/attachment-policy";

type AttachmentSectionProps = {
  requesterId: number;
  ticketId: number | string;
  attachments: AttachmentMetadata[];
  onChanged: () => Promise<void>;
};

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function getAttachmentErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case "ACTIVE_ATTACHMENT_LIMIT_REACHED":
        return "This Ticket already has five active attachments.";
      case "ATTACHMENT_STORAGE_UNAVAILABLE":
        return "Attachment storage is temporarily unavailable. Try again.";
      case "ATTACHMENT_TOO_LARGE":
        return "Each attachment must be 5 MB or smaller.";
      case "ATTACHMENT_TYPE_NOT_ALLOWED":
        return "Only JPG, JPEG, PNG, WEBP, and PDF files are allowed.";
      case "ATTACHMENT_REMOVED":
        return "This attachment has already been removed.";
      case "ATTACHMENT_ALREADY_REMOVED":
        return "This attachment has already been removed.";
      default:
        return apiErrorMessage;
    }
  }

  return apiErrorMessage;
}

function triggerBrowserDownload(blob: Blob, displayName: string) {
  if (typeof URL.createObjectURL !== "function") {
    throw new Error("Browser download support is unavailable");
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = displayName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export default function AttachmentSection({
  requesterId,
  ticketId,
  attachments,
  onChanged,
}: AttachmentSectionProps) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [removalTarget, setRemovalTarget] = useState<number | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const activeAttachmentCount = attachments.filter(
    (attachment) => attachment.isActive,
  ).length;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setPendingFile(file);
    setFileError(null);
    setUploadError(null);
    setUploadSuccess(null);

    if (!file) {
      return;
    }

    const validation = validateAttachmentSelection(
      [file],
      activeAttachmentCount,
    )[0];
    if (validation?.error) {
      setPendingFile(null);
      setFileError(validation.error);
    }
  }

  async function handleUpload() {
    if (!pendingFile || isUploading) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      await uploadTicketAttachment(requesterId, ticketId, pendingFile);
      setPendingFile(null);
      setUploadSuccess("Attachment uploaded successfully.");
      await onChanged();
    } catch (error) {
      setUploadError(getAttachmentErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload(attachment: AttachmentMetadata) {
    setDownloadingId(attachment.id);
    setDownloadError(null);

    try {
      const blob = await downloadTicketAttachment(
        requesterId,
        ticketId,
        attachment.id,
      );
      triggerBrowserDownload(blob, attachment.displayName);
    } catch (error) {
      setDownloadError(getAttachmentErrorMessage(error));
    } finally {
      setDownloadingId(null);
    }
  }

  function beginRemoval(attachmentId: number) {
    setRemovalTarget(attachmentId);
    setRemovalReason("");
    setRemovalError(null);
  }

  function cancelRemoval() {
    setRemovalTarget(null);
    setRemovalReason("");
    setRemovalError(null);
  }

  async function confirmRemoval(attachmentId: number) {
    const validationError = validateRemovalReason(removalReason);
    if (validationError) {
      setRemovalError(validationError);
      return;
    }

    setRemovingId(attachmentId);
    setRemovalError(null);

    try {
      await removeTicketAttachment(
        requesterId,
        ticketId,
        attachmentId,
        removalReason.trim(),
      );
      cancelRemoval();
      setUploadSuccess("Attachment removed. Its metadata is retained.");
      await onChanged();
    } catch (error) {
      setRemovalError(getAttachmentErrorMessage(error));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section
      className="lab2-attachment-section"
      aria-labelledby="attachments-title"
    >
      <div className="lab2-page-heading">
        <div>
          <p className="lab2-eyebrow">Ticket evidence</p>
          <h2 id="attachments-title">Attachments</h2>
          <p className="lab2-introduction">
            Active files can be downloaded or removed. Removed files remain as
            metadata and cannot be previewed or downloaded.
          </p>
        </div>
        <span className="lab2-attachment-count">
          {activeAttachmentCount}/{maxActiveAttachmentCount} active
        </span>
      </div>

      <div className="lab2-attachment-upload">
        <label className="form-label" htmlFor="ticket-attachment-upload">
          Upload attachment
        </label>
        <input
          id="ticket-attachment-upload"
          className="form-control"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          disabled={
            isUploading || activeAttachmentCount >= maxActiveAttachmentCount
          }
          onChange={handleFileChange}
          aria-describedby="ticket-attachment-guidance"
        />
        <div id="ticket-attachment-guidance" className="form-text">
          One JPG, JPEG, PNG, WEBP, or PDF file; up to 5 MB. A Ticket can have
          at most five active attachments.
        </div>
        {pendingFile ? (
          <div className="lab2-attachment-pending">
            <span>
              Selected: {pendingFile.name} ({formatFileSize(pendingFile.size)})
            </span>
            <button
              type="button"
              className="btn btn-success"
              onClick={() => void handleUpload()}
              disabled={isUploading}
            >
              {isUploading ? "Uploading..." : "Upload attachment"}
            </button>
          </div>
        ) : null}
        {fileError ? (
          <div className="lab2-field-error" role="alert">
            {fileError}
          </div>
        ) : null}
        {uploadError ? (
          <div className="lab2-state lab2-state-error" role="alert">
            <span>{uploadError}</span>
            {pendingFile ? (
              <button
                type="button"
                className="btn btn-outline-success"
                onClick={() => void handleUpload()}
                disabled={isUploading}
              >
                Retry upload
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {uploadSuccess ? (
        <p className="lab2-state lab2-state-success" role="status">
          {uploadSuccess}
        </p>
      ) : null}

      {downloadError ? (
        <p className="lab2-state lab2-state-error" role="alert">
          {downloadError}
        </p>
      ) : null}

      {attachments.length === 0 ? (
        <p className="lab2-state" role="status">
          No attachments have been uploaded for this Ticket.
        </p>
      ) : (
        <ul className="lab2-attachment-records" aria-label="Ticket attachments">
          {attachments.map((attachment) => (
            <li
              className={
                attachment.isActive
                  ? "lab2-attachment-record"
                  : "lab2-attachment-record lab2-attachment-record-removed"
              }
              key={attachment.id}
            >
              <div className="lab2-attachment-record-details">
                <strong>{attachment.displayName}</strong>
                <span>
                  {attachment.mimeType} · {formatFileSize(attachment.sizeBytes)}
                </span>
                <span>Uploaded {formatDate(attachment.uploadedAt)}</span>
                {attachment.isActive ? (
                  <span className="lab2-attachment-ready">Active</span>
                ) : (
                  <span className="lab2-attachment-removed">
                    Removed
                    {attachment.removedAt
                      ? ` ${formatDate(attachment.removedAt)}`
                      : ""}
                    {attachment.removalReason
                      ? `: ${attachment.removalReason}`
                      : ""}
                  </span>
                )}
              </div>

              {attachment.isActive ? (
                <div className="lab2-form-actions">
                  <button
                    type="button"
                    className="btn btn-outline-success"
                    onClick={() => void handleDownload(attachment)}
                    disabled={downloadingId === attachment.id}
                  >
                    {downloadingId === attachment.id
                      ? "Downloading..."
                      : "Download"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={() => beginRemoval(attachment.id)}
                    disabled={removingId !== null}
                  >
                    Remove
                  </button>
                </div>
              ) : null}

              {removalTarget === attachment.id && attachment.isActive ? (
                <fieldset className="lab2-attachment-removal">
                  <legend>Confirm attachment removal</legend>
                  <label
                    className="form-label"
                    htmlFor={`removal-reason-${attachment.id}`}
                  >
                    Removal reason
                  </label>
                  <textarea
                    id={`removal-reason-${attachment.id}`}
                    className="form-control"
                    rows={3}
                    maxLength={200}
                    value={removalReason}
                    onChange={(event) => setRemovalReason(event.target.value)}
                    aria-describedby={`removal-reason-help-${attachment.id}`}
                    aria-invalid={removalError ? true : undefined}
                  />
                  <div
                    id={`removal-reason-help-${attachment.id}`}
                    className="form-text"
                  >
                    Required. Use 3-200 characters explaining why the file is
                    being removed.
                  </div>
                  {removalError ? (
                    <div className="lab2-field-error" role="alert">
                      {removalError}
                    </div>
                  ) : null}
                  <div className="lab2-form-actions">
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => void confirmRemoval(attachment.id)}
                      disabled={removingId === attachment.id}
                    >
                      {removingId === attachment.id
                        ? "Removing..."
                        : "Confirm removal"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={cancelRemoval}
                      disabled={removingId === attachment.id}
                    >
                      Cancel
                    </button>
                  </div>
                </fieldset>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
