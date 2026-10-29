import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  apiErrorMessage,
  ApiRequestError,
  createTicketActionTaken,
  fetchTicketActionsTaken,
  updateTicketActionTaken,
  type ActionTakenEntry,
  type CreateActionTakenInput,
} from "../lib/api";

type ActionsTakenPanelProps = {
  ticketId: number | string;
  canEdit: boolean;
  onChanged?: () => Promise<void>;
};

type ActionDraft = {
  actionAt: string;
  actionDescription: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
};

type DraftField = keyof ActionDraft;
type DraftValidationError = { field: DraftField; message: string };

function localDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "";
  }
  const local = new Date(date.valueOf() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function emptyDraft(): ActionDraft {
  return {
    actionAt: localDateTime(new Date().toISOString()),
    actionDescription: "",
    result: "",
    followUpRequired: false,
    followUpNote: "",
    attachmentNotes: "",
  };
}

function draftFromAction(action: ActionTakenEntry): ActionDraft {
  return {
    actionAt: localDateTime(action.actionAt),
    actionDescription: action.actionDescription,
    result: action.result,
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote ?? "",
    attachmentNotes: action.attachmentNotes ?? "",
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(date);
}

function roleLabel(role: ActionTakenEntry["performedBy"]["role"]) {
  return role === "ADMINISTRATOR"
    ? "Administrator"
    : role === "IT_STAFF"
      ? "IT Staff"
      : "Requester";
}

function validateDraft(draft: ActionDraft): DraftValidationError | null {
  if (!draft.actionAt || !Number.isFinite(new Date(draft.actionAt).valueOf())) {
    return { field: "actionAt", message: "Enter a valid Action Date/Time." };
  }
  if (!draft.actionDescription.trim()) {
    return {
      field: "actionDescription",
      message: "Action Description is required.",
    };
  }
  if (!draft.result.trim()) {
    return { field: "result", message: "Result is required." };
  }
  if (draft.followUpRequired && !draft.followUpNote.trim()) {
    return {
      field: "followUpNote",
      message: "Follow-up Note is required when Follow-Up Required is Yes.",
    };
  }
  const overLimit = (
    [
      ["actionDescription", draft.actionDescription],
      ["result", draft.result],
      ["followUpNote", draft.followUpNote],
      ["attachmentNotes", draft.attachmentNotes],
    ] as const
  ).find(([, value]) => value.trim().length > 2_000);
  if (overLimit) {
    return {
      field: overLimit[0],
      message: "This field must contain 2,000 characters or fewer.",
    };
  }
  return null;
}

function toInput(draft: ActionDraft): CreateActionTakenInput {
  return {
    actionAt: new Date(draft.actionAt).toISOString(),
    actionDescription: draft.actionDescription.trim(),
    result: draft.result.trim(),
    followUpRequired: draft.followUpRequired,
    followUpNote: draft.followUpRequired ? draft.followUpNote.trim() : null,
    attachmentNotes: draft.attachmentNotes.trim() || null,
  };
}

function requestError(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.code === "ACTION_TAKEN_CONFLICT") {
      return "This Action Taken changed elsewhere. The latest version is shown; your draft is preserved. Compare the values and save again only if the correction is still right.";
    }
    if (
      error.code === "TICKET_NOT_FOUND" ||
      error.code === "ACTION_TAKEN_NOT_FOUND"
    ) {
      return "This Ticket or Action Taken is no longer available. Refresh the history.";
    }
    if (error.code === "ACTION_TAKEN_FORBIDDEN") {
      return "Your role cannot create or edit Actions Taken.";
    }
  }
  return apiErrorMessage;
}

function newIdempotencyKey() {
  return crypto.randomUUID();
}

