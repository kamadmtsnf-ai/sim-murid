/** Synthetic presentation only. No provider, production identities or account writes. */
import { createRoot } from "react-dom/client";
import {
  DirectoryDetailView,
  DirectoryDetailUnavailable,
} from "../../src/app/account/directory/directory-detail";
import { directoryDetailSchema } from "../../src/lib/education/directory";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
import Loading from "../../src/app/account/directory/[id]/loading";
import ErrorView from "../../src/app/account/directory/[id]/error";
const scenario =
  new URLSearchParams(location.search).get("scenario") ?? "teacher";
const id = (n: number) =>
  "11111111-1111-4111-8111-" + String(n).padStart(12, "0");
const long = scenario === "long",
  teacher = ["teacher", "long", "many", "empty-teacher"].includes(scenario);
const person = directoryDetailSchema.parse({
  id: id(1),
  username: long ? "00-Long".repeat(50) : "00-User",
  name: long ? "Nama".repeat(80) : "Pengguna Detail",
  role: teacher
    ? "teacher"
    : ["parent", "admin", "customer", "applicant", "alumni"].includes(scenario)
      ? scenario
      : "student",
  status: scenario === "inactive" ? "inactive" : "active",
  contact: ["restricted", "empty", "admin", "customer"].includes(scenario)
    ? null
    : {
        phone: null,
        email: long
          ? "alamat".repeat(100) + "@example.invalid"
          : "synthetic@example.invalid",
        bio: "Profil pengguna\nBaris kedua.",
      },
  student: ["student", "long"].includes(scenario)
    ? { data: { NIK: "synthetic-sensitive" } }
    : null,
  children:
    scenario === "parent"
      ? [
          {
            id: id(2),
            name: long ? "Anak".repeat(80) : "Anak terhubung",
            username: "00-Anak",
            relationship: "father",
          },
        ]
      : [],
  siblings:
    scenario === "student"
      ? [{ id: id(3), name: "Saudara terverifikasi", legacy_order: 1 }]
      : [],
  enrollments:
    scenario === "empty" ||
    scenario === "empty-teacher" ||
    scenario === "restricted"
      ? []
      : Array.from({ length: scenario === "many" ? 100 : 2 }, (_, i) => ({
          id: id(100 + i),
          class_name: long ? "Kelas".repeat(80) : "VII A",
          year: 2026 - (i % 3),
          starts_on: i ? "2026-02-31" : "2026-07-01",
          ended_at: i ? "2026-10-20T17:30:00Z" : null,
        })),
  assignments:
    teacher && scenario !== "empty-teacher"
      ? Array.from({ length: scenario === "many" ? 100 : 4 }, (_, i) => ({
          code: [
            "school_head",
            "student_mentor",
            "duty_teacher",
            "savings_manager",
          ][i % 4],
          class_id: null,
          valid_from: i === 1 ? "2099-01-01" : "2020-07-01",
          valid_until: i === 2 ? "2020-12-31" : null,
          revoked_at: i === 3 ? "2026-10-01T00:00:00Z" : null,
        }))
      : [],
  homerooms:
    teacher && scenario !== "empty-teacher"
      ? [{ id: id(99), name: long ? "Kelas".repeat(80) : "VII A" }]
      : [],
  lessons:
    teacher && scenario !== "empty-teacher"
      ? Array.from({ length: scenario === "many" ? 100 : 1 }, (_, i) => ({
          id: id(400 + i),
          class_name: long ? "Kelas".repeat(80) : "VII A",
          subject: long ? "Pelajaran".repeat(80) : "IPS",
          weekday: 1 + (i % 7),
          start_minute: 420,
          end_minute: 515,
          jtm: 2,
          break_minutes: 15,
        }))
      : [],
});
createRoot(document.getElementById("root")!).render(
  <WorkspaceShell
    name="Akun Uji Detail"
    username="qa-detail"
    navigation={navigationFor(["profiles.read"], false)}
  >
    {scenario === "unavailable" ? (
      <DirectoryDetailUnavailable />
    ) : scenario === "loading" ? (
      <Loading />
    ) : scenario === "error" ? (
      <ErrorView
        error={new Error("private synthetic error")}
        reset={() => {
          document.documentElement.dataset.retried = "true";
        }}
      />
    ) : (
      <main id="main-content" tabIndex={-1}>
        <DirectoryDetailView person={person} />
      </main>
    )}
  </WorkspaceShell>,
);
