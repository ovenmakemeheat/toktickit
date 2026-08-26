import RequesterSelection from "./lab-02/RequesterSelection";
import {
  DevelopmentRequesterProvider,
  useDevelopmentRequester,
} from "./lab-02/requester-context";

function SelectedRequesterScreen() {
  const { selectedRequester, clearRequester } = useDevelopmentRequester();

  return (
    <section className="lab2-panel" aria-labelledby="selected-requester-title">
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
      <button
        type="button"
        className="btn btn-outline-success"
        onClick={clearRequester}
      >
        Change Requester
      </button>
    </section>
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
