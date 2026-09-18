import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  apiErrorMessage,
  ApiRequestError,
  fetchAdminTicketDetail,
  updateAdminTicketPriority,
  type AdminTicketDetail as AdminTicketDetailType,
  type RequestedPriority,
} from "../lib/api";
import { navigate } from "../lib/navigation";
import { InternalNotesPanel, PublicCommentsPanel } from "./CommunicationPanels";

type AdminTicketReviewProps = {
  ticketId?: number | string;
  onBack: () => void;
};

const priorityOptions: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH"];

function readable(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase());
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

function detailError(error: unknown) {
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case "ADMIN_TICKET_FORBIDDEN":
        return "Administrator permission is required to review Tickets.";
      case "TICKET_NOT_FOUND":
        return "This Ticket is no longer available.";
      case "TICKET_ID_INVALID":
        return "Enter a positive Ticket ID.";
      case "SESSION_REQUIRED":
        return "Your session expired. Sign in again to continue.";
      default:
        return apiErrorMessage;
    }
  }
  return `${apiErrorMessage}. This Ticket could not be loaded.`;
}

function operationError(error: unknown) {
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case "IT_PRIORITY_INVALID":
        return "Choose a valid IT Priority.";
      case "ADMIN_TICKET_FORBIDDEN":
        return "Administrator permission is required to update IT Priority.";
      case "TICKET_NOT_FOUND":
        return "This Ticket is no longer available. Return to User Management.";
      case "CSRF_TOKEN_INVALID":
        return "The security token expired. Reload the page and try again.";
      default:
        return apiErrorMessage;
    }
  }
  return apiErrorMessage;
}

function ReadOnlyField({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: string;
}) {
  return (
    <div>
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="form-control lab2-readonly"
        value={value}
        readOnly
        aria-readonly="true"
      />
    </div>
  );
}

