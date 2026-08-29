import { useCallback, useEffect, useState } from "react";

import {
  apiErrorMessage,
  fetchTicketDetail,
  type TicketDetail,
} from "../lib/api";
import AttachmentSection from "./AttachmentSection";
import { useDevelopmentRequester } from "./requester-context";

type RequesterTicketDetailProps = {
  ticketId: number | string;
  onBack: () => void;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function readablePriority(priority: string) {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function readableStatus(status: string) {
  return status === "NEW" ? "New" : status;
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

export default function RequesterTicketDetail({
  ticketId,
  onBack,
}: RequesterTicketDetailProps) {
  const { selectedRequester } = useDevelopmentRequester();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadTicket = useCallback(async () => {
    if (!selectedRequester) {
      setTicket(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);
    setTicket(null);

    try {
      setTicket(await fetchTicketDetail(selectedRequester.id, ticketId));
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRequester, ticketId]);

  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  if (!selectedRequester) {
    return (
      <section className="lab2-panel" aria-labelledby="ticket-detail-title">
        <h1 id="ticket-detail-title">Ticket Detail</h1>
        <p className="lab2-state lab2-state-error" role="alert">
          Select a Development Requester before opening a Ticket.
        </p>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onBack}
        >
          Back
        </button>
      </section>
    );
  }

  return (
    <section
      className="lab2-panel lab2-ticket-detail-panel"
      aria-labelledby="ticket-detail-title"
    >
      <div className="lab2-page-heading">
        <div>
          <p className="lab2-eyebrow">Requester ticket workspace</p>
          <h1 id="ticket-detail-title">
            {ticket ? ticket.ticketNumber : "Ticket Detail"}
          </h1>
          <p className="lab2-introduction">
            Read-only details for {selectedRequester.name}. This is a Lab 2
            requester testing context, not a login.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onBack}
        >
          Back to My Tickets
        </button>
      </div>

      {isLoading ? (
        <p className="lab2-state" role="status" aria-live="polite">
          Loading Ticket Detail...
        </p>
      ) : null}

      {hasError ? (
        <div className="lab2-state lab2-state-error" role="alert">
          <p>{apiErrorMessage}. This Ticket could not be loaded.</p>
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={() => void loadTicket()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {!isLoading && !hasError && ticket ? (
        <>
          <div className="lab2-readonly-grid lab2-ticket-detail-fields">
            <ReadOnlyField
              id="ticket-detail-date"
              label="Ticket Date"
              value={formatDate(ticket.ticketDate)}
            />
            <ReadOnlyField
              id="ticket-detail-requester"
              label="Requester"
              value={ticket.requester.name}
            />
            <ReadOnlyField
              id="ticket-detail-category"
              label="Category"
              value={ticket.category.name}
            />
            <ReadOnlyField
              id="ticket-detail-related-system"
              label="Related System"
              value={ticket.relatedSystem.name}
            />
            <ReadOnlyField
              id="ticket-detail-priority"
              label="Requested Priority"
              value={readablePriority(ticket.requestedPriority)}
            />
            <ReadOnlyField
              id="ticket-detail-status"
              label="Current Status"
              value={readableStatus(ticket.currentStatus)}
            />
            <ReadOnlyField
              id="ticket-detail-last-updated"
              label="Last Updated"
              value={formatDate(ticket.lastUpdated)}
            />
          </div>

          <div className="mb-4">
            <label className="form-label" htmlFor="ticket-detail-summary">
              Summary
            </label>
            <input
              id="ticket-detail-summary"
              className="form-control lab2-readonly"
              value={ticket.summary}
              readOnly
              aria-readonly="true"
            />
          </div>

          <div className="mb-4">
            <label className="form-label" htmlFor="ticket-detail-description">
              Description
            </label>
            <textarea
              id="ticket-detail-description"
              className="form-control lab2-readonly"
              rows={6}
              value={ticket.description}
              readOnly
              aria-readonly="true"
            />
          </div>

          <AttachmentSection
            requesterId={selectedRequester.id}
            ticketId={ticket.id}
            attachments={ticket.attachments}
            onChanged={loadTicket}
          />
        </>
      ) : null}
    </section>
  );
}
