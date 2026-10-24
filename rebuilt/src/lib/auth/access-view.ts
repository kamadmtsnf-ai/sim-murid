import type { AccessPageData } from "./access-validation";
export const accessResources: Record<string, string> = {
  profiles: "Profil",
  roles: "Peran",
  assignments: "Penugasan",
  flags: "Fasilitas akun",
  accounts: "Akun pengguna",
  sessions: "Sesi dan perangkat",
  references: "Data referensi",
  school: "Profil madrasah",
  classes: "Kelas dan siswa",
  attendance: "Absensi siswa",
  fees: "Iuran komite",
  savings: "Tabungan",
  grades: "Penilaian dan rapor",
  mentoring: "Bimbingan",
  notifications: "Notifikasi",
  graduation: "Kenaikan kelas",
  certificates: "Ijazah",
  books: "Buku digital",
  discipline: "Poin siswa",
  surveys: "Survei",
  action_plan: "Rencana aksi",
  settings: "Pengaturan madrasah",
  audit: "Log aktivitas",
  survey_ai: "Analisis survei AI",
};
const actions: Record<string, string> = {
  read: "Lihat",
  manage: "Kelola",
  revoke: "Cabut",
  write: "Tulis",
};
export const scopeLabels = {
  all: "Seluruh data",
  own: "Data sendiri",
  class: "Kelas yang ditugaskan",
} as const;
export function permissionLabel(capability: string) {
  const split = capability.lastIndexOf(".");
  if (split < 1) return capability;
  const resource = capability.slice(0, split),
    action = capability.slice(split + 1);
  return `${actions[action] ?? action} ${accessResources[resource] ?? resource}`.trim();
}
export function classLabel(data: AccessPageData, id: string) {
  return (
    data.class_labels.find((c) => c.id === id)?.label ?? `Kelas rujukan ${id}`
  );
}
export type PermissionRow = {
  capability: string;
  resource: string;
  label: string;
  scopes: AccessPageData["grants"];
};
export function permissionRows(data: AccessPageData): PermissionRow[] {
  const rows = new Map<string, PermissionRow>(),
    seen = new Set<string>();
  for (const g of data.grants) {
    const key = JSON.stringify([g.capability, g.scope, g.class_id]);
    if (seen.has(key)) continue;
    seen.add(key);
    const row = rows.get(g.capability) ?? {
      capability: g.capability,
      resource:
        g.capability.slice(0, Math.max(0, g.capability.lastIndexOf("."))) ||
        g.capability,
      label: permissionLabel(g.capability),
      scopes: [],
    };
    row.scopes.push(g);
    rows.set(g.capability, row);
  }
  return [...rows.values()]
    .map((r) => ({
      ...r,
      scopes: r.scopes.toSorted(
        (a, b) =>
          a.scope.localeCompare(b.scope) ||
          String(a.class_id).localeCompare(String(b.class_id)),
      ),
    }))
    .toSorted(
      (a, b) =>
        a.label.localeCompare(b.label, "id") ||
        a.capability.localeCompare(b.capability),
    );
}
export function filterPermissions(
  data: AccessPageData,
  filter: { query: string; resource: string; scope: string },
) {
  const query = filter.query.trim().toLocaleLowerCase("id-ID");
  return permissionRows(data)
    .map((row) => ({
      ...row,
      scopes: row.scopes.filter(
        (g) => !filter.scope || g.scope === filter.scope,
      ),
    }))
    .filter(
      (row) =>
        row.scopes.length &&
        (!filter.resource || row.resource === filter.resource) &&
        (!query ||
          [
            row.label,
            row.capability,
            ...row.scopes.map((g) =>
              g.class_id ? classLabel(data, g.class_id) : scopeLabels[g.scope],
            ),
          ]
            .join(" ")
            .toLocaleLowerCase("id-ID")
            .includes(query)),
    );
}
export function uniqueAssignments(data: AccessPageData) {
  return [
    ...new Map(
      data.assignments.map((a) => [JSON.stringify([a.code, a.class_id]), a]),
    ).values(),
  ].toSorted(
    (a, b) =>
      a.code.localeCompare(b.code) ||
      String(a.class_id).localeCompare(String(b.class_id)),
  );
}

export function accessViewKey(data: AccessPageData) {
  return JSON.stringify([
    data.user_id,
    data.role,
    permissionRows(data),
    uniqueAssignments(data),
    data.class_labels.toSorted((a, b) => a.id.localeCompare(b.id)),
    data.details_available,
  ]);
}
