import { createRoot } from "react-dom/client";
import { AccessPanel } from "../../src/app/account/access/access-panel";
import Loading from "../../src/app/account/access/loading";
import ErrorPage from "../../src/app/account/access/error";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import { accessPageSchema } from "../../src/lib/auth/access-validation";
const p = new URLSearchParams(location.search),
  id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const scopes = [
  "profiles",
  "roles",
  "assignments",
  "flags",
  "sessions",
  "fees",
  "savings",
  "grades",
  "mentoring",
  "attendance",
  "notifications",
  "references",
  "classes",
  "books",
  "discipline",
  "surveys",
  "action_plan",
];
const state = accessPageSchema.parse({
  user_id: id(p.get("otherAccount")==="1"?2:1),
  role: p.has("long") ? "peran-".repeat(80) : (p.get("role") ?? "teacher"),
  assignments: p.has("empty")
    ? []
    : [
        { code: "homeroom_teacher", class_id: id(11) },
        { code: "homeroom_teacher", class_id: id(12) },
        { code: "school_head", class_id: null },
      ],
  grants: p.has("empty")
    ? []
    : [
        ...scopes
          .filter((r) => r !== "classes")
          .map((capability) => ({
            capability: capability + ".read",
            scope: ["references", "books"].includes(capability) ? "all" : "own",
            class_id: null,
          })),
        { capability: "classes.read", scope: "class", class_id: id(11) },
        { capability: "classes.read", scope: "class", class_id: id(12) },
        ...(p.has("many")
          ? Array.from({ length: 120 }, (_, i) => ({
              capability: `future_${i}${p.has("long") ? "_".repeat(100) + "fitur".repeat(40) : ""}.read`,
              scope: "all",
              class_id: null,
            }))
          : []),
      ],
  class_labels: p.has("missing")
    ? []
    : [
        {
          id: id(11),
          label:
            "Kelas 7 · A · 2026/2027" +
            (p.has("long") ? " nama-panjang".repeat(60) : ""),
        },
        { id: id(12), label: "Kelas 7 · B · 2026/2027" },
      ],
  details_available: !p.has("missing"),
});
Object.assign(window, { accessFixture: state });
const root = createRoot(document.getElementById("root")!);
Object.assign(window, { unmountAccess: () => root.unmount() });
root.render(
  <WorkspaceShell
    name="Akun uji"
    username="qa-access"
    navigation={navigationFor([], false)}
  >
    {p.has("loading") ? (
      <Loading />
    ) : p.has("error") ? (
      <ErrorPage
        error={Error("private detail")}
        reset={() => {
          document.documentElement.dataset.retried = "true";
        }}
      />
    ) : (
      <AccessPanel initialData={state} />
    )}
  </WorkspaceShell>,
);
