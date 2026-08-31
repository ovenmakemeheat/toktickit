import { useState } from "react";

import CreateTicket from "./lab-02/CreateTicket";
import MyTickets from "./lab-02/MyTickets";
import RequesterSelection from "./lab-02/RequesterSelection";
import {
  DevelopmentRequesterProvider,
  useDevelopmentRequester,
} from "./lab-02/requester-context";

function SelectedRequesterScreen() {
  const { selectedRequester, clearRequester } = useDevelopmentRequester();
  const [activePage, setActivePage] = useState<
    "summary" | "tickets" | "create"
  >("summary");

  function changeRequester() {
    setActivePage("summary");
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
            className="btn btn-sm btn-outline-success"
            aria-current={activePage === "summary" ? "page" : undefined}
            onClick={() => setActivePage("summary")}
          >
            Requester Summary
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-success"
            aria-current={activePage === "tickets" ? "page" : undefined}
            onClick={() => setActivePage("tickets")}
          >
            My Tickets
          </button>
          <button
            type="button"
            className="btn btn-sm btn-success"
            aria-current={activePage === "create" ? "page" : undefined}
            onClick={() => setActivePage("create")}
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

      {activePage === "tickets" ? (
        <MyTickets
          key={selectedRequester?.id}
          onCreateTicket={() => setActivePage("create")}
        />
      ) : activePage === "create" ? (
        <CreateTicket onBack={() => setActivePage("summary")} />
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

  return (
    <main className="lab2-page">
      {selectedRequester ? <SelectedRequesterScreen /> : <RequesterSelection />}
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
