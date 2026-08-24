import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { DevelopmentRequester } from "../lib/api";

type RequesterContextValue = {
  selectedRequester: DevelopmentRequester | null;
  selectRequester: (requester: DevelopmentRequester) => void;
  clearRequester: () => void;
};

const RequesterContext = createContext<RequesterContextValue | null>(null);

export function DevelopmentRequesterProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedRequester, setSelectedRequester] =
    useState<DevelopmentRequester | null>(null);

  const value = useMemo(
    () => ({
      selectedRequester,
      selectRequester: setSelectedRequester,
      clearRequester: () => setSelectedRequester(null),
    }),
    [selectedRequester],
  );

  return (
    <RequesterContext.Provider value={value}>
      {children}
    </RequesterContext.Provider>
  );
}

export function useDevelopmentRequester() {
  const value = useContext(RequesterContext);

  if (!value) {
    throw new Error(
      "useDevelopmentRequester must be used inside DevelopmentRequesterProvider",
    );
  }

  return value;
}
