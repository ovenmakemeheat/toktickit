import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { PublicUser } from "../lib/api";

export type RequesterIdentity = Pick<PublicUser, "id" | "name" | "email">;

type RequesterContextValue = {
  requester: RequesterIdentity | null;
  setRequester: (requester: RequesterIdentity) => void;
  clearRequester: () => void;
};

const RequesterContext = createContext<RequesterContextValue | null>(null);

export function RequesterProvider({
  children,
  initialRequester = null,
}: {
  children: ReactNode;
  initialRequester?: RequesterIdentity | null;
}) {
  const [requester, setRequester] = useState<RequesterIdentity | null>(
    initialRequester,
  );

  const value = useMemo(
    () => ({
      requester,
      setRequester,
      clearRequester: () => setRequester(null),
    }),
    [requester],
  );

  return (
    <RequesterContext.Provider value={value}>
      {children}
    </RequesterContext.Provider>
  );
}

export function useRequester() {
  const value = useContext(RequesterContext);

  if (!value) {
    throw new Error("useRequester must be used inside RequesterProvider");
  }

  return value;
}
