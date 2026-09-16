import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  apiErrorMessage,
  ApiRequestError,
  fetchCategories,
  fetchRelatedSystems,
  fetchStaffTickets,
  type Category,
  type RequestedPriority,
  type StaffTicketListQuery,
  type StaffTicketListResponse,
  type StaffTicketSortBy,
  type TicketStatus,
} from "../lib/api";
import { navigate } from "../lib/navigation";

type StaffTicketQueueProps = {
  onOpenTicket?: (ticketId: number) => void;
};

const statusOptions: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];
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

function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case "STAFF_QUEUE_FORBIDDEN":
        return "IT Staff access is required to use the Ticket Queue.";
      case "STAFF_QUEUE_QUERY_INVALID":
        return "One or more Queue filters are invalid. Review the highlighted values and try again.";
      default:
        return apiErrorMessage;
    }
  }
  return apiErrorMessage;
}

function hasActiveQuery(query: StaffTicketListQuery) {
  return Object.entries(query).some(([key, value]) => {
    if (key === "page" || key === "pageSize") {
      return false;
    }
    if (key === "sortBy" && value === "updatedAt") {
      return false;
    }
    if (key === "sortDirection" && value === "desc") {
      return false;
    }
    return value !== undefined && value !== "";
  });
}

function ownerLabel(owner: { name: string } | null) {
  return owner?.name ?? "Unassigned";
}

