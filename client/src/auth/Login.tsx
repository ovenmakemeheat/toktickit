import { useState, type FormEvent } from "react";

import { useAuth } from "../auth-context";
import { ApiRequestError } from "../lib/api";
import { navigate } from "../lib/navigation";

type FieldErrors = {
  email?: string;
  password?: string;
};

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    errors.email = "Enter a valid email address.";
  }
  if (!password) {
    errors.password = "Password is required.";
  }
  return errors;
}

function apiErrorMessage(error: unknown) {
  if (!(error instanceof ApiRequestError)) {
    return "Unable to connect to TokTickIT API. Try again.";
  }
  if (error.code === "ACCOUNT_INACTIVE") {
    return "This account is inactive. Contact an administrator.";
  }
  if (error.code === "INVALID_CREDENTIALS") {
    return "Email or password is incorrect.";
  }
  return "Unable to sign in. Check your details and try again.";
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <div id={id} className="auth-field-error" role="alert">
      {message}
    </div>
  ) : null;
}

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate(email, password);
    setFieldErrors(errors);
    setSubmitError(null);
    if (Object.keys(errors).length > 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
      setPassword("");
      navigate("/");
    } catch (error) {
      setPassword("");
      setSubmitError(apiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-panel" aria-labelledby="login-title">
      <div className="auth-brand">
        <p className="lab2-eyebrow">TokTickIT</p>
        <h1 id="login-title">Sign in to your service desk</h1>
        <p className="lab2-introduction">
          Use your TokTickIT account to view and manage the work available to
          you.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-form-field">
          <label className="form-label" htmlFor="login-email">
            Email <span aria-hidden="true">*</span>
          </label>
          <input
            id="login-email"
            className="form-control"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
              setSubmitError(null);
            }}
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={
              fieldErrors.email ? "login-email-error" : undefined
            }
            disabled={isSubmitting}
          />
          <FieldError id="login-email-error" message={fieldErrors.email} />
        </div>

        <div className="auth-form-field">
          <label className="form-label" htmlFor="login-password">
            Password <span aria-hidden="true">*</span>
          </label>
          <div className="auth-password-control">
            <input
              id="login-password"
              className="form-control"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({
                  ...current,
                  password: undefined,
                }));
                setSubmitError(null);
              }}
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={
                fieldErrors.password ? "login-password-error" : undefined
              }
              disabled={isSubmitting}
            />
            <button
              type="button"
              className="btn btn-outline-secondary auth-password-toggle"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={isSubmitting}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <FieldError
            id="login-password-error"
            message={fieldErrors.password}
          />
        </div>

        {submitError ? (
          <div className="auth-state auth-state-error" role="alert">
            {submitError}
          </div>
        ) : null}

        <button
          type="submit"
          className="btn btn-success auth-submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </section>
  );
}
