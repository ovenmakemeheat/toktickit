import { useCallback, useEffect, useMemo, useState } from "react";

import {
  apiErrorMessage,
  ApiRequestError,
  assignStaffTicket,
  claimStaffTicket,
  fetchStaffTicketDetail,
  postInternalNote,
  postPublicComment,
  updateStaffTicketPriority,
  updateStaffTicketStatus,
  type RequestedPriority,
  type StaffTicketDetail as StaffTicketDetailType,
  type TicketStatus,
} from "../lib/api";
import { InternalNotesPanel, PublicCommentsPanel } from "./CommunicationPanels";

type StaffTicketDetailProps = {
  ticketId: number | string;
  onBack: () => void;
};

const priorityOptions: RequestedPriority[] = ["LOW", "MEDIUM", "HIGH"];
const transitionMap: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["OPEN", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["OPEN", "IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: [
    "OPEN",
    "IN_PROGRESS",
    "WAITING_FOR_REQUESTER",
    "RESOLVED",
    "CANCELLED",
  ],
  CANCELLED: ["REOPENED"],
};
const confirmationStatuses = new Set<TicketStatus>([
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
]);

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
    if (error.code === "STAFF_TICKET_FORBIDDEN") {
      return "IT Staff access is required to view this Ticket.";
    }
    if (error.code === "TICKET_NOT_FOUND") {
      return "This Ticket is not available in the shared Queue.";
    }
  }
  return `${apiErrorMessage}. This Ticket could not be loaded.`;
}

