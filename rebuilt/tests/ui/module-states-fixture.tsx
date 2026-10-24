import { createRoot } from "react-dom/client";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import ClassesLoading from "../../src/app/account/classes/loading";
import SchedulesLoading from "../../src/app/account/schedules/loading";
import OperationsLoading from "../../src/app/account/operations/[module]/loading";
import OperationsError from "../../src/app/account/operations/[module]/error";
import LearningLoading from "../../src/app/account/learning/[module]/loading";
import LearningError from "../../src/app/account/learning/[module]/error";
import ServicesLoading from "../../src/app/account/services/[module]/loading";
import ServicesError from "../../src/app/account/services/[module]/error";
const mode = new URLSearchParams(location.search).get("mode") ?? "classes";
const fail = {
  error: new Error("Private implementation detail"),
  reset: () => {
    Object.assign(window, {
      resetCount:
        Number((window as unknown as { resetCount?: number }).resetCount ?? 0) +
        1,
    });
  },
};
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    navigation={navigationFor([], true)}
    name="Pengguna uji"
    username="qa-states"
  >
    {mode === "learning" ? (
      <LearningLoading />
    ) : mode === "learning-error" ? (
      <LearningError {...fail} />
    ) : mode === "services" ? (
      <ServicesLoading />
    ) : mode === "services-error" ? (
      <ServicesError {...fail} />
    ) : mode === "classes" ? (
      <ClassesLoading />
    ) : mode === "schedules" ? (
      <SchedulesLoading />
    ) : mode === "operations-error" ? (
      <OperationsError {...fail} />
    ) : (
      <OperationsLoading />
    )}
  </WorkspaceShell>,
);
