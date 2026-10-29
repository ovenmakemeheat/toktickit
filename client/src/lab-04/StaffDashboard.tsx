import { useCallback, useEffect, useState } from "react";

import {
  ApiRequestError,
  apiErrorMessage,
  fetchStaffDashboard,
  type StaffDashboardResponse,
  type StaffDashboardTicket,
} from "../lib/api";
import { navigate } from "../lib/navigation";

const activeStatuses = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "REOPENED",
] as const;
const priorities = ["LOW", "MEDIUM", "HIGH"] as const;

function readable(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
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

function requestErrorMessage(error: unknown) {
  if (
    error instanceof ApiRequestError &&
    error.code === "STAFF_DASHBOARD_FORBIDDEN"
  ) {
    return "IT Staff or Administrator access is required to view this Dashboard.";
  }
  return apiErrorMessage;
}

function TicketRows({ tickets }: { tickets: StaffDashboardTicket[] }) {
  if (tickets.length === 0) {
    return (
      <p className="lab2-state">
        No active Tickets were updated in the last 30 days.
      </p>
    );
  }
  return (
    <ul className="lab4-dashboard-list">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <button
            type="button"
            className="lab4-dashboard-row"
            aria-label={`Open Ticket ${ticket.ticketNumber}: ${ticket.summary}`}
            onClick={() => navigate(`/staff/tickets/${ticket.id}`)}
          >
            <span className="lab4-dashboard-row-main">
              <strong>{ticket.ticketNumber}</strong>
              <span>{ticket.summary}</span>
            </span>
            <span className="lab4-dashboard-row-meta">
              <span className="lab2-ticket-badge">
                {readable(ticket.currentStatus)}
              </span>
              <span>{readable(ticket.itPriority)} priority</span>
              <span>{ticket.owner?.name ?? "Unassigned"}</span>
              <time dateTime={ticket.updatedAt}>
                Updated {formatDate(ticket.updatedAt)}
              </time>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function StaffDashboard() {
  const [dashboard, setDashboard] = useState<StaffDashboardResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setDashboard(await fetchStaffDashboard(signal));
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

  const metrics = dashboard?.metrics;
  const activeCount = activeStatuses.reduce(
    (total, status) => total + (metrics?.statusBreakdown[status] ?? 0),
    0,
  );

  return (
    <section
      className="lab2-panel lab4-dashboard-panel"
      aria-labelledby="staff-dashboard-title"
    >
      <div className="lab2-page-heading">
        <div>
          <p className="lab2-eyebrow">Operations overview</p>
          <h1 id="staff-dashboard-title">Staff Dashboard</h1>
          <p className="lab2-introduction">
            Triage active Tickets, track your work, and continue in the Ticket
            Queue.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-success"
          onClick={() => navigate("/staff/tickets")}
        >
          Open Ticket Queue
        </button>
      </div>

      <div className="lab4-dashboard-content" aria-busy={isLoading}>
        <section
          className="lab4-dashboard-metrics"
          aria-label="Operational summary"
        >
          <button
            type="button"
            className="lab4-dashboard-metric lab4-dashboard-metric-action"
            aria-label={`Unassigned Active: ${metrics?.unassignedActiveCount ?? "not available"}. View unassigned active Tickets.`}
            onClick={() =>
              navigate("/staff/tickets?statusGroup=ACTIVE&owner=unassigned")
            }
            disabled={!dashboard || isLoading}
          >
            <span>Unassigned Active</span>
            <strong>{metrics?.unassignedActiveCount ?? "—"}</strong>
            <small>Active Tickets without an owner</small>
          </button>
          <button
            type="button"
            className="lab4-dashboard-metric lab4-dashboard-metric-action"
            aria-label={`My Active Tickets: ${metrics?.myActiveCount ?? "not available"}. View Tickets assigned to me.`}
            onClick={() =>
              navigate("/staff/tickets?statusGroup=ACTIVE&owner=me")
            }
            disabled={!dashboard || isLoading}
          >
            <span>My Active Tickets</span>
            <strong>{metrics?.myActiveCount ?? "—"}</strong>
            <small>Assigned to your account</small>
          </button>
          <button
            type="button"
            className="lab4-dashboard-metric lab4-dashboard-metric-action"
            aria-label={`High Priority Active: ${metrics?.highPriorityActiveCount ?? "not available"}. View high-priority active Tickets.`}
            onClick={() =>
              navigate("/staff/tickets?statusGroup=ACTIVE&itPriority=HIGH")
            }
            disabled={!dashboard || isLoading}
          >
            <span>High Priority Active</span>
            <strong>{metrics?.highPriorityActiveCount ?? "—"}</strong>
            <small>Marked High by IT</small>
          </button>
        </section>

        <section
          className="lab4-dashboard-section"
          aria-label="Active Tickets by status"
        >
          <div className="lab2-page-heading">
            <div>
              <h2>By Status</h2>
              <p className="lab2-introduction">
                {activeCount} active Tickets across all queues.
              </p>
            </div>
          </div>
          <div className="lab4-dashboard-breakdown">
            {activeStatuses.map((status) => (
              <button
                type="button"
                className="lab4-dashboard-breakdown-item"
                key={status}
                aria-label={`View ${readable(status)} Tickets: ${metrics?.statusBreakdown[status] ?? "not available"}`}
                onClick={() =>
                  navigate(`/staff/tickets?currentStatus=${status}`)
                }
                disabled={!dashboard || isLoading}
              >
                <span>{readable(status)}</span>
                <strong>{metrics?.statusBreakdown[status] ?? "—"}</strong>
              </button>
            ))}
          </div>
        </section>

        <section
          className="lab4-dashboard-section"
          aria-label="Active Tickets by IT Priority"
        >
          <div className="lab2-page-heading">
            <div>
              <h2>By IT Priority</h2>
              <p className="lab2-introduction">
                Priorities are set by the service desk.
              </p>
            </div>
          </div>
          <div className="lab4-dashboard-breakdown lab4-dashboard-priorities">
            {priorities.map((priority) => (
              <button
                type="button"
                className="lab4-dashboard-breakdown-item"
                key={priority}
                aria-label={`View ${readable(priority)} priority active Tickets: ${metrics?.itPriorityBreakdown[priority] ?? "not available"}`}
                onClick={() =>
                  navigate(
                    `/staff/tickets?statusGroup=ACTIVE&itPriority=${priority}`,
                  )
                }
                disabled={!dashboard || isLoading}
              >
                <span>{readable(priority)}</span>
                <strong>{metrics?.itPriorityBreakdown[priority] ?? "—"}</strong>
              </button>
            ))}
          </div>
        </section>

        {isLoading ? (
          <p className="lab2-state" role="status" aria-live="polite">
            Loading operational Dashboard...
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
            {activeCount === 0 ? (
              <p className="lab2-state">
                No active Tickets need attention right now.
              </p>
            ) : null}
            <section
              className="lab4-dashboard-section"
              aria-labelledby="staff-recent-tickets-title"
            >
              <div className="lab2-page-heading">
                <div>
                  <h2 id="staff-recent-tickets-title">Recently Updated</h2>
                  <p className="lab2-introduction">
                    Active Tickets with recent activity.
                  </p>
                </div>
              </div>
              <TicketRows tickets={dashboard.recentlyUpdated} />
            </section>
            <section
              className="lab4-dashboard-section"
              aria-labelledby="staff-recent-actions-title"
            >
              <div className="lab2-page-heading">
                <div>
                  <h2 id="staff-recent-actions-title">My Recent Actions</h2>
                  <p className="lab2-introduction">
                    Actions Taken you performed in the last 30 days, regardless
                    of Ticket owner or status.
                  </p>
                </div>
              </div>
              {dashboard.myRecentActions.length === 0 ? (
                <p className="lab2-state">
                  No Actions Taken by you in the last 30 days.
                </p>
              ) : (
                <ul
                  className="lab4-dashboard-list"
                  aria-label="My Recent Actions"
                >
                  {dashboard.myRecentActions.map((action) => (
                    <li key={action.id}>
                      <button
                        type="button"
                        className="lab4-dashboard-row lab4-dashboard-action-row"
                        aria-label={`Open Action Taken on Ticket ${action.ticketNumber}: ${action.actionDescription}`}
                        onClick={() =>
                          navigate(
                            `/staff/tickets/${action.ticketId}#action-taken-${action.id}`,
                          )
                        }
                      >
                        <span className="lab4-dashboard-row-main">
                          <strong>
                            {action.ticketNumber} · {action.ticketSummary}
                          </strong>
                          <span>{action.actionDescription}</span>
                          <span className="lab4-dashboard-action-result">
                            Result: {action.result}
                          </span>
                        </span>
                        <time dateTime={action.createdAt}>
                          Recorded {formatDate(action.createdAt)}
                        </time>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}