export default function StaffTicketQueue({
  onOpenTicket,
}: StaffTicketQueueProps) {
  const [query, setQuery] = useState<StaffTicketListQuery>({
    page: 1,
    pageSize: 10,
    sortBy: "updatedAt",
    sortDirection: "desc",
  });
  const [list, setList] = useState<StaffTicketListResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [referenceError, setReferenceError] = useState(false);
  const queueRequestId = useRef(0);

  const loadQueue = useCallback(
    async (signal?: AbortSignal) => {
      const requestId = queueRequestId.current + 1;
      queueRequestId.current = requestId;
      setIsLoading(true);
      setLoadError(null);
      try {
        const nextList = await fetchStaffTickets(query, signal);
        if (requestId === queueRequestId.current) {
          setList(nextList);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (requestId === queueRequestId.current) {
          setList(null);
          setLoadError(error);
        }
      } finally {
        if (requestId === queueRequestId.current) {
          setIsLoading(false);
        }
      }
    },
    [query],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadQueue(controller.signal);
    return () => controller.abort();
  }, [loadQueue]);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchCategories(), fetchRelatedSystems()])
      .then(([nextCategories, nextSystems]) => {
        if (!active) {
          return;
        }
        setCategories(nextCategories);
        setRelatedSystems(nextSystems);
      })
      .catch(() => {
        if (active) {
          setReferenceError(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const owners = useMemo(() => {
    const ownerMap = new Map<number, { id: number; name: string }>();
    const sourceOwners =
      list?.eligibleOwners ??
      list?.items.flatMap((ticket) => (ticket.owner ? [ticket.owner] : [])) ??
      [];
    for (const owner of sourceOwners) {
      ownerMap.set(owner.id, { id: owner.id, name: owner.name });
    }
    return [...ownerMap.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [list]);

  function updateQuery(changes: Partial<StaffTicketListQuery>) {
    setQuery((current) => ({ ...current, ...changes, page: 1 }));
  }

  function updatePage(page: number) {
    setQuery((current) => ({ ...current, page }));
  }

  function clearFilters() {
    setQuery({
      page: 1,
      pageSize: query.pageSize,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
  }

  function openTicket(ticketId: number) {
    if (onOpenTicket) {
      onOpenTicket(ticketId);
      return;
    }
    navigate(`/staff/tickets/${ticketId}`);
  }

  const activeQuery = hasActiveQuery(query);
  const items = list?.items ?? [];

  return (
    <section
      className="lab2-panel lab3-staff-queue-panel"
      aria-labelledby="staff-ticket-queue-title"
    >
      <div className="lab2-page-heading">
        <div>
          <p className="lab2-eyebrow">IT Staff workspace</p>
          <h1 id="staff-ticket-queue-title">Ticket Queue</h1>
          <p className="lab2-introduction">
            Locate shared work, review operational priority, and open a Ticket
            for action.
          </p>
        </div>
      </div>

      <div className="lab2-ticket-filters lab3-staff-queue-filters">
        <div className="lab2-ticket-search">
          <label className="form-label" htmlFor="staff-ticket-search">
            Search tickets
          </label>
          <div className="lab2-search-actions">
            <input
              id="staff-ticket-search"
              className="form-control"
              value={query.search ?? ""}
              onChange={(event) => updateQuery({ search: event.target.value })}
              placeholder="Ticket number or summary"
            />
            {activeQuery ? (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-md-4">
            <label className="form-label" htmlFor="staff-status-filter">
              Status
            </label>
            <select
              id="staff-status-filter"
              className="form-select"
              value={query.currentStatus ?? ""}
              onChange={(event) =>
                updateQuery({
                  currentStatus: (event.target.value || undefined) as
                    | TicketStatus
                    | undefined,
                })
              }
            >
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {readable(status)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label
              className="form-label"
              htmlFor="staff-requested-priority-filter"
            >
              Requested Priority
            </label>
            <select
              id="staff-requested-priority-filter"
              className="form-select"
              value={query.requestedPriority ?? ""}
              onChange={(event) =>
                updateQuery({
                  requestedPriority: (event.target.value || undefined) as
                    | RequestedPriority
                    | undefined,
                })
              }
            >
              <option value="">All requested priorities</option>
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {readable(priority)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label" htmlFor="staff-it-priority-filter">
              IT Priority
            </label>
            <select
              id="staff-it-priority-filter"
              className="form-select"
              value={query.itPriority ?? ""}
              onChange={(event) =>
                updateQuery({
                  itPriority: (event.target.value || undefined) as
                    | RequestedPriority
                    | undefined,
                })
              }
            >
              <option value="">All IT priorities</option>
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {readable(priority)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label" htmlFor="staff-owner-filter">
              Owner
            </label>
            <select
              id="staff-owner-filter"
              className="form-select"
              value={query.owner === undefined ? "" : String(query.owner)}
              onChange={(event) => {
                const value = event.target.value;
                updateQuery({
                  owner:
                    value === ""
                      ? undefined
                      : value === "unassigned" || value === "me"
                        ? value
                        : Number(value),
                });
              }}
            >
              <option value="">All owners</option>
              <option value="unassigned">Unassigned</option>
              <option value="me">Assigned to me</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label" htmlFor="staff-category-filter">
              Category
            </label>
            <select
              id="staff-category-filter"
              className="form-select"
              value={query.categoryId ?? ""}
              onChange={(event) =>
                updateQuery({
                  categoryId: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label" htmlFor="staff-related-system-filter">
              Related System
            </label>
            <select
              id="staff-related-system-filter"
              className="form-select"
              value={query.relatedSystemId ?? ""}
              onChange={(event) =>
                updateQuery({
                  relatedSystemId: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            >
              <option value="">All Related Systems</option>
              {relatedSystems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {referenceError ? (
          <div className="lab2-filter-reference-error" role="alert">
            <span>Reference filters could not load.</span>
            <button
              type="button"
              className="btn btn-sm btn-outline-success"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="row g-3 align-items-end">
          <div className="col-12 col-md-5">
            <label className="form-label" htmlFor="staff-sort-by">
              Sort by
            </label>
            <select
              id="staff-sort-by"
              className="form-select"
              value={query.sortBy ?? "updatedAt"}
              onChange={(event) =>
                updateQuery({ sortBy: event.target.value as StaffTicketSortBy })
              }
            >
              <option value="updatedAt">Last updated</option>
              <option value="ticketDate">Ticket date</option>
              <option value="ticketNumber">Ticket number</option>
              <option value="itPriority">IT Priority</option>
              <option value="currentStatus">Current status</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label" htmlFor="staff-sort-direction">
              Sort direction
            </label>
            <select
              id="staff-sort-direction"
              className="form-select"
              value={query.sortDirection ?? "desc"}
              onChange={(event) =>
                updateQuery({
                  sortDirection: event.target.value as "asc" | "desc",
                })
              }
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label" htmlFor="staff-page-size">
              Results per page
            </label>
            <select
              id="staff-page-size"
              className="form-select"
              value={query.pageSize ?? 10}
              onChange={(event) =>
                updateQuery({
                  pageSize: Number(event.target.value) as 10 | 20 | 50,
                })
              }
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="lab2-state" role="status" aria-live="polite">
          Loading Ticket Queue...
        </p>
      ) : null}

      {loadError ? (
        <div className="lab2-state lab2-state-error" role="alert">
          <p>{errorMessage(loadError)}</p>
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={() => void loadQueue()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {!isLoading && !loadError && list && items.length === 0 ? (
        <div className="lab2-state" role="status">
          <p>
            {activeQuery
              ? "No Tickets match the current search and filters."
              : "No Tickets are currently available in the shared Queue."}
          </p>
          {activeQuery ? (
            <button
              type="button"
              className="btn btn-outline-success"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !loadError && items.length > 0 ? (
        <>
          <div className="lab2-ticket-table-wrapper lab3-staff-ticket-table-wrapper">
            <table className="table align-middle lab2-ticket-table lab3-staff-ticket-table">
              <caption className="visually-hidden">
                IT Staff Ticket Queue
              </caption>
              <thead>
                <tr>
                  <th scope="col">Ticket Number</th>
                  <th scope="col">Created</th>
                  <th scope="col">Summary</th>
                  <th scope="col">Category / System</th>
                  <th scope="col">Requested Priority</th>
                  <th scope="col">IT Priority</th>
                  <th scope="col">Status</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Last Updated</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <strong>{ticket.ticketNumber}</strong>
                    </td>
                    <td>{formatDate(ticket.ticketDate)}</td>
                    <td className="lab2-ticket-summary-cell">
                      {ticket.summary}
                    </td>
                    <td>
                      {ticket.category.name}
                      <br />
                      <span className="text-muted">
                        {ticket.relatedSystem.name}
                      </span>
                    </td>
                    <td>
                      <span className="lab2-ticket-badge">
                        {readable(ticket.requestedPriority)}
                      </span>
                    </td>
                    <td>
                      <span className="lab2-ticket-badge">
                        {readable(ticket.itPriority)}
                      </span>
                    </td>
                    <td>
                      <span className="lab2-ticket-badge">
                        {readable(ticket.currentStatus)}
                      </span>
                    </td>
                    <td>{ownerLabel(ticket.owner)}</td>
                    <td>{formatDate(ticket.lastUpdated)}</td>
                    <td className="lab2-ticket-table-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success"
                        onClick={() => openTicket(ticket.id)}
                      >
                        Open detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lab3-staff-ticket-cards">
            {items.map((ticket) => (
              <article className="lab2-ticket-card" key={ticket.id}>
                <div className="lab2-ticket-card-heading">
                  <h2>{ticket.ticketNumber}</h2>
                  <span className="lab2-ticket-badge">
                    {readable(ticket.currentStatus)}
                  </span>
                </div>
                <p>{ticket.summary}</p>
                <dl>
                  <div>
                    <dt>Requester</dt>
                    <dd>{ticket.requester.name}</dd>
                  </div>
                  <div>
                    <dt>Requested Priority</dt>
                    <dd>{readable(ticket.requestedPriority)}</dd>
                  </div>
                  <div>
                    <dt>IT Priority</dt>
                    <dd>{readable(ticket.itPriority)}</dd>
                  </div>
                  <div>
                    <dt>Owner</dt>
                    <dd>{ownerLabel(ticket.owner)}</dd>
                  </div>
                  <div>
                    <dt>Last Updated</dt>
                    <dd>{formatDate(ticket.lastUpdated)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="btn btn-outline-success"
                  onClick={() => openTicket(ticket.id)}
                >
                  Open detail
                </button>
              </article>
            ))}
          </div>
          <div className="lab2-ticket-pagination">
            <span>
              Page {list?.page} of {list?.totalPages} ({list?.totalItems}{" "}
              Tickets)
            </span>
            <div className="lab2-form-actions">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => updatePage(Math.max(1, (list?.page ?? 1) - 1))}
                disabled={(list?.page ?? 1) <= 1 || isLoading}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-outline-success"
                onClick={() => updatePage((list?.page ?? 1) + 1)}
                disabled={!list || list.page >= list.totalPages || isLoading}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
