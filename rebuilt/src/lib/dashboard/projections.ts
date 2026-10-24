import { z } from "zod";
import { scheduleSnapshot } from "../education/validation.ts";
import { dutySnapshot } from "../operations/duty.ts";
import {
  attendanceSnapshot,
  isAttendanceHoliday,
} from "../operations/attendance.ts";
import { mentoringSnapshot } from "../operations/mentoring.ts";
import { committeeSnapshot } from "../operations/committee.ts";
import { savingsSnapshot } from "../operations/savings.ts";
import {
  overviewDay,
  type Overview,
  type OverviewMetric,
  type OverviewSource,
  type OverviewTask,
} from "./overview.ts";
import { overviewPlan, type OverviewAccess } from "./plan.ts";
export const sourceMeta: Record<
  OverviewSource,
  { label: string; module: string; format: OverviewMetric["format"] }
> = {
  notifications: {
    label: "Notifikasi belum dibaca",
    module: "Notifikasi",
    format: "count",
  },
  schedule: {
    label: "Jadwal rutin hari ini",
    module: "Jadwal dan piket siswa",
    format: "count",
  },
  duty: { label: "Piket Anda hari ini", module: "Guru piket", format: "text" },
  attendance: {
    label: "Catatan absensi hari ini",
    module: "Absensi siswa",
    format: "count",
  },
  mentoring: {
    label: "Laporan bimbingan hari ini",
    module: "Bimbingan",
    format: "count",
  },
  fees: {
    label: "Status iuran bulan ini",
    module: "Iuran komite",
    format: "count",
  },
  savings: {
    label: "Saldo rekening dalam cakupan",
    module: "Tabungan",
    format: "currency",
  },
  jobs: {
    label: "Pengiriman perlu diperiksa",
    module: "Pekerjaan",
    format: "count",
  },
};
export type SourceResult = {
  id: OverviewSource;
  data?: unknown;
  state?: "unavailable" | "denied";
};
const serviceBase = z.object({
  module: z.string(),
  today: z.iso.date(),
  extra: z.record(z.string(), z.unknown()),
  rows: z.array(z.unknown()),
});
const integer = z.number().int().nonnegative().safe();
export function projectOverview(
  a: OverviewAccess,
  results: SourceResult[],
  now: Date,
): Pick<Overview, "metrics" | "tasks" | "agenda" | "agendaCount" | "calendar"> {
  const day = overviewDay(now),
    metrics: OverviewMetric[] = [],
    tasks: OverviewTask[] = [],
    payload = new Map(results.map((r) => [r.id, r]));
  let calendar: Overview["calendar"] = "unknown",
    agenda: Overview["agenda"] = [],
    agendaCount = 0;
  const att = payload.get("attendance");
  if (att?.data) {
    try {
      const d = attendanceSnapshot.parse(att.data);
      if (d.today === day.today)
        calendar = isAttendanceHoliday(day.today, d.extra.holidays)
          ? "holiday"
          : "normal";
    } catch {
      /* a failed calendar cannot manufacture a holiday or a task */
    }
  }
  for (const result of results.filter((r) => overviewPlan(a).includes(r.id))) {
    const id = result.id,
      meta = sourceMeta[id],
      m: OverviewMetric = {
        id,
        ...meta,
        period:
          id === "jobs"
            ? "200 pengiriman terbaru"
            : id === "savings"
              ? "Saldo saat pembacaan"
              : id === "fees"
                ? day.month.slice(0, 7)
                : id === "notifications"
                  ? "Seluruh notifikasi akun"
                  : day.today,
        state: result.state ?? "ready",
        value: null,
        detail: "Data sesuai cakupan akses Anda.",
      };
    const task = (
      priority: OverviewTask["priority"],
      title: string,
      detail: string,
    ) => tasks.push({ id, priority, title, detail, module: meta.module });
    if (result.state) {
      m.detail =
        result.state === "denied"
          ? "Data tidak tersedia sesuai akses saat ini."
          : "Data belum dapat dimuat. Perbarui ringkasan untuk mencoba kembali.";
      metrics.push(m);
      continue;
    }
    try {
      if (id === "notifications") {
        const d = serviceBase
          .extend({
            module: z.literal("notifications"),
            extra: z.object({ unread: integer }),
          })
          .parse(result.data);
        m.value = d.extra.unread;
        if (m.value > 0)
          task(
            "info",
            "Tinjau notifikasi Anda",
            `${m.value} notifikasi belum dibaca. Buka Notifikasi melalui sidebar.`,
          );
      } else if (id === "schedule") {
        const d = scheduleSnapshot.parse(result.data);
        if (
          d.today !== day.weekday ||
          d.lessons.some((l) => l.weekday !== day.weekday) ||
          d.duties.some((l) => l.weekday !== day.weekday)
        )
          throw Error("Wrong weekday");
        const own =
          a.role === "teacher" &&
          !a.assignments.some((t) => t.code === "school_head");
        if (own && d.lessons.some((l) => l.teacher_id !== a.user_id))
          throw Error("Wrong teacher");
        m.value = d.lessons.length;
        m.detail = own
          ? "Jadwal mengajar Anda pada tahun ajaran aktif."
          : "Jadwal rutin sesuai cakupan dan tahun ajaran aktif.";
        if (calendar === "holiday") {
          m.value = null;
          m.display = "Hari libur";
          m.detail = "Kalender madrasah menandai hari ini sebagai hari libur.";
        } else {
          const upcoming = d.lessons
            .filter((l) => l.end_minute > day.minute)
            .toSorted(
              (x, y) =>
                x.start_minute - y.start_minute || x.id.localeCompare(y.id),
            );
          agendaCount = upcoming.length;
          agenda = upcoming.slice(0, 5).map((l) => ({
            subject: l.subject.slice(0, 200),
            className: l.class_name.slice(0, 200),
            start: l.start_minute,
            end: l.end_minute,
          }));
          if (upcoming.length && calendar === "normal")
            task(
              "today",
              "Periksa jadwal berikutnya",
              `${upcoming.length} jadwal rutin masih berlangsung atau belum dimulai. Buka Jadwal dan piket siswa melalui sidebar.`,
            );
        }
      } else if (id === "duty") {
        const d = dutySnapshot.parse(result.data);
        if (d.today !== day.today || d.rows.some((r) => r.date !== day.today))
          throw Error("Wrong date");
        if (a.role === "admin" && d.canManage) {
          m.label = "Catatan piket menunggu konfirmasi";
          m.format = "count";
          m.value = d.rows.filter((r) => r.status === "pending").length;
          m.detail =
            "Jumlah catatan penugasan berstatus menunggu hari ini, bukan seluruh jadwal mingguan yang belum diproses.";
          if (m.value)
            task(
              "today",
              "Periksa konfirmasi guru piket",
              `${m.value} catatan penugasan menunggu konfirmasi. Buka Guru piket melalui sidebar untuk meninjau.`,
            );
        } else {
          const ownRows = d.rows.filter((r) => r.teacher_id === a.user_id),
            cancelled = ownRows.some((r) => r.status === "cancelled"),
            recorded = ownRows.some((r) => r.status === "confirmed"),
            assigned =
              !cancelled &&
              (ownRows.some((r) => r.status === "pending") ||
                (a.assignments.some((t) => t.code === "duty_teacher") &&
                  d.extra.roster.some(
                    (r) =>
                      r.teacher_id === a.user_id && r.weekday === day.weekday,
                  )));
          m.display = d.extra.confirmed
            ? "Terkonfirmasi"
            : cancelled
              ? "Dibatalkan"
              : recorded
                ? "Perlu pemeriksaan"
                : assigned
                  ? "Menunggu konfirmasi"
                  : "Tidak ada penugasan";
          m.detail = "Status penugasan piket Anda pada tanggal ini.";
          if ((assigned || recorded) && !cancelled && !d.extra.confirmed)
            task(
              "today",
              "Periksa konfirmasi tugas piket",
              "Anda tercantum pada penugasan piket hari ini. Periksa status melalui Guru piket dan hubungi petugas yang berwenang bila belum terkonfirmasi.",
            );
        }
      } else if (id === "attendance" || id === "mentoring") {
        const d =
          id === "attendance"
            ? attendanceSnapshot.parse(result.data)
            : mentoringSnapshot.parse(result.data);
        if (d.today !== day.today || d.rows.some((r) => r.date !== day.today))
          throw Error("Wrong date");
        m.value = integer.parse(d.total);
        m.detail =
          "Jumlah catatan tersimpan pada tanggal ini, bukan jumlah siswa yang belum dicatat.";
      } else if (id === "fees") {
        const d = committeeSnapshot.parse(result.data);
        if (d.today !== day.today || d.rows.some((r) => r.date !== day.today))
          throw Error("Wrong date");
        if (a.assignments.some((t) => t.code === "committee_treasurer")) {
          m.label = "Pembayaran iuran hari ini";
          m.period = day.today;
          m.value = integer.parse(d.total);
          m.detail = "Jumlah pembayaran tersimpan sesuai cakupan Anda.";
        } else {
          const months = d.extra.months.filter((r) => r.month === day.month),
            unknown = months.some(
              (r) => r.tariff === null || r.outstanding === null,
            ),
            unpaid = months.filter(
              (r) =>
                r.status === "unpaid" &&
                r.outstanding !== null &&
                r.outstanding > 0,
            ).length;
          m.value = unknown ? null : unpaid;
          m.display = unknown ? "Tarif belum lengkap" : undefined;
          m.detail = !months.length
            ? "Belum ada status iuran bulan ini sesuai cakupan Anda."
            : unknown
              ? "Status belum dapat dirangkum; periksa informasi tarif melalui Iuran komite."
              : "Jumlah status bulan ini yang belum lunas. Ini bukan penetapan jatuh tempo.";
          if (unpaid)
            task(
              "info",
              "Periksa status iuran bulan ini",
              `${unpaid} status iuran bulan ini belum lunas. Buka Iuran komite melalui sidebar untuk memeriksa rinciannya.`,
            );
        }
      } else if (id === "savings") {
        const d = savingsSnapshot.parse(result.data);
        if (d.today !== day.today) throw Error("Wrong date");
        m.value = d.summary.balance;
        m.detail = d.extra.accounts.length
          ? "Total saldo rekening yang dapat Anda akses saat pembacaan."
          : "Belum ada rekening tabungan yang dapat diakses.";
      } else if (id === "jobs") {
        const d = serviceBase
          .extend({
            module: z.literal("jobs"),
            isAdmin: z.literal(true),
            rows: z
              .array(
                z.object({
                  status: z.enum([
                    "queued",
                    "processing",
                    "sent",
                    "failed",
                    "ambiguous",
                    "cancelled",
                  ]),
                }),
              )
              .max(200),
          })
          .parse(result.data);
        m.value = d.rows.filter(
          (r) => r.status === "failed" || r.status === "ambiguous",
        ).length;
        m.detail =
          "Gagal atau perlu pemeriksaan di antara maksimal 200 pengiriman terbaru, bukan total seluruh riwayat.";
        if (m.value)
          task(
            "review",
            "Periksa hasil pengiriman",
            `${m.value} pengiriman dalam daftar terbaru memerlukan pemeriksaan. Buka Pekerjaan melalui sidebar; ringkasan ini tidak mengirim ulang pesan.`,
          );
      }
    } catch {
      m.state = "unavailable";
      m.value = null;
      delete m.display;
      m.detail =
        "Data belum dapat dikonfirmasi. Perbarui ringkasan untuk mencoba kembali.";
    }
    metrics.push(m);
  }
  const rank = { review: 0, today: 1, info: 2 };
  tasks.sort(
    (x, y) => rank[x.priority] - rank[y.priority] || x.id.localeCompare(y.id),
  );
  return { metrics, tasks, agenda, agendaCount, calendar };
}
