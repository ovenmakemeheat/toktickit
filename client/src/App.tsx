import { useEffect, useState } from "react";

import ChangePassword from "./auth/ChangePassword";
import Login from "./auth/Login";
import { AuthProvider, useAuth } from "./auth-context";
import CreateTicket from "./lab-02/CreateTicket";
import MyTickets from "./lab-02/MyTickets";
import RequesterTicketDetail from "./lab-02/RequesterTicketDetail";
import { RequesterProvider, useRequester } from "./lab-02/requester-context";
import StaffTicketDetail from "./lab-03/StaffTicketDetail";
import StaffTicketQueue from "./lab-03/StaffTicketQueue";
import UserManagement from "./lab-03/UserManagement";
import { navigate } from "./lib/navigation";
import type { PublicUser, Role } from "./lib/api";

type AppRoute =
  | { page: "summary" }
  | { page: "tickets" }
  | { page: "create" }
  | { page: "detail"; ticketId: string }
  | { page: "staff-tickets" }
  | { page: "staff-detail"; ticketId: string }
  | { page: "users" }
  | { page: "change-password" };

function readRoute(): AppRoute {
  if (window.location.pathname === "/admin/users") {
    return { page: "users" };
  }
  const staffDetailTicketId = window.location.pathname.match(
    /^\/staff\/tickets\/([1-9]\d*)$/,
  )?.[1];
  if (staffDetailTicketId) {
    return { page: "staff-detail", ticketId: staffDetailTicketId };
  }

  if (window.location.pathname === "/staff/tickets") {
    return { page: "staff-tickets" };
  }

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

  if (window.location.pathname === "/change-password") {
    return { page: "change-password" };
  }

  return { page: "summary" };
}

function roleLabel(role: Role) {
  switch (role) {
    case "IT_STAFF":
      return "IT Staff";
    case "ADMINISTRATOR":
      return "Administrator";
    default:
      return "Requester";
  }
}

function AuthenticatedHeader({ user }: { user: PublicUser }) {
  const activePage = readRoute().page;
  const { logout } = useAuth();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setLogoutError(null);
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/login");
    } catch {
      setLogoutError(
        "Unable to sign out. Your session is still active. Try again.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="lab2-shell-header auth-shell-header">
      <div className="auth-shell-brand">
        <p className="lab2-eyebrow">TokTickIT</p>
        <span className="lab2-shell-context">IT service desk</span>
      </div>
      <nav className="lab2-shell-nav" aria-label="Application navigation">
        {user.role === "REQUESTER" ? (
          <>
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
          </>
        ) : user.role === "IT_STAFF" ? (
          <button
            type="button"
            className={`btn btn-sm ${
              activePage === "staff-tickets" || activePage === "staff-detail"
                ? "btn-success"
                : "btn-outline-success"
            }`}
            aria-current={
              activePage === "staff-tickets" || activePage === "staff-detail"
                ? "page"
                : undefined
            }
            onClick={() => navigate("/staff/tickets")}
          >
            Ticket Queue
          </button>
        ) : user.role === "ADMINISTRATOR" ? (
          <button
            type="button"
            className={`btn btn-sm ${
              activePage === "users" ? "btn-success" : "btn-outline-success"
            }`}
            aria-current={activePage === "users" ? "page" : undefined}
            onClick={() => navigate("/admin/users")}
          >
            User Management
          </button>
        ) : null}
        <button
          type="button"
          className={`btn btn-sm ${
            activePage === "change-password"
              ? "btn-success"
              : "btn-outline-secondary"
          }`}
          aria-current={activePage === "change-password" ? "page" : undefined}
          onClick={() => navigate("/change-password")}
        >
          Password
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          aria-busy={isLoggingOut}
        >
          {isLoggingOut ? "Logging out..." : "Log out"}
        </button>
      </nav>
      {logoutError ? (
        <div className="auth-state auth-state-error" role="alert">
          {logoutError}
        </div>
      ) : null}
      <div className="auth-user-summary">
        <strong>{user.name}</strong>
        <span className="auth-role-badge">{roleLabel(user.role)}</span>
        <span>{user.email}</span>
      </div>
    </header>
  );
}

