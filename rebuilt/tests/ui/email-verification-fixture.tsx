import { createRoot } from "react-dom/client";
import { EmailPanel } from "../../src/app/account/email/email-panel";
import Loading from "../../src/app/account/email/loading";
import ErrorPage from "../../src/app/account/email/error";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { emailStateSchema } from "../../src/lib/email/validation";
const params = new URLSearchParams(location.search),
  time = Date.now();
const state = emailStateSchema.parse({
  email: params.has("empty")
    ? ""
    : params.has("long")
      ? "email".repeat(50) + "@example.org"
      : "teacher@example.org",
  verified: params.has("verified"),
  sent_today: params.has("limit") ? 5 : 1,
  challenge:
    params.has("none") || params.has("empty")
      ? null
      : {
          id: "00000000-0000-4000-8000-000000000003",
          expires_at: new Date(
            time +
              (params.has("expired")
                ? -1000
                : params.has("expiring")
                  ? 2000
                  : 600000),
          ).toISOString(),
          retry_at: new Date(
            time +
              (params.has("cooldown")
                ? 55000
                : params.has("short-cooldown")
                  ? 2000
                  : -60000),
          ).toISOString(),
          status: params.has("locked")
            ? "locked"
            : params.has("superseded")
              ? "superseded"
              : params.has("verified")
                ? "verified"
                : "pending",
          delivery_state: params.has("queued")
            ? "queued"
            : params.has("failed")
              ? "failed"
              : "accepted",
          attempts_remaining: params.has("locked") ? 0 : 5,
        },
});
Object.assign(window, { emailVerificationFixture: state });
const root = createRoot(document.getElementById("root")!);
Object.assign(window, { unmountEmailVerification: () => root.unmount() });
root.render(
  <WorkspaceShell
    name="Akun uji"
    username="qa-email"
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
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-2xl space-y-6 px-4 py-6 sm:px-6"
      >
        <h1 className="text-2xl font-semibold">Verifikasi email</h1>
        <EmailPanel
          initialState={state}
          initialServerTime={new Date().toISOString()}
        />
      </main>
    )}
  </WorkspaceShell>,
);