function operationError(error: unknown) {
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case "TICKET_ALREADY_ASSIGNED":
        return "Another Staff User claimed this Ticket first. Refresh to see the current owner.";
      case "OWNER_INVALID":
        return "Choose an active IT Staff or Administrator User ID.";
      case "STATUS_CONFIRMATION_REQUIRED":
        return "Confirm this status change before saving it.";
      case "TICKET_STATUS_TRANSITION_INVALID":
        return "That status transition is not permitted from the current status.";
      case "TICKET_STATUS_CONFLICT":
        return "This Ticket status changed elsewhere. Refresh before trying again.";
      case "IT_PRIORITY_INVALID":
        return "Choose a valid IT Priority.";
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

function StaffAttachmentMetadata({
  attachments,
}: {
  attachments: StaffTicketDetailType["attachments"];
}) {
  return (
    <section
      className="lab3-communication-panel lab3-staff-attachments"
      aria-labelledby="staff-attachments-title"
    >
      <div className="lab2-page-heading">
        <div>
          <p className="lab2-eyebrow">Ticket evidence</p>
          <h2 id="staff-attachments-title">Attachments</h2>
          <p className="lab2-introduction">
            Existing attachment metadata is visible here. Requester upload and
            removal controls remain in the Requester workspace.
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

export default function StaffTicketDetail({
  ticketId,
  onBack,
}: StaffTicketDetailProps) {
  const [ticket, setTicket] = useState<StaffTicketDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [operationErrorMessage, setOperationErrorMessage] = useState<
    string | null
  >(null);
  const [operationErrorCode, setOperationErrorCode] = useState<string | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPriority, setSelectedPriority] =
    useState<RequestedPriority | null>(null);
  const [ownerId, setOwnerId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | "">("");
  const [confirmation, setConfirmation] = useState(false);

  const loadTicket = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const nextTicket = await fetchStaffTicketDetail(ticketId);
      setTicket(nextTicket);
      setSelectedPriority(nextTicket.itPriority);
      setOwnerId(nextTicket.owner ? String(nextTicket.owner.id) : "");
      setSelectedStatus("");
      setConfirmation(false);
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

  const allowedStatuses = useMemo(
    () => (ticket ? transitionMap[ticket.currentStatus] : []),
    [ticket],
  );
  const statusNeedsConfirmation = selectedStatus
    ? confirmationStatuses.has(selectedStatus)
    : false;
  const eligibleOwners =
    ticket?.eligibleOwners ?? (ticket?.owner ? [ticket.owner] : []);

  async function runOperation(
    operation: () => Promise<StaffTicketDetailType>,
    success: string,
  ) {
    setIsSaving(true);
    setOperationErrorMessage(null);
    setOperationErrorCode(null);
    setSuccessMessage(null);
    try {
      setTicket(await operation());
      setSuccessMessage(success);
      setSelectedStatus("");
      setConfirmation(false);
    } catch (error) {
      setOperationErrorMessage(operationError(error));
      setOperationErrorCode(
        error instanceof ApiRequestError ? (error.code ?? null) : null,
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClaim() {
    await runOperation(
      () => claimStaffTicket(ticketId),
      "Ticket claimed successfully.",
    );
  }

  async function handleAssignment() {
    const parsedOwnerId = Number(ownerId);
    if (!Number.isSafeInteger(parsedOwnerId) || parsedOwnerId < 1) {
      setOperationErrorMessage(
        "Enter a positive User ID for an eligible owner.",
      );
      setOperationErrorCode(null);
      return;
    }
    await runOperation(
      () => assignStaffTicket(ticketId, parsedOwnerId),
      "Ticket owner updated successfully.",
    );
  }

  async function handlePriority() {
    if (!selectedPriority || selectedPriority === ticket?.itPriority) {
      return;
    }
    await runOperation(
      () => updateStaffTicketPriority(ticketId, selectedPriority),
      "IT Priority updated successfully.",
    );
  }

  async function handleStatus() {
    if (!selectedStatus) {
      setOperationErrorMessage("Choose a permitted status transition first.");
      setOperationErrorCode(null);
      return;
    }
    if (statusNeedsConfirmation && !confirmation) {
      setOperationErrorMessage("Confirm this status change before saving it.");
      setOperationErrorCode(null);
      return;
    }
    await runOperation(
      () => updateStaffTicketStatus(ticketId, selectedStatus, confirmation),
      "Ticket status updated successfully.",
    );
  }

  if (isLoading) {
    return (
      <section
        className="lab2-panel lab3-staff-detail-panel"
        aria-labelledby="staff-ticket-detail-title"
      >
        <h1 id="staff-ticket-detail-title">Ticket Detail</h1>
        <p className="lab2-state" role="status" aria-live="polite">
          Loading Ticket Detail...
        </p>
      </section>
    );
  }

  if (loadError || !ticket) {
    return (
      <section
        className="lab2-panel lab3-staff-detail-panel"
        aria-labelledby="staff-ticket-detail-title"
      >
        <h1 id="staff-ticket-detail-title">Ticket Detail</h1>
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
              Back to Queue
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="lab2-panel lab3-staff-detail-panel"
      aria-labelledby="staff-ticket-detail-title"
    >
      <div className="lab2-page-heading">
        <div>
          <p className="lab2-eyebrow">IT Staff Ticket Detail</p>
          <h1 id="staff-ticket-detail-title">{ticket.ticketNumber}</h1>
          <p className="lab2-introduction">
            Review the Requester record, make permitted operational changes, and
            keep public and private communication separate.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onBack}
        >
          Back to Queue
        </button>
      </div>

      {successMessage ? (
        <p className="lab2-state lab2-state-success" role="status">
          {successMessage}
        </p>
      ) : null}
      {operationErrorMessage ? (
        <div className="lab2-state lab2-state-error" role="alert">
          <p>{operationErrorMessage}</p>
          {operationErrorCode === "TICKET_STATUS_CONFLICT" ? (
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => {
                setOperationErrorMessage(null);
                setOperationErrorCode(null);
                void loadTicket();
              }}
              disabled={isLoading || isSaving}
            >
              Refresh Ticket
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="lab2-readonly-grid lab3-staff-detail-fields">
        <ReadOnlyField
          id="staff-ticket-date"
          label="Ticket Date"
          value={formatDate(ticket.ticketDate)}
        />
        <ReadOnlyField
          id="staff-ticket-requester"
          label="Requester"
          value={ticket.requester.name}
        />
        <ReadOnlyField
          id="staff-ticket-category"
          label="Category"
          value={ticket.category.name}
        />
        <ReadOnlyField
          id="staff-ticket-related-system"
          label="Related System"
          value={ticket.relatedSystem.name}
        />
        <ReadOnlyField
          id="staff-ticket-requested-priority"
          label="Requested Priority"
          value={readable(ticket.requestedPriority)}
        />
        <ReadOnlyField
          id="staff-ticket-status-readonly"
          label="Current Status"
          value={readable(ticket.currentStatus)}
        />
        <ReadOnlyField
          id="staff-ticket-last-updated"
          label="Last Updated"
          value={formatDate(ticket.updatedAt)}
        />
      </div>

      <div className="mb-4">
        <label className="form-label" htmlFor="staff-ticket-summary">
          Summary
        </label>
        <input
          id="staff-ticket-summary"
          className="form-control lab2-readonly"
          value={ticket.summary}
          readOnly
          aria-readonly="true"
        />
      </div>
      <div className="mb-4">
        <label className="form-label" htmlFor="staff-ticket-description">
          Description
        </label>
        <textarea
          id="staff-ticket-description"
          className="form-control lab2-readonly"
          rows={6}
          value={ticket.description}
          readOnly
          aria-readonly="true"
        />
      </div>

      <fieldset className="lab2-fieldset lab3-operational-panel">
        <legend>Ticket Operations</legend>
        <div className="lab3-operation-grid">
          <div>
            <label className="form-label" htmlFor="staff-ticket-owner">
              Owner
            </label>
            <select
              id="staff-ticket-owner"
              className="form-select"
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              aria-describedby="staff-ticket-owner-help"
              disabled={isSaving}
            >
              <option value="">Select an eligible owner</option>
              {eligibleOwners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name} ({readable(owner.role)})
                </option>
              ))}
            </select>
            <div id="staff-ticket-owner-help" className="form-text">
              Only active IT Staff and Administrators are available for
              assignment.
            </div>
            <div className="lab2-form-actions mt-2">
              {!ticket.owner ? (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => void handleClaim()}
                  disabled={isSaving}
                >
                  {isSaving ? "Claiming..." : "Claim"}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-outline-success"
                onClick={() => void handleAssignment()}
                disabled={isSaving || !ownerId}
              >
                {ticket.owner ? "Reassign" : "Assign"}
              </button>
            </div>
          </div>
          <div>
            <label className="form-label" htmlFor="staff-it-priority">
              IT Priority
            </label>
            <select
              id="staff-it-priority"
              className="form-select"
              value={selectedPriority ?? ticket.itPriority}
              onChange={(event) =>
                setSelectedPriority(event.target.value as RequestedPriority)
              }
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
            </div>
            <button
              type="button"
              className="btn btn-outline-success mt-2"
              onClick={() => void handlePriority()}
              disabled={isSaving || selectedPriority === ticket.itPriority}
            >
              Save IT Priority
            </button>
          </div>
          <div>
            <label className="form-label" htmlFor="staff-ticket-status">
              Status
            </label>
            <select
              id="staff-ticket-status"
              className="form-select"
              value={selectedStatus}
              onChange={(event) => {
                setSelectedStatus(event.target.value as TicketStatus | "");
                setConfirmation(false);
                setOperationErrorMessage(null);
                setOperationErrorCode(null);
              }}
              disabled={isSaving}
            >
              <option value="">Choose next status</option>
              {allowedStatuses.map((status) => (
                <option key={status} value={status}>
                  {readable(status)}
                </option>
              ))}
            </select>
            <div className="form-text">
              Only transitions allowed by the workflow matrix are offered.
            </div>
            {statusNeedsConfirmation ? (
              <label
                className="form-check mt-2"
                htmlFor="staff-status-confirmation"
              >
                <input
                  id="staff-status-confirmation"
                  className="form-check-input"
                  type="checkbox"
                  checked={confirmation}
                  onChange={(event) => setConfirmation(event.target.checked)}
                  disabled={isSaving}
                />
                <span className="form-check-label">
                  Confirm change to {readable(selectedStatus)}
                </span>
              </label>
            ) : null}
            <button
              type="button"
              className="btn btn-outline-success mt-2"
              onClick={() => void handleStatus()}
              disabled={isSaving || !selectedStatus}
            >
              {isSaving ? "Saving..." : "Update status"}
            </button>
          </div>
        </div>
      </fieldset>

      <div className="lab3-resolution-indication" role="status">
        <strong>Requester resolution indication:</strong>{" "}
        {ticket.requesterResolutionIndicatedAt
          ? `Problem appears resolved (${formatDate(ticket.requesterResolutionIndicatedAt)}).`
          : "The Requester has not indicated that the problem appears resolved."}
      </div>

      <PublicCommentsPanel
        comments={ticket.publicComments}
        onPost={async (content) => {
          await postPublicComment(ticket.id, content);
          await loadTicket();
        }}
      />
      <InternalNotesPanel
        notes={ticket.internalNotes}
        onPost={async (content) => {
          await postInternalNote(ticket.id, content);
          await loadTicket();
        }}
      />
      <StaffAttachmentMetadata attachments={ticket.attachments} />
    </section>
  );
}
