import { useState } from "react";

type HealthStatus = "unknown" | "checking" | "online" | "offline";

const healthStatusLabels: Record<HealthStatus, string> = {
  unknown: "Not checked",
  checking: "Checking...",
  online: "Online",
  offline: "Offline",
};

const apiErrorMessage = "Unable to connect to TokTickIT API";

export default function App() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("unknown");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function checkHealth() {
    setHealthStatus("checking");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/health");
      const payload = (await response.json()) as { status?: string };

      if (!response.ok || payload.status !== "ok") {
        throw new Error("Unexpected health response");
      }

      setHealthStatus("online");
    } catch {
      setHealthStatus("offline");
      setErrorMessage(apiErrorMessage);
    }
  }

  return (
    <main className="container min-vh-100 d-flex align-items-center py-5">
      <section
        className="card border-0 shadow-sm w-100"
        aria-labelledby="app-title"
      >
        <div className="card-body p-4 p-md-5">
          <p className="text-uppercase text-primary fw-semibold small mb-2">
            IT Service Desk
          </p>
          <h1 id="app-title" className="display-6 fw-bold">
            TokTickIT IT Service Desk
          </h1>
          <p className="lead text-secondary mb-4">
            Lab 1 full-stack foundation is ready for the system check.
          </p>
          <p className="mb-3" role="status" aria-live="polite">
            Backend status: {healthStatusLabels[healthStatus]}
          </p>
          {errorMessage ? (
            <p className="text-danger" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            onClick={checkHealth}
            disabled={healthStatus === "checking"}
          >
            {healthStatus === "checking" ? "Checking..." : "Check System"}
          </button>
        </div>
      </section>
    </main>
  );
}
