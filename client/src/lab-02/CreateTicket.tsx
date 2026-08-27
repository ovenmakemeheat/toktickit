import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  apiErrorMessage,
  ApiRequestError,
  createTicket,
  fetchCategories,
  fetchRelatedSystems,
  type Category,
  type RelatedSystem,
  type RequestedPriority,
  type TicketDetail,
} from "../lib/api";
import {
  validateAttachmentSelection,
  type AttachmentValidationResult,
} from "../lib/attachment-policy";
import { useDevelopmentRequester } from "./requester-context";

type CreateTicketProps = {
  onBack: () => void;
};

type ReferenceLoadState = "loading" | "ready" | "empty" | "error";
type SubmitState = "idle" | "submitting" | "success";
type FieldErrors = Record<string, string>;

function createClientRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === "x" ? random : (random & 3) | 8;
      return value.toString(16);
    },
  );
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateForm(
  categoryId: string,
  relatedSystemId: string,
  requestedPriority: string,
  summary: string,
  description: string,
  attachments: AttachmentValidationResult[],
) {
  const errors: FieldErrors = {};

  if (!categoryId) {
    errors.categoryId = "Category is required.";
  }

  if (!relatedSystemId) {
    errors.relatedSystemId = "Related System is required.";
  }

  if (!requestedPriority) {
    errors.requestedPriority = "Requested Priority is required.";
  }

  const normalizedSummary = summary.trim();
  if (normalizedSummary.length < 5 || normalizedSummary.length > 120) {
    errors.summary = "Summary must contain 5-120 characters after trimming.";
  }

  const normalizedDescription = description.trim();
  if (
    normalizedDescription.length < 20 ||
    normalizedDescription.length > 4000
  ) {
    errors.description =
      "Description must contain 20-4000 characters after trimming.";
  }

  if (attachments.some((attachment) => attachment.error)) {
    errors.attachments = "Remove or replace the rejected attachment(s).";
  }

  return errors;
}

function fieldProps(field: string, errors: FieldErrors) {
  const errorId = `${field}-error`;
  return {
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? errorId : undefined,
  };
}

function FieldError({ field, errors }: { field: string; errors: FieldErrors }) {
  const message = errors[field];
  return message ? (
    <div id={`${field}-error`} className="lab2-field-error" role="alert">
      {message}
    </div>
  ) : null;
}

