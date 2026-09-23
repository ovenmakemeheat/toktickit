import { useState, type FormEvent } from "react";

import { useAuth } from "../auth-context";
import { ApiRequestError } from "../lib/api";
import { navigate } from "../lib/navigation";

const passwordGuidance =
  "Use 12-128 characters with at least one letter, one number, and one non-alphanumeric character.";

type FieldErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

function validate(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): FieldErrors {
  const errors: FieldErrors = {};
  if (!currentPassword) {
    errors.currentPassword = "Current password is required.";
  }
  if (
    newPassword.length < 12 ||
    newPassword.length > 128 ||
    !/[A-Za-z]/.test(newPassword) ||
    !/[0-9]/.test(newPassword) ||
    !/[^A-Za-z0-9]/.test(newPassword)
  ) {
    errors.newPassword =
      "Password must contain 12-128 characters, including a letter, a number, and a non-alphanumeric character.";
  }
  if (newPassword !== confirmPassword) {
    errors.confirmPassword = "New password and confirmation must match.";
  }
  return errors;
}

function apiErrorMessage(error: unknown) {
  if (!(error instanceof ApiRequestError)) {
    return "Unable to connect to TokTickIT API. Try again.";
  }
  switch (error.code) {
    case "CURRENT_PASSWORD_INVALID":
      return "Current password is incorrect.";
    case "PASSWORD_REUSE_NOT_ALLOWED":
      return "Choose a password different from the current password.";
    case "SESSION_REQUIRED":
      return "Your session expired. Sign in again to continue.";
    case "CSRF_TOKEN_INVALID":
      return "The security token expired. Reload the page and try again.";
    default:
      return "Unable to save the new password. Check the form and try again.";
  }
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <div id={id} className="auth-field-error" role="alert">
      {message}
    </div>
  ) : null;
}

export default function ChangePassword() {
  const { user, changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate(currentPassword, newPassword, confirmPassword);
    setFieldErrors(errors);
    setSubmitError(null);
    if (Object.keys(errors).length > 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      navigate("/");
    } catch (error) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (error instanceof ApiRequestError && error.fields) {
        setFieldErrors(
          Object.fromEntries(
            error.fields.map((field) => [field.field, field.message]),
          ),
        );
      }
      setSubmitError(apiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-panel" aria-labelledby="change-password-title">
      <div className="auth-brand">
        <p className="lab2-eyebrow">TokTickIT account security</p>
        <h1 id="change-password-title">Change your initial password</h1>
        <p className="lab2-introduction">
          {user?.name ?? "Your account"} must choose a new password before the
          normal application is available.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-form-field">
          <label className="form-label" htmlFor="current-password">
            Current password <span aria-hidden="true">*</span>
          </label>
          <input
            id="current-password"
            className="form-control"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              setFieldErrors((current) => ({
                ...current,
                currentPassword: undefined,
              }));
              setSubmitError(null);
            }}
            aria-invalid={fieldErrors.currentPassword ? true : undefined}
            aria-describedby={
              fieldErrors.currentPassword ? "current-password-error" : undefined
            }
            disabled={isSubmitting}
          />
          <FieldError
            id="current-password-error"
            message={fieldErrors.currentPassword}
          />
        </div>

        <div className="auth-form-field">
          <label className="form-label" htmlFor="new-password">
            New password <span aria-hidden="true">*</span>
          </label>
          <input
            id="new-password"
            className="form-control"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              setFieldErrors((current) => ({
                ...current,
                newPassword: undefined,
              }));
              setSubmitError(null);
            }}
            aria-describedby="password-guidance new-password-error"
            aria-invalid={fieldErrors.newPassword ? true : undefined}
            disabled={isSubmitting}
          />
          <div id="password-guidance" className="form-text">
            {passwordGuidance}
          </div>
          <FieldError
            id="new-password-error"
            message={fieldErrors.newPassword}
          />
        </div>

        <div className="auth-form-field">
          <label className="form-label" htmlFor="confirm-password">
            Confirm new password <span aria-hidden="true">*</span>
          </label>
          <input
            id="confirm-password"
            className="form-control"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setFieldErrors((current) => ({
                ...current,
                confirmPassword: undefined,
              }));
              setSubmitError(null);
            }}
            aria-invalid={fieldErrors.confirmPassword ? true : undefined}
            aria-describedby={
              fieldErrors.confirmPassword ? "confirm-password-error" : undefined
            }
            disabled={isSubmitting}
          />
          <FieldError
            id="confirm-password-error"
            message={fieldErrors.confirmPassword}
          />
        </div>

        {submitError ? (
          <div className="auth-state auth-state-error" role="alert">
            {submitError}
          </div>
        ) : null}

        <div className="auth-form-actions">
          <button
            type="submit"
            className="btn btn-success"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Saving new password..." : "Save new password"}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
              void logout()
                .catch(() => undefined)
                .finally(() => navigate("/login"));
            }}
            disabled={isSubmitting}
          >
            Log out
          </button>
        </div>
      </form>
    </section>
  );
}