function RequesterWorkspace({ route }: { route: AppRoute }) {
  const { requester } = useRequester();
  if (!requester) {
    return null;
  }

  return (
    <>
      {route.page === "detail" ? (
        <RequesterTicketDetail
          ticketId={route.ticketId}
          onBack={() => navigate("/tickets")}
        />
      ) : route.page === "tickets" ? (
        <MyTickets onCreateTicket={() => navigate("/tickets/new")} />
      ) : route.page === "create" ? (
        <CreateTicket onBack={() => navigate("/tickets")} />
      ) : (
        <section className="lab2-panel" aria-labelledby="requester-home-title">
          <p className="lab2-eyebrow">Requester workspace</p>
          <h1 id="requester-home-title">Welcome, {requester.name}</h1>
          <p className="lab2-introduction">
            Use My Tickets to follow your requests or Create Ticket to report a
            new issue.
          </p>
          <div className="auth-home-actions">
            <button
              type="button"
              className="btn btn-success"
              onClick={() => navigate("/tickets")}
            >
              My Tickets
            </button>
            <button
              type="button"
              className="btn btn-outline-success"
              onClick={() => navigate("/tickets/new")}
            >
              Create Ticket
            </button>
          </div>
        </section>
      )}
    </>
  );
}

function RoleWorkspace({ user }: { user: PublicUser }) {
  return (
    <section
      className="lab2-panel auth-role-placeholder"
      aria-labelledby="role-workspace-title"
    >
      <p className="lab2-eyebrow">Authenticated workspace</p>
      <h1 id="role-workspace-title">{roleLabel(user.role)} access is ready</h1>
      <p className="lab2-introduction">
        You are signed in as {user.name}. The {roleLabel(user.role)} workflow is
        delivered in the next Lab 3 increment.
      </p>
    </section>
  );
}

function StaffWorkspace({
  route,
  user,
}: {
  route: AppRoute;
  user: PublicUser;
}) {
  if (route.page === "staff-detail") {
    return (
      <StaffTicketDetail
        ticketId={route.ticketId}
        onBack={() => navigate("/staff/tickets")}
      />
    );
  }

  if (route.page === "staff-tickets") {
    return <StaffTicketQueue />;
  }

  return <RoleWorkspace user={user} />;
}

function AuthenticatedApplication({ route }: { route: AppRoute }) {
  const { user } = useAuth();
  if (!user) {
    return null;
  }

  if (route.page === "change-password") {
    return <ChangePassword />;
  }

  return (
    <div className="lab2-shell">
      <AuthenticatedHeader user={user} />
      {user.role === "REQUESTER" ? (
        <RequesterProvider
          initialRequester={{
            id: user.id,
            name: user.name,
            email: user.email,
          }}
        >
          <RequesterWorkspace route={route} />
        </RequesterProvider>
      ) : user.role === "IT_STAFF" ? (
        <StaffWorkspace route={route} user={user} />
      ) : route.page === "users" ? (
        <UserManagement currentUserId={user.id} />
      ) : (
        <RoleWorkspace user={user} />
      )}
    </div>
  );
}

function AuthContent() {
  const { state, retry } = useAuth();
  const [route, setRoute] = useState<AppRoute>(readRoute);

  useEffect(() => {
    function handlePopState() {
      setRoute(readRoute());
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (
      state.status === "signed-out" &&
      window.location.pathname !== "/login"
    ) {
      navigate("/login");
    }
  }, [state.status]);

  if (state.status === "loading") {
    return (
      <section
        className="auth-panel auth-session-state"
        aria-labelledby="session-loading-title"
      >
        <p className="lab2-eyebrow">TokTickIT</p>
        <h1 id="session-loading-title">Restoring your session</h1>
        <p className="lab2-state" role="status" aria-live="polite">
          Checking your authenticated session...
        </p>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section
        className="auth-panel auth-session-state"
        aria-labelledby="session-error-title"
      >
        <p className="lab2-eyebrow">TokTickIT</p>
        <h1 id="session-error-title">Session unavailable</h1>
        <div className="auth-state auth-state-error" role="alert">
          {state.message}
        </div>
        <button
          type="button"
          className="btn btn-outline-success"
          onClick={() => void retry()}
        >
          Try again
        </button>
      </section>
    );
  }

  if (state.status === "signed-out") {
    return <Login />;
  }

  if (state.response.user.mustChangePassword) {
    return <ChangePassword />;
  }

  return <AuthenticatedApplication route={route} />;
}

export default function App() {
  return (
    <AuthProvider>
      <main className="lab2-page">
        <AuthContent />
      </main>
    </AuthProvider>
  );
}