function AttachmentMetadata({
  attachments,
}: {
  attachments: AdminTicketDetailType["attachments"];
}) {
  return (
    <section
      className="lab3-communication-panel lab3-admin-attachments"
      aria-labelledby="admin-ticket-attachments-title"
    >
      <div className="lab2-page-heading">
        <div>
          <p className="lab2-eyebrow">Ticket evidence</p>
          <h2 id="admin-ticket-attachments-title">Attachments</h2>
          <p className="lab2-introduction">
            Existing attachment metadata is read-only in Administrator Ticket
            Review.
          </p>
        </div>
      </div>
      {attachments.length === 0 ? (
        <p className="lab2-state" role="status">
          No attachments have been uploaded for this Ticket.
        </p>
      ) : (
        <ul
          className="lab3-attachment-metadata-list"
          aria-label="Ticket attachments"
        >
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <strong>{attachment.displayName}</strong>
              <span>
                {attachment.mimeType} · {attachment.sizeBytes} bytes
              </span>
              <span>{attachment.isActive ? "Active" : "Removed"}</span>
              {attachment.removalReason ? (
                <span>Reason: {attachment.removalReason}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TicketIdEntry({ onOpen }: { onOpen: (ticketId: string) => void }) {
  const [ticketId, setTicketId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[1-9]\d*$/.test(ticketId)) {
      setValidationError("Enter a positive Ticket ID.");
      return;
    }
    setValidationError(null);
    onOpen(ticketId);
  }

  return (
    <section
      className="lab2-panel lab3-admin-ticket-review-panel"
      aria-labelledby="admin-ticket-review-title"
    >
      <div className="lab2-page-heading">
        <div>
          <p className="lab2-eyebrow">Administrator workspace</p>
          <h1 id="admin-ticket-review-title">Administrator Ticket Review</h1>
          <p className="lab2-introduction">
            Review a known Ticket without Queue or operational mutation access.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => navigate("/admin/users")}
        >
          User Management
        </button>
      </div>
      <form
        className="lab3-admin-ticket-entry"
        onSubmit={handleSubmit}
        noValidate
      >
        <label className="form-label" htmlFor="admin-ticket-id">
          Ticket ID <span aria-hidden="true">*</span>
        </label>
        <input
          id="admin-ticket-id"
          className="form-control"
          inputMode="numeric"
          value={ticketId}
          onChange={(event) => {
            setTicketId(event.target.value);
            setValidationError(null);
          }}
          aria-describedby={
            validationError ? "admin-ticket-id-error" : undefined
          }
          aria-invalid={validationError ? true : undefined}
          required
        />
        {validationError ? (
          <div
            id="admin-ticket-id-error"
            className="auth-field-error"
            role="alert"
          >
            {validationError}
          </div>
        ) : null}
        <button type="submit" className="btn btn-success">
          Open Ticket Review
        </button>
      </form>
    </section>
  );
}

export default function AdminTicketReview({
  ticketId,
  onBack,
}: AdminTicketReviewProps) {
  const [ticket, setTicket] = useState<AdminTicketDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(ticketId));
  const [loadError, setLoadError] = useState<unknown>(null);
  const [selectedPriority, setSelectedPriority] =
    useState<RequestedPriority | null>(null);
  const [operationErrorMessage, setOperationErrorMessage] = useState<
    string | null
  >(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadTicket = useCallback(async () => {
    if (!ticketId) {
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const nextTicket = await fetchAdminTicketDetail(ticketId);
      setTicket(nextTicket);
      setSelectedPriority(nextTicket.itPriority);
    } catch (error) {
      setTicket(null);
      setLoadError(error);
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  if (!ticketId) {
    return (
      <TicketIdEntry
        onOpen={(nextTicketId) => navigate(`/admin/tickets/${nextTicketId}`)}
      />
    );
  }

  const reviewTicketId = ticketId;

  async function handlePriority() {
    if (
      !selectedPriority ||
      selectedPriority === ticket?.itPriority ||
      isSaving
    ) {
      return;
    }
    setIsSaving(true);
    setOperationErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await updateAdminTicketPriority(
        reviewTicketId,
        selectedPriority,
      );
      setTicket(updated);
      setSelectedPriority(updated.itPriority);
      setSuccessMessage("IT Priority updated successfully.");
    } catch (error) {
      setOperationErrorMessage(operationError(error));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section
        className="lab2-panel lab3-admin-ticket-review-panel"
        aria-labelledby="admin-ticket-review-title"
      >
        <h1 id="admin-ticket-review-title">Administrator Ticket Review</h1>
        <p className="lab2-state" role="status" aria-live="polite">
          Loading Ticket Review...
        </p>
      </section>
    );
  }

  if (loadError || !ticket) {
    return (
      <section
        className="lab2-panel lab3-admin-ticket-review-panel"
        aria-labelledby="admin-ticket-review-title"
      >
        <h1 id="admin-ticket-review-title">Administrator Ticket Review</h1>
        <div className="lab2-state lab2-state-error" role="alert">
          <p>{detailError(loadError)}</p>
          <div className="lab2-form-actions">
            <button
              type="button"
              className="btn btn-outline-success"
              onClick={() => void loadTicket()}
            >
              Try again
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onBack}
            >
              Back to User Management
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="lab2-panel lab3-admin-ticket-review-panel"
      aria-labelledby="admin-ticket-review-title"
    >
      <div className="lab2-page-heading">
        <div>
          <p className="lab2-eyebrow">Administrator Ticket Review</p>
          <h1 id="admin-ticket-review-title">{ticket.ticketNumber}</h1>
          <p className="lab2-introduction">
            Review Ticket facts and communications. Only IT Priority can be
            changed from this view.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onBack}
        >
          Back to User Management
        </button>
      </div>

      {successMessage ? (
        <p
          className="lab2-state lab2-state-success"
          role="status"
          aria-live="polite"
        >
          {successMessage}
        </p>
      ) : null}
      {operationErrorMessage ? (
        <div className="lab2-state lab2-state-error" role="alert">
          {operationErrorMessage}
        </div>
      ) : null}

      <div className="lab2-readonly-grid lab3-admin-ticket-fields">
        <ReadOnlyField
          id="admin-ticket-date"
          label="Ticket Date"
          value={formatDate(ticket.ticketDate)}
        />
        <ReadOnlyField
          id="admin-ticket-requester"
          label="Requester"
          value={ticket.requester.name}
        />
        <ReadOnlyField
          id="admin-ticket-category"
          label="Category"
          value={ticket.category.name}
        />
        <ReadOnlyField
          id="admin-ticket-related-system"
          label="Related System"
          value={ticket.relatedSystem.name}
        />
        <ReadOnlyField
          id="admin-ticket-requested-priority"
          label="Requested Priority"
          value={readable(ticket.requestedPriority)}
        />
        <ReadOnlyField
          id="admin-ticket-status"
          label="Current Status"
          value={readable(ticket.currentStatus)}
        />
        <ReadOnlyField
          id="admin-ticket-owner"
          label="Owner"
          value={ticket.owner?.name ?? "Unassigned"}
        />
        <ReadOnlyField
          id="admin-ticket-last-updated"
          label="Last Updated"
          value={formatDate(ticket.updatedAt)}
        />
      </div>

      <div className="mb-4">
        <label className="form-label" htmlFor="admin-ticket-summary">
          Summary
        </label>
        <input
          id="admin-ticket-summary"
          className="form-control lab2-readonly"
          value={ticket.summary}
          readOnly
          aria-readonly="true"
        />
      </div>
      <div className="mb-4">
        <label className="form-label" htmlFor="admin-ticket-description">
          Description
        </label>
        <textarea
          id="admin-ticket-description"
          className="form-control lab2-readonly"
          rows={6}
          value={ticket.description}
          readOnly
          aria-readonly="true"
        />
      </div>

      <fieldset className="lab2-fieldset lab3-operational-panel">
        <legend>IT Priority</legend>
        <label className="form-label" htmlFor="admin-it-priority">
          IT Priority
        </label>
        <select
          id="admin-it-priority"
          className="form-select"
          value={selectedPriority ?? ticket.itPriority}
          onChange={(event) => {
            setSelectedPriority(event.target.value as RequestedPriority);
            setOperationErrorMessage(null);
          }}
          disabled={isSaving}
        >
          {priorityOptions.map((priority) => (
            <option key={priority} value={priority}>
              {readable(priority)}
            </option>
          ))}
        </select>
        <div className="form-text">
          Requested Priority remains {readable(ticket.requestedPriority)}.
          Administrator Ticket Review cannot change status, ownership, or
          communication.
        </div>
        <button
          type="button"
          className="btn btn-outline-success mt-2"
          onClick={() => void handlePriority()}
          disabled={isSaving || selectedPriority === ticket.itPriority}
        >
          {isSaving ? "Saving..." : "Save IT Priority"}
        </button>
      </fieldset>

      <div className="lab3-resolution-indication" role="status">
        <strong>Requester resolution indication:</strong>{" "}
        {ticket.requesterResolutionIndicatedAt
          ? `Problem appears resolved (${formatDate(ticket.requesterResolutionIndicatedAt)}).`
          : "The Requester has not indicated that the problem appears resolved."}
      </div>

      <PublicCommentsPanel comments={ticket.publicComments} />
      <InternalNotesPanel notes={ticket.internalNotes} />
      <AttachmentMetadata attachments={ticket.attachments} />
    </section>
  );
}