export default function CreateTicket({ onBack }: CreateTicketProps) {
  const { selectedRequester } = useDevelopmentRequester();
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [referenceLoadState, setReferenceLoadState] =
    useState<ReferenceLoadState>("loading");
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [relatedSystemId, setRelatedSystemId] = useState("");
  const [requestedPriority, setRequestedPriority] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<AttachmentValidationResult[]>(
    [],
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<TicketDetail | null>(null);
  const [clientRequestId, setClientRequestId] = useState(createClientRequestId);

  const loadReferences = useCallback(async () => {
    setReferenceLoadState("loading");
    setReferenceError(null);

    try {
      const [activeCategories, activeRelatedSystems] = await Promise.all([
        fetchCategories(),
        fetchRelatedSystems(),
      ]);
      setCategories(activeCategories);
      setRelatedSystems(activeRelatedSystems);
      setReferenceLoadState(
        activeCategories.length > 0 && activeRelatedSystems.length > 0
          ? "ready"
          : "empty",
      );
    } catch {
      setCategories([]);
      setRelatedSystems([]);
      setReferenceLoadState("error");
      setReferenceError(apiErrorMessage);
    }
  }, []);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  if (!selectedRequester) {
    return null;
  }

  const requesterId = selectedRequester.id;

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    setAttachments(validateAttachmentSelection(selectedFiles));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.attachments;
      return next;
    });
    event.target.value = "";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (referenceLoadState !== "ready" || submitState === "submitting") {
      return;
    }

    const errors = validateForm(
      categoryId,
      relatedSystemId,
      requestedPriority,
      summary,
      description,
      attachments,
    );
    setFieldErrors(errors);
    setSubmitError(null);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitState("submitting");
    void createTicket(requesterId, {
      clientRequestId,
      categoryId: Number(categoryId),
      relatedSystemId: Number(relatedSystemId),
      requestedPriority: requestedPriority as RequestedPriority,
      summary: summary.trim(),
      description: description.trim(),
    })
      .then((ticket) => {
        setCreatedTicket(ticket);
        setSubmitState("success");
      })
      .catch((error: unknown) => {
        setSubmitState("idle");
        if (error instanceof ApiRequestError && error.fields) {
          const serverFieldErrors = Object.fromEntries(
            error.fields
              .filter((field) => field.field !== "body")
              .map((field) => [field.field, field.message]),
          );
          setFieldErrors((current) => ({ ...current, ...serverFieldErrors }));
        }
        setSubmitError(apiErrorMessage);
      });
  }

  function resetForAnotherTicket() {
    setCategoryId("");
    setRelatedSystemId("");
    setRequestedPriority("");
    setSummary("");
    setDescription("");
    setAttachments([]);
    setFieldErrors({});
    setSubmitError(null);
    setCreatedTicket(null);
    setSubmitState("idle");
    setClientRequestId(createClientRequestId());
  }

  return (
    <section
      className="lab2-panel lab2-create-panel"
      aria-labelledby="create-ticket-title"
    >
      <p className="lab2-eyebrow">Requester ticket workspace</p>
      <h1 id="create-ticket-title">Create Ticket</h1>
      <p className="lab2-introduction">
        Describe the issue for the selected Development Requester. Ticket Number
        and Ticket Date are generated by the server after submission.
      </p>

      <div className="lab2-requester-summary">
        <span className="lab2-summary-label">
          Current Development Requester
        </span>
        <strong>{selectedRequester.name}</strong>
        <span>{selectedRequester.email}</span>
      </div>

      {referenceLoadState === "loading" ? (
        <p className="lab2-state" role="status" aria-live="polite">
          Loading Categories and Related Systems...
        </p>
      ) : null}

      {referenceLoadState === "empty" ? (
        <div className="lab2-state" role="alert">
          <p>Active Category and Related System references are unavailable.</p>
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={() => void loadReferences()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {referenceLoadState === "error" ? (
        <div className="lab2-state lab2-state-error" role="alert">
          <p>{referenceError}</p>
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={() => void loadReferences()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {referenceLoadState === "ready" ? (
        <form onSubmit={handleSubmit} noValidate>
          <div className="lab2-readonly-grid">
            <div>
              <label className="form-label" htmlFor="ticket-number">
                Ticket Number
              </label>
              <input
                id="ticket-number"
                className="form-control lab2-readonly"
                value={
                  createdTicket?.ticketNumber ?? "Generated after submission"
                }
                readOnly
                aria-readonly="true"
              />
            </div>
            <div>
              <label className="form-label" htmlFor="ticket-date">
                Ticket Date
              </label>
              <input
                id="ticket-date"
                className="form-control lab2-readonly"
                value={
                  createdTicket?.ticketDate ?? "Generated after submission"
                }
                readOnly
                aria-readonly="true"
              />
            </div>
          </div>

          <fieldset className="lab2-fieldset">
            <legend>Classification</legend>
            <div className="lab2-form-grid">
              <div>
                <label className="form-label" htmlFor="category">
                  Category <span aria-hidden="true">*</span>
                </label>
                <select
                  id="category"
                  className="form-select"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  required
                  {...fieldProps("categoryId", fieldErrors)}
                >
                  <option value="">Choose a Category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <FieldError field="categoryId" errors={fieldErrors} />
              </div>

              <div>
                <label className="form-label" htmlFor="related-system">
                  Related System <span aria-hidden="true">*</span>
                </label>
                <select
                  id="related-system"
                  className="form-select"
                  value={relatedSystemId}
                  onChange={(event) => setRelatedSystemId(event.target.value)}
                  required
                  {...fieldProps("relatedSystemId", fieldErrors)}
                >
                  <option value="">Choose a Related System</option>
                  {relatedSystems.map((relatedSystem) => (
                    <option key={relatedSystem.id} value={relatedSystem.id}>
                      {relatedSystem.name}
                    </option>
                  ))}
                </select>
                <FieldError field="relatedSystemId" errors={fieldErrors} />
              </div>

              <div>
                <label className="form-label" htmlFor="requested-priority">
                  Requested Priority <span aria-hidden="true">*</span>
                </label>
                <select
                  id="requested-priority"
                  className="form-select"
                  value={requestedPriority}
                  onChange={(event) => setRequestedPriority(event.target.value)}
                  required
                  {...fieldProps("requestedPriority", fieldErrors)}
                >
                  <option value="">Choose a Requested Priority</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
                <FieldError field="requestedPriority" errors={fieldErrors} />
              </div>
            </div>
          </fieldset>

          <div className="mb-3">
            <label className="form-label" htmlFor="summary">
              Summary <span aria-hidden="true">*</span>
            </label>
            <input
              id="summary"
              className="form-control"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              minLength={5}
              maxLength={120}
              required
              {...fieldProps("summary", fieldErrors)}
            />
            <div className="form-text">5-120 characters after trimming.</div>
            <FieldError field="summary" errors={fieldErrors} />
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="description">
              Description <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="description"
              className="form-control"
              rows={6}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              minLength={20}
              maxLength={4000}
              required
              {...fieldProps("description", fieldErrors)}
            />
            <div className="form-text">20-4000 characters after trimming.</div>
            <FieldError field="description" errors={fieldErrors} />
          </div>

          <div className="mb-4">
            <label className="form-label" htmlFor="attachments">
              Attachments
            </label>
            <input
              id="attachments"
              className="form-control"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              multiple
              onChange={handleAttachmentChange}
              {...fieldProps("attachments", fieldErrors)}
            />
            <div className="form-text">
              Optional. JPG, JPEG, PNG, WEBP, or PDF; up to 5 MB each and 5
              active files. Files upload after the ticket is created.
            </div>
            <FieldError field="attachments" errors={fieldErrors} />
            {attachments.length > 0 ? (
              <ul
                className="lab2-attachment-list"
                aria-label="Selected attachments"
              >
                {attachments.map(({ file, error }) => (
                  <li key={`${file.name}-${file.lastModified}-${file.size}`}>
                    <span>
                      {file.name} ({formatFileSize(file.size)})
                    </span>
                    {error ? (
                      <span className="lab2-field-error" role="alert">
                        {error}
                      </span>
                    ) : (
                      <span className="lab2-attachment-ready">
                        Ready for upload after ticket creation
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {submitError ? (
            <div className="lab2-state lab2-state-error" role="alert">
              {submitError}
            </div>
          ) : null}

          {createdTicket ? (
            <div
              className="lab2-state lab2-state-success"
              role="status"
              aria-live="polite"
            >
              <strong>Ticket created: {createdTicket.ticketNumber}</strong>
              <span>Ticket Date: {createdTicket.ticketDate}</span>
              <span>Status: New</span>
              {attachments.length > 0 ? (
                <span>
                  Selected attachments are ready for the separate upload step.
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="lab2-form-actions">
            <button
              type="submit"
              className="btn btn-success"
              disabled={submitState === "submitting"}
            >
              {submitState === "submitting" ? "Submitting..." : "Submit"}
            </button>
            {createdTicket ? (
              <button
                type="button"
                className="btn btn-outline-success"
                onClick={resetForAnotherTicket}
              >
                Create another ticket
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onBack}
            >
              Back to requester summary
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
