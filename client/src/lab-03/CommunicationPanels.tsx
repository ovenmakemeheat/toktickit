import { useState } from "react";

import {
  apiErrorMessage,
  ApiRequestError,
  type TicketCommunicationEntry,
} from "../lib/api";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function roleLabel(role: TicketCommunicationEntry["author"]["role"]) {
  switch (role) {
    case "IT_STAFF":
      return "IT Staff";
    case "ADMINISTRATOR":
      return "Administrator";
    default:
      return "Requester";
  }
}

function contentError(content: string) {
  const trimmed = content.trim();
  if (!trimmed) {
    return "Enter a comment before posting.";
  }
  if (trimmed.length > 2_000) {
    return "Comments must be 2,000 characters or fewer.";
  }
  return null;
}

function requestError(error: unknown) {
  if (error instanceof ApiRequestError && error.code === "TICKET_NOT_FOUND") {
    return "This Ticket is no longer available.";
  }
  return apiErrorMessage;
}

type PublicCommentsPanelProps = {
  comments: TicketCommunicationEntry[];
  onPost?: (content: string) => Promise<void>;
};

export function PublicCommentsPanel({
  comments,
  onPost,
}: PublicCommentsPanelProps) {
  const [content, setContent] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [requestErrorMessage, setRequestErrorMessage] = useState<string | null>(
    null,
  );
  const [isPosting, setIsPosting] = useState(false);

  async function handleSubmit() {
    if (!onPost || isPosting) {
      return;
    }

    const error = contentError(content);
    setValidationError(error);
    setRequestErrorMessage(null);
    if (error) {
      return;
    }

    setIsPosting(true);
    try {
      await onPost(content.trim());
      setContent("");
    } catch (requestErrorValue) {
      setRequestErrorMessage(requestError(requestErrorValue));
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <section
      className="lab3-communication-panel lab3-public-comments"
      aria-labelledby="public-comments-title"
    >
      <div className="lab2-page-heading">
        <div>
          <p className="lab2-eyebrow">Shared communication</p>
          <h2 id="public-comments-title">Public Comments</h2>
          <p className="lab2-introduction">
            Visible to the Requester and service desk team. Comments are
            append-only.
          </p>
        </div>
      </div>
      {comments.length === 0 ? (
        <p className="lab2-state" role="status">
          No Public Comments have been posted.
        </p>
      ) : (
        <ol className="lab3-communication-list" aria-label="Public Comments">
          {comments.map((comment) => (
            <li className="lab3-communication-entry" key={comment.id}>
              <div className="lab3-communication-meta">
                <strong>{comment.author.name}</strong>
                <span>{roleLabel(comment.author.role)}</span>
                <time dateTime={comment.createdAt}>
                  {formatDate(comment.createdAt)}
                </time>
              </div>
              <p>{comment.content}</p>
            </li>
          ))}
        </ol>
      )}
      {onPost ? (
        <div className="lab3-communication-form">
          <label className="form-label" htmlFor="public-comment-content">
            Add Public Comment
          </label>
          <textarea
            id="public-comment-content"
            className="form-control"
            rows={4}
            maxLength={2_000}
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setValidationError(null);
              setRequestErrorMessage(null);
            }}
            aria-describedby="public-comment-guidance"
            aria-invalid={validationError ? true : undefined}
            disabled={isPosting}
          />
          <div id="public-comment-guidance" className="form-text">
            Required. Use 1-2,000 characters. HTML is displayed as text.
          </div>
          {validationError ? (
            <div className="lab2-field-error" role="alert">
              {validationError}
            </div>
          ) : null}
          {requestErrorMessage ? (
            <div className="lab2-state lab2-state-error" role="alert">
              {requestErrorMessage}
            </div>
          ) : null}
          <button
            type="button"
            className="btn btn-success"
            onClick={() => void handleSubmit()}
            disabled={isPosting}
          >
            {isPosting ? "Posting..." : "Post public comment"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

type InternalNotesPanelProps = {
  notes: TicketCommunicationEntry[];
  onPost?: (content: string) => Promise<void>;
};

export function InternalNotesPanel({ notes, onPost }: InternalNotesPanelProps) {
  const [content, setContent] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [requestErrorMessage, setRequestErrorMessage] = useState<string | null>(
    null,
  );
  const [isPosting, setIsPosting] = useState(false);

  async function handleSubmit() {
    if (!onPost || isPosting) {
      return;
    }

    const error = contentError(content);
    setValidationError(error);
    setRequestErrorMessage(null);
    if (error) {
      return;
    }

    setIsPosting(true);
    try {
      await onPost(content.trim());
      setContent("");
    } catch (requestErrorValue) {
      setRequestErrorMessage(requestError(requestErrorValue));
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <section
      className="lab3-communication-panel lab3-internal-notes"
      aria-labelledby="internal-notes-title"
    >
      <div className="lab2-page-heading">
        <div>
          <p className="lab2-eyebrow">Private service desk record</p>
          <h2 id="internal-notes-title">Internal Notes</h2>
          <p className="lab3-private-warning">
            Visible only to IT Staff and Administrators. Never post private
            investigation details as a Public Comment.
          </p>
        </div>
      </div>
      {notes.length === 0 ? (
        <p className="lab2-state" role="status">
          No Internal Notes have been added.
        </p>
      ) : (
        <ol className="lab3-communication-list" aria-label="Internal Notes">
          {notes.map((note) => (
            <li className="lab3-communication-entry" key={note.id}>
              <div className="lab3-communication-meta">
                <strong>{note.author.name}</strong>
                <span>{roleLabel(note.author.role)}</span>
                <time dateTime={note.createdAt}>
                  {formatDate(note.createdAt)}
                </time>
              </div>
              <p>{note.content}</p>
            </li>
          ))}
        </ol>
      )}
      {onPost ? (
        <div className="lab3-communication-form">
          <label className="form-label" htmlFor="internal-note-content">
            Add Internal Note
          </label>
          <textarea
            id="internal-note-content"
            className="form-control"
            rows={4}
            maxLength={2_000}
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setValidationError(null);
              setRequestErrorMessage(null);
            }}
            aria-describedby="internal-note-guidance"
            aria-invalid={validationError ? true : undefined}
            disabled={isPosting}
          />
          <div id="internal-note-guidance" className="form-text">
            Required. Use 1-2,000 characters. Notes are append-only.
          </div>
          {validationError ? (
            <div className="lab2-field-error" role="alert">
              {validationError}
            </div>
          ) : null}
          {requestErrorMessage ? (
            <div className="lab2-state lab2-state-error" role="alert">
              {requestErrorMessage}
            </div>
          ) : null}
          <button
            type="button"
            className="btn btn-outline-success"
            onClick={() => void handleSubmit()}
            disabled={isPosting}
          >
            {isPosting ? "Saving..." : "Add internal note"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
