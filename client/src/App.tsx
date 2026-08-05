import { useState } from "react";

import {
  apiErrorMessage,
  fetchCategories,
  fetchHealth,
  type Category,
} from "./lib/api";

type HealthStatus = "unknown" | "checking" | "online" | "offline";

const healthStatusLabels: Record<HealthStatus, string> = {
  unknown: "Not checked",
  checking: "Checking...",
  online: "Online",
  offline: "Offline",
};

export default function App() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("unknown");
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function checkSystem() {
    setHealthStatus("checking");
    setCategories([]);
    setErrorMessage(null);

    try {
      const [health, categoryList] = await Promise.all([
        fetchHealth(),
        fetchCategories(),
      ]);

      if (health.status !== "ok") {
        throw new Error("Unexpected health response");
      }

      setHealthStatus("online");
      setCategories(categoryList);
    } catch {
      setHealthStatus("offline");
      setCategories([]);
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
            System Status: {healthStatusLabels[healthStatus]}
          </p>
          {errorMessage ? (
            <p className="text-danger" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {categories.length > 0 ? (
            <div className="mb-4">
              <h2 className="h5">Supported categories</h2>
              <ul aria-label="IT request categories">
                {categories.map((category) => (
                  <li key={category.id}>{category.name}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            onClick={checkSystem}
            disabled={healthStatus === "checking"}
          >
            {healthStatus === "checking" ? "Checking..." : "Check System"}
          </button>
        </div>
      </section>
    </main>
  );
}
