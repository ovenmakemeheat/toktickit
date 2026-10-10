import { useCallback, useEffect, useState } from "react";

import {
  ApiRequestError,
  apiErrorMessage,
  fetchRequesterDashboard,
  type RequesterDashboardResponse,
  type RequesterDashboardTicket,
} from "../lib/api";
import { navigate } from "../lib/navigation";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function requestErrorMessage(error: unknown) {
  if (
    error instanceof ApiRequestError &&
    error.code === "REQUESTER_DASHBOARD_FORBIDDEN"
  ) {
    return "Requester access is required to view this Dashboard.";
  }
  return apiErrorMessage;
}

function TicketRows({
  title,
  tickets,
  emptyMessage,
}: {
  title: string;
  tickets: RequesterDashboardTicket[];
  emptyMessage: string;
}) {
  return (
    <section className="lab4-dashboard-section" aria-label={title}>
      <div className="lab2-page-heading">
        <div>
          <h2>{title}</h2>
          <p className="lab2-introduction">
            Up to five Tickets, newest activity first.
          </p>
        </div>
      </div>
      {tickets.length === 0 ? (
        <p className="lab2-state">{emptyMessage}</p>
      ) : (
        <ul className="lab4-dashboard-list">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button
                type="button"
                className="lab4-dashboard-row"
                aria-label={`Open Ticket ${ticket.ticketNumber}: ${ticket.summary}`}
                onClick={() => navigate(`/tickets/${ticket.id}`)}
              >
                <span className="lab4-dashboard-row-main">
                  <strong>{ticket.ticketNumber}</strong>
                  <span>{ticket.summary}</span>
                </span>
                <span className="lab4-dashboard-row-meta">
                  <span className="lab2-ticket-badge">
                    {statusLabel(ticket.currentStatus)}
                  </span>
                  <time dateTime={ticket.updatedAt}>
                    Updated {formatDate(ticket.updatedAt)}
                  </time>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function RequesterDashboard() {
  const [dashboard, setDashboard] = useState<RequesterDashboardResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setDashboard(await fetchRequesterDashboard(signal));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setDashboard(null);
      setLoadError(requestErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadDashboard(controller.signal);
    return () => controller.abort();
  }, [loadDashboard]);

  return (
    <section
      className="lab2-panel lab4-dashboard-panel"
      aria-labelledby="requester-dashboard-title"
    >
      <div className="lab2-page-heading">
        <div>
          <p className="lab2-eyebrow">Requester workspace</p>
          <h1 id="requester-dashboard-title">Requester Dashboard</h1>
          <p className="lab2-introduction">
            A quick view of your Tickets and recent resolutions.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-success"
          onClick={() => navigate("/tickets/new")}
        >
          Create Ticket
        </button>
      </div>

      <div className="lab4-dashboard-content" aria-busy={isLoading}>
        <section className="lab4-dashboard-metrics" aria-label="Ticket summary">
          <button
            type="button"
            className="lab4-dashboard-metric lab4-dashboard-metric-action"
            aria-label={`Open Tickets: ${dashboard?.metrics.openCount ?? "not available"}. View active Tickets.`}
            onClick={() => navigate("/tickets?statusGroup=ACTIVE")}
            disabled={!dashboard || isLoading}
          >
            <span>Open Tickets</span>
            <strong>{dashboard?.metrics.openCount ?? "—"}</strong>
            <small>Active requests that still need attention</small>
          </button>
          <button
            type="button"
            className="lab4-dashboard-metric lab4-dashboard-metric-action"
            aria-label={`Waiting for You: ${dashboard?.metrics.waitingForRequesterCount ?? "not available"}. View Tickets waiting for your response.`}
            onClick={() =>
              navigate("/tickets?currentStatus=WAITING_FOR_REQUESTER")
            }
            disabled={!dashboard || isLoading}
          >
            <span>Waiting for You</span>
            <strong>
              {dashboard?.metrics.waitingForRequesterCount ?? "—"}
            </strong>
            <small>Requests waiting for your response</small>
          </button>
          <div className="lab4-dashboard-metric">
            <span>Recently Resolved</span>
            <strong>{dashboard?.metrics.recentlyResolvedCount ?? "—"}</strong>
            <small>Resolved or closed in the last 30 days</small>
          </div>
        </section>

        {isLoading ? (
          <p className="lab2-state" role="status" aria-live="polite">
            Loading your Dashboard...
          </p>
        ) : loadError ? (
          <div className="lab2-state lab2-state-error" role="alert">
            <p>{loadError}</p>
            <button
              type="button"
              className="btn btn-outline-success"
              onClick={() => void loadDashboard()}
            >
              Retry Dashboard
            </button>
          </div>
        ) : dashboard ? (
          <>
            {dashboard.metrics.openCount === 0 &&
            dashboard.metrics.recentlyResolvedCount === 0 ? (
              <p className="lab2-state">
                No Ticket activity yet. Create a Ticket to get started.
              </p>
            ) : null}
            <TicketRows
              title="Recently Updated"
              tickets={dashboard.recentlyUpdated}
              emptyMessage="No Tickets have been updated in the last 30 days."
            />
            <TicketRows
              title="Recently Resolved"
              tickets={dashboard.recentlyResolved}
              emptyMessage="No Tickets were resolved or closed in the last 30 days."
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
