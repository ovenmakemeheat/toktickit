import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  apiErrorMessage,
  ApiRequestError,
  createUser,
  fetchUsers,
  setUserInitialPassword,
  updateUser,
  type Role,
  type UserListItem,
  type UserListQuery,
} from "../lib/api";

type UserManagementProps = {
  currentUserId?: number;
};

const roleOptions: Array<{ value: Role; label: string }> = [
  { value: "REQUESTER", label: "Requester" },
  { value: "IT_STAFF", label: "IT Staff" },
  { value: "ADMINISTRATOR", label: "Administrator" },
];

const passwordGuidance =
  "Use 12-128 characters with at least one letter, one number, and one non-alphanumeric character.";

type FormMode = "list" | "create" | "edit";

type FieldErrors = Record<string, string>;

function roleLabel(role: Role) {
  return (
    roleOptions.find((option) => option.value === role)?.label ?? "Requester"
  );
}

function isValidPassword(value: string) {
  return (
    value.length >= 12 &&
    value.length <= 128 &&
    /[A-Za-z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

function listError(error: unknown) {
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case "USER_MANAGEMENT_FORBIDDEN":
        return "Administrator permission is required to manage Users.";
      case "USER_QUERY_INVALID":
        return "One or more User list filters are invalid. Clear filters and try again.";
      case "SESSION_REQUIRED":
        return "Your session expired. Sign in again to continue.";
      default:
        return apiErrorMessage;
    }
  }
  return apiErrorMessage;
}

function formError(error: unknown) {
  if (error instanceof ApiRequestError) {
    switch (error.code) {
      case "EMAIL_ALREADY_EXISTS":
        return "A User with this email address already exists.";
      case "SELF_DEACTIVATION_NOT_ALLOWED":
        return "You cannot deactivate your own Administrator account.";
      case "LAST_ADMINISTRATOR_REQUIRED":
        return "The last active Administrator must stay active with the Administrator role.";
      case "USER_OWNS_TICKETS":
        return "This User owns existing Tickets and must stay an active IT Staff member or Administrator.";
      case "USER_NOT_FOUND":
        return "This User is no longer available. Refresh the list.";
      case "USER_MANAGEMENT_FORBIDDEN":
        return "Administrator permission is required to manage Users.";
      case "CSRF_TOKEN_INVALID":
        return "The security token expired. Reload the page and try again.";
      case "USER_INPUT_INVALID":
      case "PASSWORD_INPUT_INVALID":
        return "Check the highlighted fields and try again.";
      default:
        return apiErrorMessage;
    }
  }
  return apiErrorMessage;
}

function hasActiveQuery(query: UserListQuery) {
  return Boolean(query.search?.trim()) || Boolean(query.role);
}

export default function UserManagement({ currentUserId }: UserManagementProps) {
  const [query, setQuery] = useState<UserListQuery>({});
  const [users, setUsers] = useState<UserListItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const listRequestId = useRef(0);

  const [mode, setMode] = useState<FormMode>("list");
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("REQUESTER");
  const [active, setActive] = useState(true);
  const [initialPassword, setInitialPassword] = useState("");
  const [confirmInitialPassword, setConfirmInitialPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = useCallback(
    async (signal?: AbortSignal) => {
      const requestId = listRequestId.current + 1;
      listRequestId.current = requestId;
      setIsLoading(true);
      setLoadError(null);
      try {
        const nextUsers = await fetchUsers(query, signal);
        if (requestId === listRequestId.current) {
          setUsers(nextUsers);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (requestId === listRequestId.current) {
          setUsers(null);
          setLoadError(error);
        }
      } finally {
        if (requestId === listRequestId.current) {
          setIsLoading(false);
        }
      }
    },
    [query],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadUsers(controller.signal);
    return () => controller.abort();
  }, [loadUsers]);

  const activeQuery = hasActiveQuery(query);
  const selfSelected =
    currentUserId !== undefined && editing?.id === currentUserId;
  const activeDisabled = selfSelected;
  const listed = useMemo(() => users ?? [], [users]);

  function resetForm() {
    setName("");
    setEmail("");
    setRole("REQUESTER");
    setActive(true);
    setInitialPassword("");
    setConfirmInitialPassword("");
    setShowPasswordForm(false);
    setFieldErrors({});
    setFormErrorMessage(null);
  }

  function openCreate() {
    resetForm();
    setEditing(null);
    setSuccessMessage(null);
    setMode("create");
  }

  function openEdit(user: UserListItem) {
    resetForm();
    setEditing(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setActive(user.status === "ACTIVE");
    setSuccessMessage(null);
    setMode("edit");
  }

  function backToList() {
    resetForm();
    setEditing(null);
    setMode("list");
    void loadUsers();
  }

  function updateQuery(changes: Partial<UserListQuery>) {
    setQuery((current) => ({ ...current, ...changes }));
  }

  function clearFilters() {
    setQuery({});
  }

  function validateIdentityFields() {
    const errors: FieldErrors = {};
    if (!name.trim()) {
      errors.name = "Name is required.";
    } else if (name.trim().length > 120) {
      errors.name = "Name must be 120 characters or fewer.";
    }
    if (!email.trim()) {
      errors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    return errors;
  }

  function validatePasswordFields() {
    const errors: FieldErrors = {};
    if (!isValidPassword(initialPassword)) {
      errors.initialPassword = `Password must contain 12-128 characters, including a letter, a number, and a non-alphanumeric character.`;
    }
    if (initialPassword !== confirmInitialPassword) {
      errors.confirmInitialPassword =
        "Initial password and confirmation must match.";
    }
    return errors;
  }

  function applyApiFields(error: unknown) {
    if (
      error instanceof ApiRequestError &&
      error.fields &&
      error.fields.length > 0
    ) {
      setFieldErrors(
        Object.fromEntries(
          error.fields.map((field) => [field.field, field.message]),
        ),
      );
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = {
      ...validateIdentityFields(),
      ...validatePasswordFields(),
    };
    setFieldErrors(errors);
    setFormErrorMessage(null);
    if (Object.keys(errors).length > 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const created = await createUser({
        name: name.trim(),
        email: email.trim(),
        role,
        active,
        initialPassword,
        confirmInitialPassword,
      });
      resetForm();
      setMode("list");
      setSuccessMessage(
        `${created.name} was created and must change the initial password at the next sign-in.`,
      );
      await loadUsers();
    } catch (error) {
      applyApiFields(error);
      setFormErrorMessage(formError(error));
      setInitialPassword("");
      setConfirmInitialPassword("");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateIdentityFields();
    setFieldErrors(errors);
    setFormErrorMessage(null);
    if (Object.keys(errors).length > 0 || isSaving || !editing) {
      return;
    }

    const changes: {
      name?: string;
      email?: string;
      role?: Role;
      active?: boolean;
    } = {};
    if (name.trim() !== editing.name) {
      changes.name = name.trim();
    }
    if (email.trim() !== editing.email) {
      changes.email = email.trim();
    }
    if (role !== editing.role) {
      changes.role = role;
    }
    if (active !== (editing.status === "ACTIVE")) {
      changes.active = active;
    }

    if (Object.keys(changes).length === 0) {
      setSuccessMessage("No account changes were needed.");
      setMode("list");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateUser(editing.id, changes);
      resetForm();
      setEditing(null);
      setMode("list");
      setSuccessMessage(`${updated.name} was updated.`);
      await loadUsers();
    } catch (error) {
      applyApiFields(error);
      setFormErrorMessage(formError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleInitialPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) {
      return;
    }
    const errors = validatePasswordFields();
    setFieldErrors(errors);
    setFormErrorMessage(null);
    if (Object.keys(errors).length > 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await setUserInitialPassword(
        editing.id,
        initialPassword,
        confirmInitialPassword,
      );
      setInitialPassword("");
      setConfirmInitialPassword("");
      setShowPasswordForm(false);
      setFieldErrors({});
      setSuccessMessage(
        `A new initial password was set for ${editing.name}. Existing sessions are signed out and a change is required at the next sign-in.`,
      );
    } catch (error) {
      applyApiFields(error);
      setFormErrorMessage(formError(error));
      setInitialPassword("");
      setConfirmInitialPassword("");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      className="lab2-panel lab3-user-management-panel"
      aria-labelledby="user-management-title"
    >
      <div className="lab2-page-heading">
        <div>
          <p className="lab2-eyebrow">Administrator workspace</p>
          <h1 id="user-management-title">User Management</h1>
          <p className="lab2-introduction">
            List, search, create, and edit Lab 3 accounts. Deletion is not
            available; deactivate an account instead.
          </p>
        </div>
        <div className="auth-home-actions">
          <button
            type="button"
            className="btn btn-success"
            onClick={openCreate}
            disabled={mode === "create"}
          >
            Create user
          </button>
        </div>
      </div>

      {successMessage ? (
        <div
          className="lab2-state lab2-state-success"
          role="status"
          aria-live="polite"
        >
          <p>{successMessage}</p>
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={() => setSuccessMessage(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {mode === "list" ? (
        <>
          <div className="lab2-ticket-filters lab3-user-management-filters">
            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-7">
                <label className="form-label" htmlFor="user-search">
                  Search users
                </label>
                <input
                  id="user-search"
                  className="form-control"
                  value={query.search ?? ""}
                  onChange={(event) =>
                    updateQuery({ search: event.target.value })
                  }
                  placeholder="Name or email"
                />
              </div>
              <div className="col-12 col-md-5">
                <label className="form-label" htmlFor="user-role-filter">
                  Role
                </label>
                <select
                  id="user-role-filter"
                  className="form-select"
                  value={query.role ?? ""}
                  onChange={(event) =>
                    updateQuery({
                      role: event.target.value
                        ? (event.target.value as Role)
                        : undefined,
                    })
                  }
                >
                  <option value="">All roles</option>
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {activeQuery ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {isLoading ? (
            <p className="lab2-state" role="status" aria-live="polite">
              Loading Users...
            </p>
          ) : null}

          {loadError ? (
            <div className="lab2-state lab2-state-error" role="alert">
              <p>{listError(loadError)}</p>
              <button
                type="button"
                className="btn btn-outline-success"
                onClick={() => void loadUsers()}
              >
                Try again
              </button>
            </div>
          ) : null}

          {!isLoading && !loadError && listed.length === 0 ? (
            <div className="lab2-state" role="status">
              <p>
                {activeQuery
                  ? "No Users match the current search and role filter."
                  : "No Users are available yet. Create the first account."}
              </p>
              {activeQuery ? (
                <button
                  type="button"
                  className="btn btn-outline-success"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={openCreate}
                >
                  Create user
                </button>
              )}
            </div>
          ) : null}

          {!isLoading && !loadError && listed.length > 0 ? (
            <div className="lab2-ticket-table-wrapper lab3-user-table-wrapper">
              <table className="table align-middle lab2-ticket-table lab3-user-table">
                <caption className="visually-hidden">
                  Administrator User list
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Edit action</th>
                  </tr>
                </thead>
                <tbody>
                  {listed.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{roleLabel(user.role)}</td>
                      <td>
                        {user.status === "ACTIVE" ? "Active" : "Inactive"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success"
                          onClick={() => openEdit(user)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : (
        <section className="lab3-user-form" aria-labelledby="user-form-title">
          <h2 id="user-form-title">
            {mode === "create" ? "Create user" : `Edit ${editing?.name ?? ""}`}
          </h2>

          {formErrorMessage ? (
            <div className="lab2-state lab2-state-error" role="alert">
              <p>{formErrorMessage}</p>
            </div>
          ) : null}

          <form
            className="lab3-user-form-fields"
            aria-labelledby="user-form-title"
            onSubmit={
              mode === "create"
                ? (event) => void handleCreate(event)
                : (event) => void handleUpdate(event)
            }
            noValidate
          >
            <div className="mb-3">
              <label className="form-label" htmlFor="user-name">
                Name <span aria-hidden="true">*</span>
              </label>
              <input
                id="user-name"
                className="form-control"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                aria-required="true"
                aria-describedby={
                  fieldErrors.name ? "user-name-error" : undefined
                }
                aria-invalid={fieldErrors.name ? true : undefined}
              />
              {fieldErrors.name ? (
                <div
                  id="user-name-error"
                  className="auth-field-error"
                  role="alert"
                >
                  {fieldErrors.name}
                </div>
              ) : null}
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="user-email">
                Email address <span aria-hidden="true">*</span>
              </label>
              <input
                id="user-email"
                className="form-control"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                aria-required="true"
                aria-describedby={
                  fieldErrors.email ? "user-email-error" : undefined
                }
                aria-invalid={fieldErrors.email ? true : undefined}
              />
              {fieldErrors.email ? (
                <div
                  id="user-email-error"
                  className="auth-field-error"
                  role="alert"
                >
                  {fieldErrors.email}
                </div>
              ) : null}
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="user-role">
                Role <span aria-hidden="true">*</span>
              </label>
              <select
                id="user-role"
                className="form-select"
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
                required
                aria-required="true"
                aria-describedby={
                  fieldErrors.role ? "user-role-error" : undefined
                }
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {fieldErrors.role ? (
                <div
                  id="user-role-error"
                  className="auth-field-error"
                  role="alert"
                >
                  {fieldErrors.role}
                </div>
              ) : null}
            </div>

            <div className="form-check mb-3">
              <input
                id="user-active"
                className="form-check-input"
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
                disabled={activeDisabled}
                aria-describedby="user-active-help"
              />
              <label className="form-check-label" htmlFor="user-active">
                Account is active
              </label>
              <div id="user-active-help" className="form-text">
                {activeDisabled
                  ? "You cannot deactivate your own Administrator account."
                  : "Inactive accounts cannot sign in."}
              </div>
            </div>

            {mode === "create" ? (
              <>
                <div className="mb-3">
                  <label className="form-label" htmlFor="user-initial-password">
                    Initial password <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="user-initial-password"
                    className="form-control"
                    type="password"
                    autoComplete="new-password"
                    value={initialPassword}
                    onChange={(event) => setInitialPassword(event.target.value)}
                    required
                    aria-describedby="user-password-guidance user-initial-password-error"
                    aria-invalid={
                      fieldErrors.initialPassword ? true : undefined
                    }
                  />
                  <div id="user-password-guidance" className="form-text">
                    {passwordGuidance}
                  </div>
                  {fieldErrors.initialPassword ? (
                    <div
                      id="user-initial-password-error"
                      className="auth-field-error"
                      role="alert"
                    >
                      {fieldErrors.initialPassword}
                    </div>
                  ) : null}
                </div>

                <div className="mb-3">
                  <label
                    className="form-label"
                    htmlFor="user-confirm-initial-password"
                  >
                    Confirm initial password <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="user-confirm-initial-password"
                    className="form-control"
                    type="password"
                    autoComplete="new-password"
                    value={confirmInitialPassword}
                    onChange={(event) =>
                      setConfirmInitialPassword(event.target.value)
                    }
                    required
                    aria-describedby={
                      fieldErrors.confirmInitialPassword
                        ? "user-confirm-initial-password-error"
                        : undefined
                    }
                    aria-invalid={
                      fieldErrors.confirmInitialPassword ? true : undefined
                    }
                  />
                  {fieldErrors.confirmInitialPassword ? (
                    <div
                      id="user-confirm-initial-password-error"
                      className="auth-field-error"
                      role="alert"
                    >
                      {fieldErrors.confirmInitialPassword}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            <div className="auth-home-actions">
              <button
                type="submit"
                className="btn btn-success"
                disabled={isSaving}
              >
                {isSaving
                  ? "Saving..."
                  : mode === "create"
                    ? "Create user"
                    : "Save changes"}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={backToList}
                disabled={isSaving}
              >
                Back to list
              </button>
            </div>
          </form>

          {mode === "edit" ? (
            <div className="lab3-user-password-panel">
              <h3>Set new initial password</h3>
              <p className="lab2-introduction">
                The new password is stored as a hash, every existing session for
                this User is signed out, and a password change is required at
                the next sign-in.
              </p>
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={() => setShowPasswordForm((current) => !current)}
                aria-expanded={showPasswordForm}
              >
                Set new initial password
              </button>
              {showPasswordForm ? (
                <form
                  className="lab3-user-password-form"
                  aria-label="Set new initial password"
                  onSubmit={(event) => void handleInitialPassword(event)}
                  noValidate
                >
                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="reset-initial-password"
                    >
                      New initial password <span aria-hidden="true">*</span>
                    </label>
                    <input
                      id="reset-initial-password"
                      className="form-control"
                      type="password"
                      autoComplete="new-password"
                      value={initialPassword}
                      onChange={(event) =>
                        setInitialPassword(event.target.value)
                      }
                      required
                      aria-describedby="reset-password-guidance reset-initial-password-error"
                      aria-invalid={
                        fieldErrors.initialPassword ? true : undefined
                      }
                    />
                    <div id="reset-password-guidance" className="form-text">
                      {passwordGuidance}
                    </div>
                    {fieldErrors.initialPassword ? (
                      <div
                        id="reset-initial-password-error"
                        className="auth-field-error"
                        role="alert"
                      >
                        {fieldErrors.initialPassword}
                      </div>
                    ) : null}
                  </div>
                  <div className="mb-3">
                    <label
                      className="form-label"
                      htmlFor="reset-confirm-initial-password"
                    >
                      Confirm new initial password{" "}
                      <span aria-hidden="true">*</span>
                    </label>
                    <input
                      id="reset-confirm-initial-password"
                      className="form-control"
                      type="password"
                      autoComplete="new-password"
                      value={confirmInitialPassword}
                      onChange={(event) =>
                        setConfirmInitialPassword(event.target.value)
                      }
                      required
                      aria-describedby={
                        fieldErrors.confirmInitialPassword
                          ? "reset-confirm-initial-password-error"
                          : undefined
                      }
                      aria-invalid={
                        fieldErrors.confirmInitialPassword ? true : undefined
                      }
                    />
                    {fieldErrors.confirmInitialPassword ? (
                      <div
                        id="reset-confirm-initial-password-error"
                        className="auth-field-error"
                        role="alert"
                      >
                        {fieldErrors.confirmInitialPassword}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="submit"
                    className="btn btn-outline-danger"
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save new initial password"}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </section>
      )}
    </section>
  );
}