export default function ActionsTakenPanel({
  ticketId,
  canEdit,
  onChanged,
}: ActionsTakenPanelProps) {
  const [items, setItems] = useState<ActionTakenEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ActionDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expectedVersion, setExpectedVersion] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [validationError, setValidationError] =
    useState<DraftValidationError | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [requiresConflictReview, setRequiresConflictReview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingKey, setPendingKey] = useState<{
    signature: string;
    key: string;
  } | null>(null);

  const loadActions = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setItems(await fetchTicketActionsTaken(ticketId));
    } catch (error) {
      setLoadError(requestError(error));
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void loadActions();
  }, [loadActions]);

  useEffect(() => {
    if (isLoading || !window.location.hash.startsWith("#action-taken-")) {
      return;
    }
    const target = document.getElementById(window.location.hash.slice(1));
    target?.focus({ preventScroll: true });
    target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [isLoading]);

  function beginCreate() {
    setIsCreateOpen(true);
    setEditingId(null);
    setExpectedVersion(null);
    setDraft(emptyDraft());
    setValidationError(null);
    setOperationError(null);
    setSuccessMessage(null);
    setRequiresConflictReview(false);
    setPendingKey(null);
  }

  function beginEdit(action: ActionTakenEntry) {
    setIsCreateOpen(false);
    setEditingId(action.id);
    setExpectedVersion(action.version);
    setDraft(draftFromAction(action));
    setValidationError(null);
    setOperationError(null);
    setSuccessMessage(null);
    setRequiresConflictReview(false);
    setPendingKey(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setExpectedVersion(null);
    setIsCreateOpen(false);
    setDraft(emptyDraft());
    setValidationError(null);
    setOperationError(null);
    setRequiresConflictReview(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) {
      return;
    }
    const validation = validateDraft(draft);
    setValidationError(validation);
    setOperationError(null);
    setSuccessMessage(null);
    if (validation) {
      document.getElementById(`action-taken-${validation.field}`)?.focus();
      return;
    }

    setIsSaving(true);
    try {
      const input = toInput(draft);
      if (editingId !== null) {
        await updateTicketActionTaken(ticketId, editingId, {
          ...input,
          expectedVersion: expectedVersion ?? 1,
        });
      } else {
        const signature = JSON.stringify(input);
        const key =
          pendingKey?.signature === signature
            ? pendingKey.key
            : newIdempotencyKey();
        setPendingKey({ signature, key });
        await createTicketActionTaken(ticketId, input, key);
      }
      await loadActions();
      await onChanged?.();
      setSuccessMessage(
        editingId === null ? "Action Taken recorded." : "Action Taken updated.",
      );
      setRequiresConflictReview(false);
      setEditingId(null);
      setExpectedVersion(null);
      setIsCreateOpen(false);
      setDraft(emptyDraft());
      setPendingKey(null);
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === "ACTION_TAKEN_INPUT_INVALID" &&
        error.fields?.[0]
      ) {
        const field = error.fields[0].field as DraftField;
        setValidationError({ field, message: error.fields[0].message });
      } else if (
        error instanceof ApiRequestError &&
        error.code === "ACTION_TAKEN_CONFLICT" &&
        editingId !== null
      ) {
        try {
          const latest = await fetchTicketActionsTaken(ticketId);
          setItems(latest);
          setExpectedVersion(
            latest.find((item) => item.id === editingId)?.version ??
              expectedVersion,
          );
        } catch {
          // Keep the draft visible even if refreshing the current version fails.
        }
        setRequiresConflictReview(true);
        setOperationError(requestError(error));
      } else {
        setOperationError(requestError(error));
      }
    } finally {
      setIsSaving(false);
    }
  }

  const editing = editingId !== null;
  const showForm = canEdit && (isCreateOpen || editing);

  return (
    <section
      className="lab3-communication-panel"
      aria-labelledby="actions-taken-title"
    >
      <div className="lab2-page-heading">
        <div>
          <p className="lab2-eyebrow">Work history</p>
          <h2 id="actions-taken-title">Actions Taken</h2>
          <p className="lab2-introduction">
            Actions Taken are visible to the Requester of this Ticket. Work is
            listed by when each action occurred.
          </p>
        </div>
      </div>

      {successMessage ? (
        <p className="lab2-state lab2-state-success" role="status">
          {successMessage}
        </p>
      ) : null}
      {operationError ? (
        <p className="lab2-state lab2-state-error" role="alert">
          {operationError}
        </p>
      ) : null}

      {isLoading ? (
        <p className="lab2-state" role="status" aria-live="polite">
          Loading Actions Taken...
        </p>
      ) : loadError ? (
        <div className="lab2-state lab2-state-error" role="alert">
          <p>{loadError}</p>
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={() => void loadActions()}
          >
            Retry Actions Taken
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="lab2-state" role="status">
          No Actions Taken have been recorded for this Ticket.
        </p>
      ) : (
        <ol className="lab3-communication-list" aria-label="Actions Taken">
          {items.map((action) => (
            <li
              className="lab3-communication-entry"
              id={`action-taken-${action.id}`}
              key={action.id}
              tabIndex={-1}
            >
              <div className="lab3-communication-meta">
                <strong>
                  Performed by {action.performedBy.name} (
                  {roleLabel(action.performedBy.role)})
                </strong>
                <time dateTime={action.actionAt}>
                  Action Date/Time (UTC): {formatDate(action.actionAt)}
                </time>
                <span>Recorded {formatDate(action.createdAt)}</span>
                {action.updatedBy ? (
                  <span>
                    Updated by {action.updatedBy.name} on{" "}
                    {formatDate(action.updatedAt)}
                  </span>
                ) : null}
              </div>
              <h3 className="h6">Action Description</h3>
              <p>{action.actionDescription}</p>
              <h3 className="h6">Result</h3>
              <p>{action.result}</p>
              <p>
                <strong>Follow-Up Required:</strong>{" "}
                {action.followUpRequired ? "Yes" : "No"}
              </p>
              {action.followUpNote ? (
                <p>
                  <strong>Follow-up Note:</strong> {action.followUpNote}
                </p>
              ) : null}
              {action.attachmentNotes ? (
                <p>
                  <strong>Attachment Notes:</strong> {action.attachmentNotes}
                </p>
              ) : null}
              {editingId === action.id ? (
                <p className="form-text">Editing version {expectedVersion}.</p>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success"
                  onClick={() => beginEdit(action)}
                  disabled={isSaving || editing || isCreateOpen}
                >
                  Edit Action Taken
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {canEdit && !editing ? (
        <button
          type="button"
          className="btn btn-outline-success"
          onClick={isCreateOpen ? cancelEdit : beginCreate}
          disabled={isSaving}
        >
          {isCreateOpen ? "Cancel Action Taken" : "Add Action Taken"}
        </button>
      ) : null}

      {showForm ? (
        <form className="lab3-communication-form" onSubmit={handleSubmit}>
          <h3 className="h5">
            {editing ? "Edit Action Taken" : "Add Action Taken"}
          </h3>
          {editing ? (
            <p className="form-text">
              Editing version {expectedVersion}. Performer and record creation
              details cannot be changed.
            </p>
          ) : null}
          <div className="mb-3">
            <label className="form-label" htmlFor="action-taken-actionAt">
              Action Date/Time
            </label>
            <input
              id="action-taken-actionAt"
              className="form-control"
              type="datetime-local"
              value={draft.actionAt}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  actionAt: event.target.value,
                }))
              }
              aria-describedby="action-taken-actionAt-help"
              aria-invalid={validationError?.field === "actionAt" || undefined}
              disabled={isSaving}
              required
            />
            <div id="action-taken-actionAt-help" className="form-text">
              Displayed in your local timezone and stored in UTC.
            </div>
            {validationError?.field === "actionAt" ? (
              <div className="lab2-field-error" role="alert">
                {validationError.message}
              </div>
            ) : null}
          </div>
          <div className="mb-3">
            <label
              className="form-label"
              htmlFor="action-taken-actionDescription"
            >
              Action Description
            </label>
            <textarea
              id="action-taken-actionDescription"
              className="form-control"
              rows={3}
              maxLength={2_000}
              value={draft.actionDescription}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  actionDescription: event.target.value,
                }))
              }
              aria-invalid={
                validationError?.field === "actionDescription" || undefined
              }
              aria-describedby="action-taken-actionDescription-help"
              disabled={isSaving}
              required
            />
            <div id="action-taken-actionDescription-help" className="form-text">
              Required, up to 2,000 characters.
            </div>
            {validationError?.field === "actionDescription" ? (
              <div className="lab2-field-error" role="alert">
                {validationError.message}
              </div>
            ) : null}
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="action-taken-result">
              Result
            </label>
            <textarea
              id="action-taken-result"
              className="form-control"
              rows={3}
              maxLength={2_000}
              value={draft.result}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  result: event.target.value,
                }))
              }
              aria-invalid={validationError?.field === "result" || undefined}
              aria-describedby="action-taken-result-help"
              disabled={isSaving}
              required
            />
            <div id="action-taken-result-help" className="form-text">
              Required, up to 2,000 characters.
            </div>
            {validationError?.field === "result" ? (
              <div className="lab2-field-error" role="alert">
                {validationError.message}
              </div>
            ) : null}
          </div>
          <div className="mb-3">
            <label
              className="form-label"
              htmlFor="action-taken-followUpRequired"
            >
              Follow-Up Required?
            </label>
            <select
              id="action-taken-followUpRequired"
              className="form-select"
              value={draft.followUpRequired ? "yes" : "no"}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  followUpRequired: event.target.value === "yes",
                  followUpNote:
                    event.target.value === "yes" ? current.followUpNote : "",
                }))
              }
              required
              disabled={isSaving}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          {draft.followUpRequired ? (
            <div className="mb-3">
              <label className="form-label" htmlFor="action-taken-followUpNote">
                Follow-up Note
              </label>
              <textarea
                id="action-taken-followUpNote"
                className="form-control"
                rows={2}
                maxLength={2_000}
                value={draft.followUpNote}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    followUpNote: event.target.value,
                  }))
                }
                aria-invalid={
                  validationError?.field === "followUpNote" || undefined
                }
                aria-describedby="action-taken-followUpNote-help"
                disabled={isSaving}
                required
              />
              <div id="action-taken-followUpNote-help" className="form-text">
                Required when Follow-Up Required is Yes; up to 2,000 characters.
              </div>
              {validationError?.field === "followUpNote" ? (
                <div className="lab2-field-error" role="alert">
                  {validationError.message}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mb-3">
            <label
              className="form-label"
              htmlFor="action-taken-attachmentNotes"
            >
              Attachment Notes
            </label>
            <textarea
              id="action-taken-attachmentNotes"
              className="form-control"
              rows={2}
              maxLength={2_000}
              value={draft.attachmentNotes}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  attachmentNotes: event.target.value,
                }))
              }
              aria-invalid={
                validationError?.field === "attachmentNotes" || undefined
              }
              aria-describedby="action-taken-attachmentNotes-help"
              disabled={isSaving}
            />
            <div id="action-taken-attachmentNotes-help" className="form-text">
              Optional text reference to existing Ticket evidence; this does not
              upload a file.
            </div>
            {validationError?.field === "attachmentNotes" ? (
              <div className="lab2-field-error" role="alert">
                {validationError.message}
              </div>
            ) : null}
          </div>
          <div className="lab2-form-actions">
            <button
              type="submit"
              className="btn btn-success"
              disabled={isSaving}
            >
              {isSaving
                ? "Saving..."
                : editing && requiresConflictReview
                  ? `Reapply changes to version ${expectedVersion}`
                  : editing
                    ? "Save Action Taken"
                    : "Record Action Taken"}
            </button>
            {editing ? (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={cancelEdit}
                disabled={isSaving}
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
