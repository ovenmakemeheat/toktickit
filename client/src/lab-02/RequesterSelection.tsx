import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  apiErrorMessage,
  fetchDevelopmentRequesters,
  type DevelopmentRequester,
} from "../lib/api";
import { useDevelopmentRequester } from "./requester-context";

type LoadState = "loading" | "ready" | "empty" | "error";

export default function RequesterSelection() {
  const { selectRequester } = useDevelopmentRequester();
  const [requesters, setRequesters] = useState<DevelopmentRequester[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadRequesters = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);

    try {
      const activeRequesters = await fetchDevelopmentRequesters();
      setRequesters(activeRequesters);
      setSelectedId("");
      setLoadState(activeRequesters.length === 0 ? "empty" : "ready");
    } catch {
      setRequesters([]);
      setSelectedId("");
      setLoadState("error");
      setErrorMessage(apiErrorMessage);
    }
  }, []);

  useEffect(() => {
    void loadRequesters();
  }, [loadRequesters]);

  const selectedRequester = requesters.find(
    (requester) => String(requester.id) === selectedId,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedRequester) {
      selectRequester(selectedRequester);
    }
  }

  return (
    <section className="lab2-panel" aria-labelledby="requester-selection-title">
      <p className="lab2-eyebrow">Lab 2 testing context</p>
      <h1 id="requester-selection-title">Select a Development Requester</h1>
      <p className="lab2-introduction">
        Select a Development Requester to test requester-specific ticket
        behavior. This is not a login screen.
      </p>

      {loadState === "loading" ? (
        <p className="lab2-state" role="status" aria-live="polite">
          Loading Development Requesters...
        </p>
      ) : null}

      {loadState === "error" ? (
        <div className="lab2-state lab2-state-error" role="alert">
          <p>{errorMessage}</p>
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={() => void loadRequesters()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {loadState === "empty" ? (
        <div className="lab2-state" role="status" aria-live="polite">
          <p>No active Development Requesters are available.</p>
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={() => void loadRequesters()}
          >
            Reload Requesters
          </button>
        </div>
      ) : null}

      {loadState === "ready" ? (
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label" htmlFor="development-requester">
              Development Requester
            </label>
            <select
              id="development-requester"
              className="form-select"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              required
            >
              <option value="">Choose a Development Requester</option>
              {requesters.map((requester) => (
                <option key={requester.id} value={requester.id}>
                  {requester.name} ({requester.email})
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="btn btn-success"
            disabled={!selectedRequester}
          >
            Continue
          </button>
        </form>
      ) : null}
    </section>
  );
}
