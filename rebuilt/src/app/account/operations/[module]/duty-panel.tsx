"use client";
import { MutationFeedback } from "@/components/feedback/mutation-feedback";
import { confirmAction } from "@/components/ui/confirm-action";
import { listenForUnsavedChanges } from "@/lib/forms/leave-guard";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Tabs } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TableRegion } from "@/components/ui/data-table";
import { controlClass } from "@/components/domain-controls";
import { useDomainMutation } from "@/lib/education/use-mutation";
import { commandSchemas } from "@/lib/operations/validation";
import {
  dutySnapshot,
  dutyActions,
  dutyDays,
  type DutySnapshot,
} from "@/lib/operations/duty";
type Filter = {
  year?: number | undefined;
  start?: string | undefined;
  end?: string | undefined;
  page?: number | undefined;
};
type Row = DutySnapshot["rows"][number];
const statusLabel = {
  pending: "Menunggu konfirmasi",
  confirmed: "Terkonfirmasi",
  cancelled: "Dibatalkan",
};
const actionLabel = {
  confirm: "Konfirmasi hadir",
  unconfirm: "Batalkan konfirmasi",
  cancel: "Batalkan penunjukan",
};
export function DutyPanel({
  initial,
  filters = {},
  initialTab = "roster",
}: {
  initial: DutySnapshot;
  filters?: Filter;
  initialTab?: "roster" | "history";
}) {
  const [data, setData] = useState(initial),
    [mode, setMode] = useState<
      "primary" | "appoint" | "roster" | "manage" | null
    >(null),
    [edit, setEdit] = useState<Row | null>(null),
    [teacher, setTeacher] = useState("");
  const dirty = useRef(false),
    pending = useRef(false),
    trigger = useRef<HTMLElement | null>(null);
  const query = new URLSearchParams(
    Object.entries(filters).map(([k, v]) => [k, String(v)]),
  );
  const api = "/api/operations/duty";
  const { busy, blocked, message, phase, feedbackRef, hint, clear, mutate, fail } =
    useDomainMutation(
      api + "?" + query,
      dutySnapshot,
      "data",
      (next) => {
        dirty.current = false;
        setData(next);
        setMode(null);
        setEdit(null);
      },
      { confirmed: true, commandSchema: commandSchemas.duty },
    );
  const locked = busy || blocked;
  const todayDay = new Date(data.today + "T12:00:00Z").getUTCDay();
  const teachers = data.people.filter((p) => p.role_code === "teacher");
  const eligible = teachers.filter((p) =>
    data.extra.roster.some(
      (r) => r.teacher_id === p.id && r.weekday === todayDay && r.active,
    ),
  );
  async function discard() {
    if (
      dirty.current &&
      !(await confirmAction("Tinggalkan perubahan yang belum disimpan?"))
    )
      return false;
    dirty.current = false;
    return true;
  }
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current || pending.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const stopUnloadGuard = listenForUnsavedChanges(warn);
    return () => stopUnloadGuard();
  }, []);
  function open(
    next: NonNullable<typeof mode>,
    el: HTMLElement,
    row: Row | null = null,
  ) {
    if (locked) return;
    clear();
    trigger.current = el;
    dirty.current = false;
    setTeacher("");
    setEdit(row);
    setMode(next);
  }
  async function close() {
    if (pending.current || busy || !(await discard())) return;
    setMode(null);
    setEdit(null);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    const retainedEcurrentTarget = e.currentTarget;

    e.preventDefault();
    if (locked || pending.current) return;
    const f = new FormData(retainedEcurrentTarget),
      get = (key: string) => String(f.get(key) ?? "");
    const command =
      mode === "manage"
        ? { type: get("action"), id: edit?.id, reason: get("reason") }
        : mode === "roster"
          ? {
              type: "roster",
              teacherId: teacher,
              weekdays: f.getAll("weekdays").map(Number),
              assignTask: f.has("assignTask"),
            }
          : mode === "appoint"
            ? {
                type: "appoint",
                teacherId: get("teacherId"),
                replacesId: get("replacesId"),
              }
            : { type: "primary", teacherId: get("teacherId") };
    if (mode === "appoint" && get("teacherId") === get("replacesId")) {
      fail("Guru pengganti harus berbeda dari guru yang digantikan.");
      return;
    }
    if (
      mode === "roster" &&
      !(await confirmAction(
        "Ganti seluruh jadwal mingguan guru ini? Tanpa hari terpilih, jadwal akan dikosongkan.",
      ))
    )
      return;
    pending.current = true;
    try {
      await mutate(data.revision, command);
    } finally {
      pending.current = false;
    }
  }
  const feedback = message ? (
    <MutationFeedback ref={feedbackRef} tabIndex={-1} phase={phase} hint={hint}>
      {message}
    </MutationFeedback>
  ) : null;
  function teacherSelect(name: string, label: string, choices = teachers) {
    return (
      <label className="block text-sm">
        {label}
        <select required className={controlClass} name={name}>
          <option value="">Pilih guru…</option>
          {choices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  const links = (page: number) =>
    "?" +
    new URLSearchParams({
      ...Object.fromEntries(query),
      view: "history",
      page: String(page),
    });
  return (
    <div className="duty-panel min-w-0 space-y-6" aria-busy={busy}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Hari ini (WIB)</p>
          <p className="mt-1 font-semibold">
            {new Intl.DateTimeFormat("id-ID", {
              dateStyle: "full",
              timeZone: "Asia/Jakarta",
            }).format(new Date(data.today + "T12:00:00Z"))}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Status piket saya hari ini
          </p>
          <p className="mt-1 font-semibold">
            {data.extra.confirmed ? "Terkonfirmasi" : "Belum terkonfirmasi"}
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Konfirmasi berlaku hanya pada hari ini. Pembatalan langsung mencabut
        akses piket ke absensi; penunjukan pengganti memerlukan konfirmasi hadir
        terpisah.
      </p>
      {!mode && feedback}
      {data.canManage && (
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={locked || !eligible.length}
            onClick={(e) => open("primary", e.currentTarget)}
          >
            Konfirmasi piket utama
          </Button>
          <Button
            disabled={locked || !eligible.length}
            variant="outline"
            onClick={(e) => open("appoint", e.currentTarget)}
          >
            Tunjuk pengganti
          </Button>
          <Button
            disabled={locked || !teachers.length}
            variant="outline"
            onClick={(e) => open("roster", e.currentTarget)}
          >
            Atur jadwal mingguan
          </Button>
        </div>
      )}
      {data.canManage && !eligible.length && (
        <p className="rounded-lg border p-4 text-sm">
          Belum ada guru aktif pada jadwal hari ini. Konfirmasi utama dan
          penunjukan pengganti tersedia setelah jadwal hari ini ditetapkan.
        </p>
      )}
      <Tabs.Root defaultValue={initialTab}>
        <Tabs.List
          className="schedule-tabs grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-1"
          aria-label="Informasi guru piket"
        >
          <Tabs.Trigger value="roster">Jadwal mingguan</Tabs.Trigger>
          <Tabs.Trigger value="history">Riwayat konfirmasi</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="roster" className="mt-5 space-y-4">
          <h2 className="text-xl font-semibold">Jadwal piket mingguan</h2>
          {!data.extra.roster.length ? (
            <p className="rounded-xl border p-5">
              Belum ada jadwal piket yang dapat dilihat.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dutyDays.slice(1).map((name, i) => (
                <section
                  className="min-w-0 rounded-xl border bg-card p-4"
                  key={name}
                >
                  <h3 className="font-semibold">
                    {name}
                    {i + 1 === todayDay ? " · Hari ini" : ""}
                  </h3>
                  {data.extra.roster.filter((r) => r.weekday === i + 1)
                    .length ? (
                    <ul className="mt-2 space-y-2">
                      {data.extra.roster
                        .filter((r) => r.weekday === i + 1)
                        .map((r) => (
                          <li className="break-words" key={r.teacher_id}>
                            {r.name}
                            {!r.active && (
                              <span className="block text-sm text-muted-foreground">
                                Tugas Guru Piket tidak aktif
                              </span>
                            )}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Belum dijadwalkan
                    </p>
                  )}
                </section>
              ))}
            </div>
          )}
        </Tabs.Content>
        <Tabs.Content value="history" className="mt-5 space-y-4">
          <h2 className="text-xl font-semibold">
            Riwayat konfirmasi ({data.total})
          </h2>
          <form
            method="get"
            className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3"
          >
            <input type="hidden" name="view" value="history" />
            <label>
              Tahun kalender
              <input
                className={controlClass}
                name="year"
                type="number"
                min={2000}
                max={2100}
                defaultValue={filters.year ?? Number(data.today.slice(0, 4))}
              />
            </label>
            <label>
              Dari tanggal
              <input
                type="date"
                className={controlClass}
                name="start"
                defaultValue={filters.start}
              />
            </label>
            <label>
              Sampai tanggal
              <input
                type="date"
                className={controlClass}
                name="end"
                defaultValue={filters.end}
              />
            </label>
            <Button type="submit" disabled={busy}>
              Terapkan filter
            </Button>
          </form>
          <div className="flex flex-wrap gap-4">
            <a
              className="underline"
              href={api + "?" + query + (query.size ? "&" : "") + "format=xlsx"}
            >
              Ekspor Excel
            </a>
            <a
              className="underline"
              href={api + "?" + query + (query.size ? "&" : "") + "format=pdf"}
            >
              Ekspor PDF
            </a>
          </div>
          <p className="text-sm text-muted-foreground">
            Ekspor mengikuti periode dan hak akses, maksimal 10.000 catatan.
            Jadwal mingguan tidak dibatasi filter riwayat.
          </p>
          {!data.rows.length ? (
            <p className="rounded-xl border p-5">
              Belum ada catatan sesuai periode dan hak akses.
            </p>
          ) : (
            <TableRegion label="Riwayat konfirmasi guru piket">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <caption className="sr-only">Riwayat guru piket</caption>
                <thead>
                  <tr>
                    {["Tanggal", "Guru", "Penugasan", "Status", "Tindakan"].map(
                      (h) => (
                        <th scope="col" className="p-3" key={h}>
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr className="border-t" key={row.id}>
                      <td className="p-3">{row.date}</td>
                      <td className="p-3">{row.name}</td>
                      <td className="p-3">
                        {row.kind === "primary" ? "Piket utama" : "Pengganti"}
                        {row.notes && (
                          <p className="text-muted-foreground">
                            Menggantikan {row.notes}
                          </p>
                        )}
                      </td>
                      <td className="p-3">{statusLabel[row.status]}</td>
                      <td className="p-3">
                        {data.canManage &&
                        dutyActions(row, data.today).length > 0 ? (
                          <Button
                            disabled={locked}
                            variant="outline"
                            onClick={(e) =>
                              open("manage", e.currentTarget, row)
                            }
                          >
                            Kelola
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRegion>
          )}
          <nav
            aria-label="Halaman riwayat guru piket"
            className="ds-pagination ds-actions"
          >
            {data.page > 1 && (
              <a
                className="pagination-link"
                rel="prev"
                href={links(data.page - 1)}
              >
                Sebelumnya
              </a>
            )}
            <span>Halaman {data.page}</span>
            {data.page * data.pageSize < data.total && (
              <a
                className="pagination-link"
                rel="next"
                href={links(data.page + 1)}
              >
                Berikutnya
              </a>
            )}
          </nav>
        </Tabs.Content>
      </Tabs.Root>
      <Button
        disabled={busy}
        variant="outline"
        onClick={async () => {
          if (await discard()) window.location.reload();
        }}
      >
        Muat ulang
      </Button>
      <Dialog
        closeDisabled={busy}
        open={mode !== null}
        onOpenChange={async (v) => {
          if (!v) await close();
        }}
        returnFocusRef={trigger}
        className="duty-dialog duty-panel"
        title={
          mode === "primary"
            ? "Konfirmasi piket utama"
            : mode === "appoint"
              ? "Tunjuk guru pengganti"
              : mode === "roster"
                ? "Atur jadwal mingguan"
                : "Kelola konfirmasi piket"
        }
        description="Tindakan mengikuti hak akses akun. Perubahan konfirmasi hanya berlaku untuk hari ini (WIB)."
      >
        <div className="space-y-4">
          {feedback}
          <form
            onSubmit={submit}
            onChange={() => {
              dirty.current = true;
            }}
          >
            <fieldset disabled={locked} className="space-y-4">
              {mode === "manage" && edit ? (
                <>
                  <p>
                    {edit.name} · {statusLabel[edit.status]}
                  </p>
                  <label>
                    Tindakan
                    <select name="action" className={controlClass} required>
                      {dutyActions(edit, data.today).map((a) => (
                        <option value={a} key={a}>
                          {actionLabel[a]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Alasan
                    <textarea
                      name="reason"
                      className={controlClass}
                      minLength={3}
                      maxLength={2000}
                      required
                    />
                  </label>
                </>
              ) : mode === "roster" ? (
                <>
                  <label>
                    Guru
                    <select
                      value={teacher}
                      className={controlClass}
                      required
                      onChange={async (e) => {
                        const retainedEvalue = e.target.value;

                        if (await discard()) setTeacher(retainedEvalue);
                      }}
                    >
                      <option value="">Pilih guru…</option>
                      {teachers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {teacher && (
                    <fieldset key={teacher}>
                      <legend className="mb-2 font-medium">Hari piket</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {dutyDays.slice(1).map((day, i) => (
                          <label
                            className="flex min-h-11 items-center gap-2"
                            key={day}
                          >
                            <input
                              type="checkbox"
                              name="weekdays"
                              value={i + 1}
                              defaultChecked={data.extra.roster.some(
                                (r) =>
                                  r.teacher_id === teacher &&
                                  r.weekday === i + 1,
                              )}
                            />
                            {day}
                          </label>
                        ))}
                      </div>
                      <label className="mt-3 flex min-h-11 items-center gap-2">
                        <input type="checkbox" name="assignTask" />
                        Tetapkan juga tugas Guru Piket bila belum aktif
                      </label>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Hari lama dimuat otomatis. Tanpa pilihan, jadwal guru
                        ini akan dihapus saat disimpan.
                      </p>
                    </fieldset>
                  )}
                </>
              ) : (
                <>
                  {teacherSelect(
                    "teacherId",
                    mode === "appoint" ? "Guru pengganti" : "Guru piket utama",
                    mode === "primary" ? eligible : teachers,
                  )}
                  {mode === "appoint" &&
                    teacherSelect(
                      "replacesId",
                      "Guru yang digantikan",
                      eligible,
                    )}
                </>
              )}
              <Button disabled={mode === "roster" && !teacher} type="submit">
                Simpan
              </Button>
            </fieldset>
          </form>
          <Button disabled={busy} variant="outline" onClick={close}>
            Batal
          </Button>
          {blocked && (
            <Button
              variant="outline"
              onClick={async () => {
                if (await discard()) window.location.reload();
              }}
            >
              Muat ulang
            </Button>
          )}
        </div>
      </Dialog>
    </div>
  );
}
