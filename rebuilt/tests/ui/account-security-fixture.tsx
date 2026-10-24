import { createRoot } from "react-dom/client";
import { SecurityPanel } from "../../src/app/account/security/security-panel";
import Loading from "../../src/app/account/security/loading";
import ErrorPage from "../../src/app/account/security/error";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { securityStateSchema } from "../../src/lib/auth/security-validation";
const params = new URLSearchParams(location.search),
  gate = params.get("gate") ?? "ready";
const state = securityStateSchema.parse({
  gate,
  destination: "/account/security",
  question_code: gate === "security_question" ? null : "q1",
  role: "admin",
  can_set_question: ["ready", "security_question", "email_pending"].includes(
    gate,
  ),
});
Object.assign(window, { securityFixture: state });
const root = createRoot(document.getElementById("root")!);
Object.assign(window, { unmountSecurity: () => root.unmount() });
root.render(
  <WorkspaceShell
    name="Akun uji"
    username="qa-security"
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
      <SecurityPanel
        username={
          params.has("long") ? "akun-panjang-".repeat(30) : "qa-security"
        }
        initialState={state}
      />
    )}
  </WorkspaceShell>,
);
