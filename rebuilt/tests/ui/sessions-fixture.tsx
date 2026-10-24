import { createRoot } from "react-dom/client";
import { SessionPanel } from "../../src/app/account/sessions/session-panel";
import Loading from "../../src/app/account/sessions/loading";
import ErrorPage from "../../src/app/account/sessions/error";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
const params = new URLSearchParams(location.search);
const root = createRoot(document.getElementById("root")!);
Object.assign(window, { unmountSessions: () => root.unmount() });
root.render(
  <WorkspaceShell
    name="Akun uji"
    username="qa-sessions"
    navigation={navigationFor([], false)}
  >
    {params.has("loading") ? (
      <Loading />
    ) : params.has("error") ? (
      <ErrorPage
        error={Error("private detail")}
        reset={() => {
          document.documentElement.dataset.retried = "true";
        }}
      />
    ) : (
      <SessionPanel
        ownUsername="qa-sessions"
        canManageOthers={!params.has("regular")}
      />
    )}
  </WorkspaceShell>,
);
