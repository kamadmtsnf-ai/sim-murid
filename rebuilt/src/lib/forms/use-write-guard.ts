"use client";
import { useEffect, useRef } from "react";
import { listenForPendingWrite, listenForUnsavedChanges } from "./leave-guard";
export function useWriteGuard(
  isPending: () => boolean,
  isDirty: () => boolean = () => false,
) {
  const getters = useRef({ isPending, isDirty });
  useEffect(() => {
    getters.current = { isPending, isDirty };
  });
  useEffect(() => {
    const stopPending = listenForPendingWrite(() =>
      getters.current.isPending(),
    );
    const stopUnsaved = listenForUnsavedChanges((event) => {
      if (getters.current.isPending() || getters.current.isDirty())
        event.preventDefault();
    });
    return () => {
      stopPending();
      stopUnsaved();
    };
  }, []);
}
