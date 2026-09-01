import { useEffect, useState } from "react";

import CreateTicket from "./lab-02/CreateTicket";
import RequesterTicketDetail from "./lab-02/RequesterTicketDetail";
import MyTickets from "./lab-02/MyTickets";
import RequesterSelection from "./lab-02/RequesterSelection";
import { navigate } from "./lib/navigation";
import {
  DevelopmentRequesterProvider,
  useDevelopmentRequester,
} from "./lab-02/requester-context";

type AppRoute =
  | { page: "summary" }
  | { page: "tickets" }
  | { page: "create" }
  | { page: "detail"; ticketId: string };

function readRoute(): AppRoute {
  const detailTicketId = window.location.pathname.match(
    /^\/tickets\/([1-9]\d*)$/,
  )?.[1];
  if (detailTicketId) {
    return { page: "detail", ticketId: detailTicketId };
  }

  if (window.location.pathname === "/tickets/new") {
    return { page: "create" };
  }

  if (window.location.pathname === "/tickets") {
    return { page: "tickets" };
  }

  return { page: "summary" };
}

function SelectedRequesterScreen({ route }: { route: AppRoute }) {
  const { selectedRequester, clearRequester } = useDevelopmentRequester();
  const activePage =
    route.page === "create" ||
    route.page === "tickets" ||
    route.page === "summary"
      ? route.page
      : undefined;

  function changeRequester() {
    navigate("/");
    clearRequester();
  }

  return (
    <div className="lab2-shell">
      <header className="lab2-shell-header">
        <div>
          <p className="lab2-eyebrow">TokTickIT</p>
          <span className="lab2-shell-context">
            Testing context: {selectedRequester?.name}
          </span>
        </div>
        <nav className="lab2-shell-nav" aria-label="Requester navigation">
          <button
            type="button"
            className={`btn btn-sm ${
              activePage === "summary" ? "btn-success" : "btn-outline-success"
            }`}
            aria-current={activePage === "summary" ? "page" : undefined}
            onClick={() => navigate("/")}
          >
            Requester Summary
          </button>
          <button
            type="button"
            className={`btn btn-sm ${
              activePage === "tickets" ? "btn-success" : "btn-outline-success"
            }`}
            aria-current={activePage === "tickets" ? "page" : undefined}
            onClick={() => navigate("/tickets")}
          >
            My Tickets
          </button>
          <button
            type="button"
            className={`btn btn-sm ${
              activePage === "create" ? "btn-success" : "btn-outline-success"
            }`}
            aria-current={activePage === "create" ? "page" : undefined}
            onClick={() => navigate("/tickets/new")}
          >
            Create Ticket
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={changeRequester}
          >
            Change Requester
          </button>
        </nav>
      </header>

      {route.page === "detail" ? (
        <RequesterTicketDetail
          ticketId={route.ticketId}
          onBack={() => navigate("/tickets")}
        />
      ) : route.page === "tickets" ? (
        <MyTickets
          key={selectedRequester?.id}
          onCreateTicket={() => navigate("/tickets/new")}
        />
      ) : route.page === "create" ? (
        <CreateTicket onBack={() => navigate("/tickets")} />
      ) : (
        <section
          className="lab2-panel"
          aria-labelledby="selected-requester-title"
        >
          <p className="lab2-eyebrow">Lab 2 testing context</p>
          <h1 id="selected-requester-title">Requester context selected</h1>
          <p className="lab2-introduction">
            Requester-facing screens will use this selected context. It is not a
            login or authenticated identity.
          </p>
          <div className="lab2-requester-summary">
            <span className="lab2-summary-label">
              Current Development Requester
            </span>
            <strong>{selectedRequester?.name}</strong>
            <span>{selectedRequester?.email}</span>
          </div>
        </section>
      )}
    </div>
  );
}

function AppContent() {
  const { selectedRequester } = useDevelopmentRequester();
  const [route, setRoute] = useState<AppRoute>(readRoute);

  useEffect(() => {
    function handlePopState() {
      setRoute(readRoute());
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <main className="lab2-page">
      {selectedRequester ? (
        <SelectedRequesterScreen route={route} />
      ) : (
        <RequesterSelection />
      )}
    </main>
  );
}

export default function App() {
  return (
    <DevelopmentRequesterProvider>
      <AppContent />
    </DevelopmentRequesterProvider>
  );
}
