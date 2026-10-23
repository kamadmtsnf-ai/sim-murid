"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Status } from "@/components/ui/status";
import {
  SelectField,
  TextField,
  controlClass,
} from "@/components/domain-controls";
import { familyCommand, familySnapshot } from "@/lib/education/validation";
import {
  familySelection,
  type FamilySnapshot,
  type FamilyCommand,
} from "@/lib/education/families";
const relation = { father: "Ayah", mother: "Ibu", guardian: "Wali" };
export function FamilyPanel({ initial }: { initial: FamilySnapshot }) {
  const [data, setData] = useState(initial),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [message, setMessage] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState(""),
    [groupSearch, setGroupSearch] = useState(""),
    [guardianSearch, setGuardianSearch] = useState(""),
    [groupPage, setGroupPage] = useState(1),
    [guardianPage, setGuardianPage] = useState(1),
    [formVersion, setFormVersion] = useState({ guardian: 0, family: 0 });
  const lock = useRef(false),
    mounted = useRef(true),
    abort = useRef<AbortController | null>(null),
    dirty = useRef(new Set<string>()),
    feedback = useRef<HTMLDivElement>(null),
    groupForm = useRef<HTMLFormElement>(null);
  const busy = pending || blocked;
  useEffect(() => {
    mounted.current = true;
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current.size || lock.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      mounted.current = false;
      abort.current?.abort();
      window.removeEventListener("beforeunload", warn);
    };
  }, []);
  useEffect(() => {
    if (message && !pending) feedback.current?.focus();
  }, [message, pending]);
  const current = data.families.find((f) => f.id === editing);
  const people = new Map(
    [...data.students, ...data.parents, ...data.references].map((p) => [
      p.id,
      p,
    ]),
  );
  const name = (id: string) => {
    const p = people.get(id);
    return p
      ? `${p.name}${p.username ? ` (${p.username})` : ""}`
      : `Akun di luar katalog (${id})`;
  };
  const activeStudents = new Set(data.students.map((p) => p.id));
  const roster = [
    ...data.students,
    ...(current?.members
      .filter((m) => !activeStudents.has(m.student_id))
      .map(
        (m) =>
          people.get(m.student_id) ?? {
            id: m.student_id,
            name: "Akun di luar katalog",
            username: m.student_id,
          },
      ) ?? []),
  ];
  const matches = (text: string, q: string) =>
    text.toLocaleLowerCase("id").includes(q.trim().toLocaleLowerCase("id"));
  const visibleRoster = roster.filter((p) => matches(name(p.id), search));
  const groups = data.families.filter((f) =>
    matches(
      f.name + " " + f.members.map((m) => name(m.student_id)).join(" "),
      groupSearch,
    ),
  );
  const guardians = data.guardians.filter((g) =>
    matches(
      name(g.student_id) +
        " " +
        name(g.parent_id) +
        " " +
        relation[g.relationship],
      guardianSearch,
    ),
  );
  function discard() {
    return (
      !dirty.current.size ||
      window.confirm(
        "Ada isian yang belum disimpan. Abaikan perubahan dan lanjutkan?",
      )
    );
  }
  async function request(command?: FamilyCommand) {
    if (lock.current || (command && blocked)) return;
    lock.current = true;
    setPending(true);
    setMessage(command ? "Menyimpan relasi…" : "Memuat relasi…");
    const controller = new AbortController();
    abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const r = await fetch("/api/families", {
        cache: "no-store",
        signal: controller.signal,
        ...(command
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                requestId: crypto.randomUUID(),
                revision: data.revision,
                command,
              }),
            }
          : {}),
      });
      const b: unknown = await r.json();
      if (!mounted.current) return;
      if (!b || typeof b !== "object") throw Error("Invalid response");
      const body = b as Record<string, unknown>;
      if (!r.ok) {
        if (r.status >= 500) throw Error("Uncertain request");
        setMessage(
          typeof body.message === "string"
            ? body.message
            : "Permintaan belum berhasil.",
        );
        if (
          !command ||
          (![400, 413].includes(r.status) &&
            body.code !== "invalid" &&
            body.code !== "duplicate")
        )
          setBlocked(true);
        return;
      }
      const next = familySnapshot.safeParse(body.families);
      if (
        !next.success ||
        (command &&
          (body.code !== "saved" || next.data.revision !== data.revision + 1))
      )
        throw Error("Uncertain snapshot");
      setData(next.data);
      setBlocked(false);
      if (command?.type === "guardian" && !command.remove) {
        dirty.current.delete("guardian");
        setFormVersion((v) => ({ ...v, guardian: v.guardian + 1 }));
      } else if (command?.type === "family") {
        dirty.current.delete("family");
        setEditing(null);
        setSelected([]);
        setSearch("");
        setFormVersion((v) => ({ ...v, family: v.family + 1 }));
      } else if (!command) {
        dirty.current.clear();
        setEditing(null);
        setSelected([]);
        setSearch("");
        setFormVersion((v) => ({
          guardian: v.guardian + 1,
          family: v.family + 1,
        }));
      }
      setMessage(
        command
          ? "Perubahan tersimpan dan relasi telah dikonfirmasi."
          : "Relasi berhasil dimuat ulang.",
      );
    } catch {
      if (mounted.current) {
        setBlocked(true);
        setMessage(
          command
            ? "Hasil penyimpanan belum dapat dipastikan. Muat ulang untuk memeriksa relasi sebelum mencoba kembali."
            : "Relasi belum dapat dimuat. Muat ulang sebelum melanjutkan.",
        );
      }
    } finally {
      clearTimeout(timer);
      lock.current = false;
      abort.current = null;
      if (mounted.current) setPending(false);
    }
  }
  function submit(command: unknown) {
    const c = familyCommand.safeParse(command);
    if (!c.success) {
      setMessage(c.error.issues[0]?.message ?? "Periksa isian relasi.");
      return;
    }
    void request(c.data);
  }
  function edit(id: string | null) {
    if (
      lock.current ||
      (dirty.current.has("family") &&
        !window.confirm("Abaikan perubahan grup yang belum disimpan?"))
    )
      return;
    dirty.current.delete("family");
    setEditing(id);
    setSelected(
      data.families
        .find((f) => f.id === id)
        ?.members.map((m) => m.student_id) ?? [],
    );
    setSearch("");
    setFormVersion((v) => ({ ...v, family: v.family + 1 }));
    requestAnimationFrame(() =>
      groupForm.current?.querySelector("input")?.focus(),
    );
  }
  function familySubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const members = familySelection(data, editing, selected);
    if (!members.length || members.length > 30) {
      setMessage("Pilih 1–30 anggota grup yang sudah diverifikasi.");
      return;
    }
    const moves = members.filter((id) =>
      data.families.some(
        (f) => f.id !== editing && f.members.some((m) => m.student_id === id),
      ),
    );
    const removed =
      current?.members.filter((m) => !members.includes(m.student_id)) ?? [];
    if (
      (moves.length || removed.length) &&
      !window.confirm(
        `Perubahan grup memengaruhi perhitungan iuran. ${moves.length ? `Pindahkan ${moves.map(name).join(", ")} dari grup lama. ` : ""}${removed.length ? `Akhiri keanggotaan ${removed.map((m) => name(m.student_id)).join(", ")}. ` : ""}Lanjutkan?`,
      )
    )
      return;
    submit({
      type: "family",
      id: editing,
      name: String(new FormData(e.currentTarget).get("name") ?? ""),
      studentIds: members,
    });
  }
  function pages(
    total: number,
    page: number,
    set: (n: number) => void,
    label: string,
  ) {
    const currentPage = Math.min(page, Math.max(1, Math.ceil(total / 20)));
    return (
      <nav aria-label={label} className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={pending || currentPage <= 1}
          onClick={() => set(currentPage - 1)}
        >
          Sebelumnya
        </Button>
        <span className="text-sm">
          {total} data · Halaman {currentPage}/
          {Math.max(1, Math.ceil(total / 20))}
        </span>
        <Button
          variant="outline"
          disabled={pending || currentPage * 20 >= total}
          onClick={() => set(currentPage + 1)}
        >
          Berikutnya
        </Button>
      </nav>
    );
  }
  const gp = Math.min(groupPage, Math.max(1, Math.ceil(groups.length / 20))),
    rp = Math.min(guardianPage, Math.max(1, Math.ceil(guardians.length / 20)));
  return (
    <div
      className="families-panel min-w-0 space-y-6 wrap-anywhere"
      aria-busy={pending}
      onChangeCapture={(e) => {
        const f = (e.target as HTMLElement).closest("form");
        if (f?.dataset.draft) dirty.current.add(f.dataset.draft);
      }}
    >
      <p className="text-sm text-muted-foreground">
        Relasi orang tua memberi akses baca anak. Grup saudara kandung digunakan
        terpisah untuk perhitungan iuran. Nama atau KK yang sama tidak otomatis
        menghubungkan akun.
      </p>
      <div className="flex flex-wrap items-start gap-3">
        <div
          ref={feedback}
          tabIndex={-1}
          className="min-w-0 flex-1 outline-none"
        >
          {message && (
            <Status tone={blocked ? "error" : "info"}>{message}</Status>
          )}
        </div>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (discard()) void request();
          }}
        >
          Muat ulang relasi
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Hubungkan orang tua dan siswa</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-5">
          {(!data.students.length || !data.parents.length) && (
            <Status>
              Belum tersedia akun siswa atau orang tua aktif untuk dihubungkan.
              Relasi yang sudah ada tetap dapat ditinjau.
            </Status>
          )}
          <form
            data-draft="guardian"
            key={formVersion.guardian}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                window.confirm(
                  "Identitas dan hubungan kedua akun sudah diverifikasi?",
                )
              )
                submit({
                  type: "guardian",
                  studentId: String(f.get("student")),
                  parentId: String(f.get("parent")),
                  relationship: String(f.get("relationship")),
                  remove: false,
                });
            }}
          >
            <fieldset
              disabled={busy}
              className="grid min-w-0 gap-4 sm:grid-cols-2"
            >
              <SelectField name="student" label="Siswa / Calon Siswa" required>
                <option value="">Pilih siswa</option>
                {data.students.map((p) => (
                  <option key={p.id} value={p.id}>
                    {name(p.id)}
                  </option>
                ))}
              </SelectField>
              <SelectField name="parent" label="Akun Orang Tua" required>
                <option value="">Pilih orang tua</option>
                {data.parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {name(p.id)}
                  </option>
                ))}
              </SelectField>
              <SelectField name="relationship" label="Hubungan">
                <option value="father">Ayah</option>
                <option value="mother">Ibu</option>
                <option value="guardian">Wali</option>
              </SelectField>
              <Button
                disabled={!data.students.length || !data.parents.length}
                type="submit"
              >
                Verifikasi dan hubungkan
              </Button>
            </fieldset>
          </form>
          <details className="space-y-4">
            <summary className="min-h-11 cursor-pointer font-medium">
              Daftar relasi terverifikasi ({data.guardians.length})
            </summary>
            <label className="block text-sm font-medium">
              Cari relasi
              <input
                type="search"
                className={controlClass}
                value={guardianSearch}
                onChange={(e) => {
                  setGuardianSearch(e.target.value);
                  setGuardianPage(1);
                }}
              />
            </label>
            {!guardians.length ? (
              <p className="text-sm text-muted-foreground">
                {guardianSearch
                  ? "Tidak ada relasi yang cocok."
                  : "Belum ada relasi terverifikasi."}
              </p>
            ) : (
              <ul className="divide-y">
                {guardians.slice((rp - 1) * 20, rp * 20).map((g) => (
                  <li
                    key={g.id}
                    className="flex min-w-0 flex-col items-start justify-between gap-3 py-4 sm:flex-row"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{name(g.student_id)}</p>
                      <p className="text-sm">
                        {relation[g.relationship]}: {name(g.parent_id)}
                      </p>
                      {(!activeStudents.has(g.student_id) ||
                        !data.parents.some((p) => p.id === g.parent_id)) && (
                        <p className="text-xs text-muted-foreground">
                          Memuat akun di luar katalog aktif; pencabutan tetap
                          tersedia.
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Cabut akses ${name(g.parent_id)} terhadap ${name(g.student_id)} sebagai ${relation[g.relationship]}?`,
                          )
                        )
                          submit({
                            type: "guardian",
                            studentId: g.student_id,
                            parentId: g.parent_id,
                            relationship: g.relationship,
                            remove: true,
                          });
                      }}
                    >
                      Cabut relasi
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {pages(
              guardians.length,
              guardianPage,
              setGuardianPage,
              "Halaman relasi orang tua",
            )}
          </details>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Grup saudara kandung</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-5">
          <p className="text-sm text-muted-foreground">
            Urutan anggota tersimpan dipertahankan untuk perhitungan iuran.
            Pemindahan atau pengeluaran anggota mengakhiri keanggotaan lama
            dengan riwayat.
          </p>
          <form
            ref={groupForm}
            data-draft="family"
            key={`${editing}:${formVersion.family}`}
            onSubmit={familySubmit}
          >
            <fieldset disabled={busy} className="min-w-0 space-y-4">
              <TextField
                name="name"
                label="Nama / kode grup"
                value={current?.name}
                required
                max={150}
              />
              <label className="block text-sm font-medium">
                Cari calon anggota
                <input
                  type="search"
                  className={controlClass}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <fieldset className="max-h-72 min-w-0 overflow-y-auto rounded-lg border p-3">
                <legend className="text-sm font-medium">
                  Anggota terverifikasi ({selected.length}/30)
                </legend>
                {!roster.length && (
                  <p className="text-sm">Belum ada siswa yang dapat dipilih.</p>
                )}
                {roster.length > 0 && !visibleRoster.length && (
                  <p className="text-sm">
                    Tidak ada siswa yang cocok dengan pencarian.
                  </p>
                )}
                {visibleRoster.map((p) => (
                  <label
                    key={p.id}
                    className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm"
                  >
                    <input
                      className="mt-1 size-5 shrink-0 accent-primary"
                      type="checkbox"
                      name="students"
                      value={p.id}
                      checked={selected.includes(p.id)}
                      disabled={
                        !selected.includes(p.id) && selected.length >= 30
                      }
                      onChange={(e) => {
                        setSelected((ids) =>
                          e.target.checked
                            ? [...ids, p.id]
                            : ids.filter((x) => x !== p.id),
                        );
                        dirty.current.add("family");
                      }}
                    />
                    <span className="min-w-0">
                      {name(p.id)}
                      {!activeStudents.has(p.id) && (
                        <span className="block text-xs text-muted-foreground">
                          Anggota tersimpan di luar katalog aktif; tidak dihapus
                          otomatis.
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>
              {selected.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Terpilih: {selected.map(name).join(", ")}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button disabled={!roster.length} type="submit">
                  {current ? "Simpan perubahan grup" : "Buat grup"}
                </Button>
                {editing && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => edit(null)}
                  >
                    Batal edit
                  </Button>
                )}
              </div>
            </fieldset>
          </form>
          <details className="space-y-4">
            <summary className="min-h-11 cursor-pointer font-medium">
              Daftar grup saudara ({data.families.length})
            </summary>
            <label className="block text-sm font-medium">
              Cari grup
              <input
                type="search"
                className={controlClass}
                value={groupSearch}
                onChange={(e) => {
                  setGroupSearch(e.target.value);
                  setGroupPage(1);
                }}
              />
            </label>
            {!groups.length ? (
              <p className="text-sm text-muted-foreground">
                {groupSearch
                  ? "Tidak ada grup yang cocok."
                  : "Belum ada grup saudara kandung."}
              </p>
            ) : (
              <ul className="divide-y">
                {groups.slice((gp - 1) * 20, gp * 20).map((f) => (
                  <li key={f.id} className="space-y-2 py-4">
                    <h3 className="font-semibold">{f.name}</h3>
                    <p className="text-sm">
                      {f.members.map((m) => name(m.student_id)).join(", ") ||
                        "Tidak ada anggota aktif"}
                    </p>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => edit(f.id)}
                    >
                      Edit grup
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {pages(
              groups.length,
              groupPage,
              setGroupPage,
              "Halaman grup saudara",
            )}
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
