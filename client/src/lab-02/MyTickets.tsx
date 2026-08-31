import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  apiErrorMessage,
  fetchCategories,
  fetchRelatedSystems,
  fetchTickets,
  type Category,
  type RelatedSystem,
  type TicketListQuery,
  type TicketListResponse,
  type TicketSortBy,
} from "../lib/api";
import { useDevelopmentRequester } from "./requester-context";

type MyTicketsProps = {
  onCreateTicket: () => void;
};

const defaultQuery: TicketListQuery = {
  page: 1,
  pageSize: 10,
  sortBy: "ticketDate",
  sortDirection: "desc",
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

function isActiveQuery(query: TicketListQuery) {
  return Boolean(
    query.search ||
      query.categoryId ||
      query.relatedSystemId ||
      query.requestedPriority ||
      query.currentStatus ||
      query.sortBy !== "ticketDate" ||
      query.sortDirection !== "desc" ||
      query.page !== 1,
  );
}

export default function MyTickets({ onCreateTicket }: MyTicketsProps) {
  const { selectedRequester } = useDevelopmentRequester();
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [referenceError, setReferenceError] = useState(false);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [draftSearch, setDraftSearch] = useState("");
  const [query, setQuery] = useState<TicketListQuery>(defaultQuery);
  const [list, setList] = useState<TicketListResponse | null>(null);
  const [listError, setListError] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const latestListRequest = useRef(0);

  const loadReferences = useCallback(async () => {
    setReferenceLoading(true);
    setReferenceError(false);

    try {
      const [nextCategories, nextRelatedSystems] = await Promise.all([
        fetchCategories(),
        fetchRelatedSystems(),
      ]);
      setCategories(nextCategories);
      setRelatedSystems(nextRelatedSystems);
    } catch {
      setCategories([]);
      setRelatedSystems([]);
      setReferenceError(true);
    } finally {
      setReferenceLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  useEffect(() => {
    if (!selectedRequester) {
      return;
    }

    const controller = new AbortController();
    const requestId = latestListRequest.current + 1;
    latestListRequest.current = requestId;

    setListLoading(true);
    setListError(false);
    setList(null);

    void fetchTickets(selectedRequester.id, query, controller.signal)
      .then((nextList) => {
        if (requestId !== latestListRequest.current) {
          return;
        }
        setList(nextList);
      })
      .catch(() => {
        if (
          controller.signal.aborted ||
          requestId !== latestListRequest.current
        ) {
          return;
        }
        setListError(true);
      })
      .finally(() => {
        if (requestId === latestListRequest.current) {
          setListLoading(false);
        }
      });

    return () => controller.abort();
  }, [query, selectedRequester]);

  if (!selectedRequester) {
    return null;
  }

  function updateQuery(changes: Partial<TicketListQuery>) {
    setQuery((current) => ({
      ...current,
      ...changes,
      page: 1,
    }));
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateQuery({ search: draftSearch.trim() || undefined });
  }

  function clearQuery() {
    setDraftSearch("");
    setQuery(defaultQuery);
  }

  function changePage(page: number) {
    setQuery((current) => ({ ...current, page }));
  }

  const activeQuery = isActiveQuery(query);
  const hasItems = Boolean(list && list.items.length > 0);

  return (
    <section
      className="lab2-panel lab2-tickets-panel"
      aria-labelledby="my-tickets-title"
    >
      <div className="lab2-page-heading">
        <div>
          <p className="lab2-eyebrow">Requester ticket workspace</p>
          <h1 id="my-tickets-title">My Tickets</h1>
          <p className="lab2-introduction">
            Tickets owned by {selectedRequester.name}. The selected requester is
            a Lab 2 testing context, not a login.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-success"
          onClick={onCreateTicket}
        >
          Create Ticket
        </button>
      </div>

      <form className="lab2-ticket-filters" onSubmit={handleSearch}>
        <div className="lab2-ticket-search">
          <label className="form-label" htmlFor="ticket-search">
            Search
          </label>
          <div className="lab2-search-actions">
            <input
              id="ticket-search"
              className="form-control"
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              maxLength={120}
              placeholder="Ticket Number or Summary"
            />
            <button type="submit" className="btn btn-outline-success">
              Search
            </button>
            {draftSearch ? (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setDraftSearch("");
                  updateQuery({ search: undefined });
                }}
              >
                Clear Search
              </button>
            ) : null}
          </div>
        </div>

        <div className="lab2-form-grid lab2-ticket-filter-grid">
          <div>
            <label className="form-label" htmlFor="ticket-category-filter">
              Category
            </label>
            <select
              id="ticket-category-filter"
              className="form-select"
              value={query.categoryId ?? ""}
              disabled={referenceLoading}
              onChange={(event) =>
                updateQuery({
                  categoryId: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" htmlFor="ticket-system-filter">
              Related System
            </label>
            <select
              id="ticket-system-filter"
              className="form-select"
              value={query.relatedSystemId ?? ""}
              disabled={referenceLoading}
              onChange={(event) =>
                updateQuery({
                  relatedSystemId: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            >
              <option value="">All Related Systems</option>
              {relatedSystems.map((relatedSystem) => (
                <option key={relatedSystem.id} value={relatedSystem.id}>
                  {relatedSystem.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" htmlFor="ticket-priority-filter">
              Requested Priority
            </label>
            <select
              id="ticket-priority-filter"
              className="form-select"
              value={query.requestedPriority ?? ""}
              onChange={(event) =>
                updateQuery({
                  requestedPriority: event.target.value
                    ? (event.target.value as "LOW" | "MEDIUM" | "HIGH")
                    : undefined,
                })
              }
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          <div>
            <label className="form-label" htmlFor="ticket-status-filter">
              Current Status
            </label>
            <select
              id="ticket-status-filter"
              className="form-select"
              value={query.currentStatus ?? ""}
              onChange={(event) =>
                updateQuery({
                  currentStatus: event.target.value ? "NEW" : undefined,
                })
              }
            >
              <option value="">All Statuses</option>
              <option value="NEW">New</option>
            </select>
          </div>

          <div>
            <label className="form-label" htmlFor="ticket-sort-by">
              Sort By
            </label>
            <select
              id="ticket-sort-by"
              className="form-select"
              value={query.sortBy}
              onChange={(event) =>
                updateQuery({ sortBy: event.target.value as TicketSortBy })
              }
            >
              <option value="ticketDate">Ticket Date</option>
              <option value="updatedAt">Last Updated</option>
              <option value="ticketNumber">Ticket Number</option>
              <option value="summary">Summary</option>
            </select>
          </div>

          <div>
            <label className="form-label" htmlFor="ticket-sort-direction">
              Direction
            </label>
            <select
              id="ticket-sort-direction"
              className="form-select"
              value={query.sortDirection}
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
        </div>

        {referenceError ? (
          <div className="lab2-filter-reference-error" role="alert">
            <span>Filter reference data could not be loaded.</span>
            <button
              type="button"
              className="btn btn-sm btn-outline-success"
              onClick={() => void loadReferences()}
            >
              Try again
            </button>
          </div>
        ) : null}

        {activeQuery ? (
          <button
            type="button"
            className="btn btn-outline-secondary lab2-clear-filters"
            onClick={clearQuery}
          >
            Clear Filters
          </button>
        ) : null}
      </form>

      {listLoading ? (
        <p className="lab2-state" role="status" aria-live="polite">
          Loading Tickets...
        </p>
      ) : null}

      {listError ? (
        <div className="lab2-state lab2-state-error" role="alert">
          <p>
            {apiErrorMessage}. Your current ticket list was not kept as current.
          </p>
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={() => setQuery((current) => ({ ...current }))}
          >
            Try again
          </button>
        </div>
      ) : null}

      {!listLoading && !listError && list && !hasItems && !activeQuery ? (
        <div className="lab2-state" role="status">
          <p>{selectedRequester.name} has no tickets yet.</p>
          <button
            type="button"
            className="btn btn-success"
            onClick={onCreateTicket}
          >
            Create Ticket
          </button>
        </div>
      ) : null}

      {!listLoading && !listError && list && !hasItems && activeQuery ? (
        <div className="lab2-state" role="status">
          <p>No tickets match the current search and filters.</p>
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={clearQuery}
          >
            Clear Filters
          </button>
        </div>
      ) : null}

      {!listLoading && !listError && list && hasItems ? (
        <>
          <div className="lab2-ticket-table-wrapper">
            <table className="table align-middle lab2-ticket-table">
              <caption className="visually-hidden">
                Tickets for {selectedRequester.name}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Ticket Number</th>
                  <th scope="col">Ticket Date</th>
                  <th scope="col">Summary</th>
                  <th scope="col">Category</th>
                  <th scope="col">Requested Priority</th>
                  <th scope="col">Current Status</th>
                  <th scope="col">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>{ticket.ticketNumber}</td>
                    <td>{formatDate(ticket.ticketDate)}</td>
                    <td className="lab2-ticket-summary-cell">
                      {ticket.summary}
                    </td>
                    <td>{ticket.category.name}</td>
                    <td>
                      <span className="lab2-ticket-badge">
                        {readablePriority(ticket.requestedPriority)}
                      </span>
                    </td>
                    <td>
                      <span className="lab2-ticket-badge">
                        {readableStatus(ticket.currentStatus)}
                      </span>
                    </td>
                    <td>{formatDate(ticket.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lab2-ticket-cards">
            {list.items.map((ticket) => (
              <article className="lab2-ticket-card" key={ticket.id}>
                <div className="lab2-ticket-card-heading">
                  <strong>{ticket.ticketNumber}</strong>
                  <span className="lab2-ticket-badge">
                    {readableStatus(ticket.currentStatus)}
                  </span>
                </div>
                <h2>{ticket.summary}</h2>
                <dl>
                  <div>
                    <dt>Ticket Date</dt>
                    <dd>{formatDate(ticket.ticketDate)}</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>{ticket.category.name}</dd>
                  </div>
                  <div>
                    <dt>Requested Priority</dt>
                    <dd>{readablePriority(ticket.requestedPriority)}</dd>
                  </div>
                  <div>
                    <dt>Last Updated</dt>
                    <dd>{formatDate(ticket.lastUpdated)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <nav
            className="lab2-ticket-pagination"
            aria-label="Ticket pagination"
          >
            <span>
              Page {list.page} of {list.totalPages} ({list.totalItems} tickets)
            </span>
            <div className="lab2-form-actions">
              <button
                type="button"
                className="btn btn-outline-success"
                disabled={list.page <= 1}
                onClick={() => changePage(list.page - 1)}
              >
                Previous page
              </button>
              <button
                type="button"
                className="btn btn-outline-success"
                disabled={list.page >= list.totalPages}
                onClick={() => changePage(list.page + 1)}
              >
                Next page
              </button>
            </div>
          </nav>
        </>
      ) : null}
    </section>
  );
}
