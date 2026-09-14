import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  ApiRequestError,
  changePassword as changePasswordRequest,
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  type AuthResponse,
  type PublicUser,
} from "./lib/api";

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "error"; message: string }
  | { status: "authenticated"; response: AuthResponse };

type AuthContextValue = {
  state: AuthState;
  user: PublicUser | null;
  retry: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<AuthResponse>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function safeLoadError(error: unknown) {
  if (error instanceof ApiRequestError && error.status === 401) {
    return null;
  }
  return "Unable to restore your session. Try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const retry = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const response = await fetchCurrentUser();
      setState({ status: "authenticated", response });
    } catch (error) {
      const message = safeLoadError(error);
      setState(
        message ? { status: "error", message } : { status: "signed-out" },
      );
    }
  }, []);

  useEffect(() => {
    void retry();
  }, [retry]);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    setState({ status: "authenticated", response });
    return response;
  }, []);

  const changePassword = useCallback(
    async (input: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) => {
      const response = await changePasswordRequest(input);
      setState({ status: "authenticated", response });
      return response;
    },
    [],
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    setState({ status: "signed-out" });
  }, []);

  const user = state.status === "authenticated" ? state.response.user : null;
  const value = useMemo(
    () => ({ state, user, retry, signIn, changePassword, logout }),
    [state, user, retry, signIn, changePassword, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
