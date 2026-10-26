export type NavItem = {
  href: string;
  label: string;
  description: string;
  capabilities?: string[];
  adminOnly?: boolean;
};
export type NavGroup = { label: string; items: NavItem[] };
export const accountNavigation: NavGroup[] = [
  {
    label: "Ruang kerja",
    items: [
      {
        href: "/account",
        label: "Dashboard",
        description: "Ringkasan layanan dan akun",
      },
      {
        href: "/account/services/notifications",
        label: "Notifikasi",
        description: "Pesan dan tindak lanjut",
        capabilities: ["notifications.read"],
      },
      {
        href: "/account/directory",
        label: "Direktori pengguna",
        description: "Pengguna dalam cakupan akses",
        capabilities: ["profiles.read"],
      },
      {
        href: "/account/classes",
        label: "Kelas dan siswa",
        description: "Tahun ajaran dan penempatan siswa",
        capabilities: ["classes.read"],
      },
      {
        href: "/account/schedules",
        label: "Jadwal dan piket siswa",
        description: "Pelajaran dan penugasan piket",
        capabilities: ["references.read"],
      },
    ],
  },
  {
    label: "Layanan siswa",
    items: [
      {
        href: "/account/operations/duty",
        label: "Guru piket",
        description: "Laporan dan penugasan harian",
        capabilities: ["attendance.read"],
      },
      {
        href: "/account/operations/attendance",
        label: "Absensi",
        description: "Kehadiran dan rekap siswa",
        capabilities: ["attendance.read"],
      },
      {
        href: "/account/operations/mentoring",
        label: "Bimbingan",
        description: "Catatan pendampingan siswa",
        capabilities: ["mentoring.read"],
      },
      {
        href: "/account/operations/fees",
        label: "Iuran komite",
        description: "Pembayaran dan status bulanan",
        capabilities: ["fees.read"],
      },
      {
        href: "/account/operations/savings",
        label: "Tabungan",
        description: "Rekening dan riwayat transaksi",
        capabilities: ["savings.read"],
      },
      {
        href: "/account/services/discipline",
        label: "Poin siswa",
        description: "Kejadian, poin dan tindak lanjut",
        capabilities: ["discipline.read"],
      },
    ],
  },
  {
    label: "Akademik",
    items: [
      {
        href: "/account/learning/grades",
        label: "Penilaian dan KKM",
        description: "Nilai dan kriteria ketuntasan",
        capabilities: ["grades.read"],
      },
      {
        href: "/account/learning/reports",
        label: "Rapor",
        description: "Laporan hasil belajar",
        capabilities: ["grades.read"],
      },
      {
        href: "/account/learning/promotions",
        label: "Kenaikan dan ijazah",
        description: "Kenaikan kelas dan dokumen kelulusan",
        capabilities: ["graduation.manage", "certificates.read"],
      },
      {
        href: "/account/learning/books",
        label: "Buku digital",
        description: "Koleksi dan pembaca buku",
        capabilities: ["books.read"],
      },
    ],
  },
  {
    label: "Evaluasi",
    items: [
      {
        href: "/account/services/surveys",
        label: "Survei",
        description: "Instrumen dan jawaban survei",
        capabilities: ["surveys.read"],
      },
      {
        href: "/account/services/insights",
        label: "Hasil survei",
        description: "Analisis dan rencana tindak lanjut",
        capabilities: ["surveys.read", "action_plan.read"],
      },
    ],
  },
  {
    label: "Administrasi",
    items: [
      {
        href: "/account/settings",
        label: "Pengaturan madrasah",
        description: "Identitas dan referensi madrasah",
        adminOnly: true,
      },
      {
        href: "/account/families",
        label: "Relasi keluarga",
        description: "Verifikasi hubungan orang tua dan anak",
        adminOnly: true,
      },
      {
        href: "/account/recovery",
        label: "Pemulihan akun",
        description: "Bantuan akses pengguna",
        adminOnly: true,
      },
      {
        href: "/account/health",
        label: "Kesehatan aplikasi",
        description: "Status email, pekerjaan, backup dan rekonsiliasi",
        adminOnly: true,
      },
      {
        href: "/account/services/jobs",
        label: "Pekerjaan",
        description: "Antrean dan status pengiriman",
        adminOnly: true,
      },
      {
        href: "/account/services/reconciliation",
        label: "Rekonsiliasi",
        description: "Bukti kesiapan pemindahan data",
        adminOnly: true,
      },
    ],
  },
  {
    label: "Akun saya",
    items: [
      {
        href: "/account/biodata",
        label: "Biodata dan dokumen",
        description: "Data pribadi dan berkas siswa",
      },
      {
        href: "/account/profile",
        label: "Profil pribadi",
        description: "Identitas dan kontak akun",
      },
      {
        href: "/account/email",
        label: "Verifikasi email",
        description: "Email pemulihan akun",
      },
      {
        href: "/account/security",
        label: "Keamanan akun",
        description: "Password dan pengamanan akun",
      },
      {
        href: "/account/sessions",
        label: "Sesi dan perangkat",
        description: "Perangkat yang sedang terhubung",
      },
      {
        href: "/account/access",
        label: "Hak akses saya",
        description: "Peran dan cakupan izin",
      },
    ],
  },
];
/** Presentation only. Server/RPC checks remain the authorization boundary. */
export function navigationFor(
  capabilities: readonly string[],
  isAdmin: boolean,
): NavGroup[] {
  const allowed = new Set(capabilities);
  return accountNavigation
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) =>
          (!i.adminOnly || isAdmin) &&
          (!i.capabilities ||
            isAdmin ||
            i.capabilities.some((c) => allowed.has(c))),
      ),
    }))
    .filter((g) => g.items.length > 0);
}
export function currentNavItem(path: string, navigation: readonly NavGroup[] = accountNavigation) {
  return navigation
    .flatMap((g) => g.items)
    .filter(
      (i) =>
        path === i.href ||
        (i.href !== "/account" && path.startsWith(i.href + "/")),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}
const menuKeywords: Record<string, string> = {
  "/account/schedules": "KBM pelajaran jadwal piket siswa",
  "/account/operations/mentoring": "guru wali bimbingan pendamping pembimbing",
  "/account/operations/attendance": "absensi siswa kehadiran presensi",
  "/account/operations/fees": "iuran komite pembayaran tagihan",
  "/account/learning/reports": "rapor raport hasil belajar",
  "/account/services/jobs": "pekerjaan antrean pengiriman email",
};
function searchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .trim();
}
export function matchesNavigation(item: NavItem, query: string, group = "") {
  const terms = searchText(query).split(/\s+/).filter(Boolean);
  const text = searchText(
    [group, item.label, item.description, menuKeywords[item.href] ?? ""].join(
      " ",
    ),
  );
  return terms.every((term) => text.includes(term));
}
/** Receives only the caller's allowed links; search cannot add capabilities or routes. */
export function filterNavigation(
  navigation: readonly NavGroup[],
  query: string,
): NavGroup[] {
  return navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        matchesNavigation(item, query, group.label),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
