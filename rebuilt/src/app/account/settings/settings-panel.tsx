"use client";
import {confirmAction} from "@/components/ui/confirm-action";
import { useWriteGuard } from "@/lib/forms/use-write-guard";
import { listenForUnsavedChanges } from "@/lib/forms/leave-guard";
import { TableRegion } from "@/components/ui/data-table";

import { useEffect, useState, useRef, type FormEvent } from "react";
import { confirmSettings } from "@/lib/settings/confirmation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  emptySchool,
  schoolAddress,
  settingsSnapshot,
  settingsRequest,
  type SettingsSnapshot,
} from "@/lib/settings/validation";
const inputClass =
  "mt-1 min-h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base shadow-xs focus-visible:outline-2 focus-visible:outline-ring";
function Field({
  name,
  label,
  value = "",
  max = 200,
  required = false,
  type = "text",
}: {
  name: string;
  label: string;
  value?: string | undefined;
  max?: number;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block min-w-0 text-sm font-medium">
      {label}
      <input
        className={inputClass}
        name={name}
        defaultValue={value}
        maxLength={max}
        required={required}
        type={type}
        {...(type === "date" ? { min: "1900-01-01", max: "2200-12-31" } : {})}
        onChange={(e) => {
          if (name === "start") {
            const end = e.currentTarget.form?.elements.namedItem("end");
            if (end instanceof HTMLInputElement) {
              end.min = e.currentTarget.value;
              if (!end.value) end.value = e.currentTarget.value;
            }
          }
        }}
      />
    </label>
  );
}
export function SettingsPanel({
  initial,
  assetBase,
}: {
  initial: SettingsSnapshot;
  assetBase: string;
}) {
  const [data, setData] = useState(initial),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [message, setMessage] = useState(""),
    [tab, setTab] = useState("school"),
    [versions, setVersions] = useState<Record<string, number>>({}),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const sending = useRef(false),
    mounted = useRef(true),
    active = useRef<AbortController | null>(null),
    dirty = useRef(new Set<string>());
  const root = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const busy = pending || blocked;
  useWriteGuard(() => sending.current);
  useEffect(() => {
    mounted.current = true;
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current.size || sending.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const stopUnloadGuard = listenForUnsavedChanges(warn);
    return () => {
      mounted.current = false;
      active.current?.abort();
      stopUnloadGuard();
    };
  }, []);
  async function discard() {
    return (
      !dirty.current.size ||
      await confirmAction(
        "Ada isian yang belum disimpan. Abaikan perubahan dan lanjutkan?",
      )
    );
  }
  async function request(url: string, init: RequestInit = {}) {
    const controller = new AbortController();
    active.current = controller;
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, {
        ...init,
        cache: "no-store",
        signal: controller.signal,
      });
      const body: unknown = await response.json();
      if (!body || typeof body !== "object") throw Error("Invalid response");
      return { response, body: body as Record<string, unknown> };
    } finally {
      clearTimeout(timer);
      active.current = null;
    }
  }
  async function reload() {
    if (sending.current || !await discard()) return;
    sending.current = true;
    setPending(true);
    setMessage("Memuat pengaturan…");
    try {
      const { response, body } = await request("/api/settings");
      if (!response.ok) throw Error("Read unavailable");
      const next = settingsSnapshot.parse(body.settings);
      if (!mounted.current) return;
      setData(next);
      setBlocked(false);
      dirty.current.clear();
      setVersions((v) =>
        Object.fromEntries(
          ["profile", "catalog", "holiday", "school", "cooperative"].map(
            (k) => [k, (v[k] ?? 0) + 1],
          ),
        ),
      );
      setEditing(null);
      setMessage("Pengaturan berhasil dimuat ulang.");
    } catch {
      if (mounted.current) {
        setBlocked(true);
        setMessage(
          "Pengaturan belum dapat dimuat. Muat ulang sebelum melanjutkan.",
        );
      }
    } finally {
      sending.current = false;
      if (mounted.current) setPending(false);
    }
  }
  async function submit(command: unknown, upload?: FormData) {
    if (sending.current || blocked) return;
    const c = (command ?? {}) as { type?: string; slot?: string };
    const formKey = upload
      ? String(upload.get("slot"))
      : c.type === "profile"
        ? "profile"
        : c.type === "logo_clear"
          ? String(c.slot)
          : c.type?.startsWith("holiday")
            ? "holiday"
            : "catalog";
    if (
      ["deactivate", "holiday_delete", "logo_clear"].includes(c.type ?? "") &&
      dirty.current.has(formKey) &&
      !await discard()
    )
      return;
    const body = {
      requestId: crypto.randomUUID(),
      revision: data.revision,
      command,
    };
    const parsed = upload ? null : settingsRequest.safeParse(body);
    if (parsed && !parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Periksa isian.");
      return;
    }
    if (upload) {
      const file = upload.get("file");
      if (
        !(file instanceof File) ||
        file.size === 0 ||
        file.size > 2097152 ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
      ) {
        setMessage("Pilih PNG, JPEG atau WebP berukuran 1 byte hingga 2 MB.");
        return;
      }
    }
    sending.current = true;
    setPending(true);
    setMessage("Menyimpan…");
    try {
      const { response, body: result } = await request(
        upload ? "/api/settings/logo" : "/api/settings",
        {
          method: "POST",
          ...(upload
            ? {}
            : { headers: { "Content-Type": "application/json" } }),
          body: upload ?? JSON.stringify(parsed?.success ? parsed.data : body),
        },
      );
      if (!mounted.current) return;
      if (!response.ok) {
        setMessage(
          typeof result.message === "string"
            ? result.message
            : "Permintaan belum berhasil.",
        );
        if (
          ![400, 413].includes(response.status) &&
          result.code !== "duplicate" &&
          result.code !== "invalid"
        )
          setBlocked(true);
        return;
      }
      if (result.code !== "saved") throw Error("Uncertain acknowledgement");
      const next = settingsSnapshot.parse(result.settings);
      if (next.revision !== data.revision + 1)
        throw Error("Uncertain revision");
      if (!upload)
        confirmSettings(
          next,
          parsed?.success ? parsed.data.command : command,
          next.revision,
        );
      else if (!next.school?.asset_data[formKey])
        throw Error("Logo not confirmed");
      setData(next);
      dirty.current.delete(formKey);
      setVersions((v) => ({ ...v, [formKey]: (v[formKey] ?? 0) + 1 }));
      if (formKey === "catalog" || formKey === "holiday") setEditing(null);
      setMessage(
        typeof result.message === "string"
          ? result.message
          : "Pengaturan berhasil disimpan.",
      );
    } catch {
      if (mounted.current) {
        setBlocked(true);
        setMessage(
          "Hasil penyimpanan belum dapat dipastikan. Muat ulang pengaturan sebelum mencoba kembali.",
        );
      }
    } finally {
      sending.current = false;
      if (mounted.current) setPending(false);
    }
  }
  async function edit(id: string | null) {
    if (sending.current || !await discard()) return;
    dirty.current.clear();
    setEditing(id);
    setVersions((v) => ({
      ...v,
      catalog: (v.catalog ?? 0) + 1,
      holiday: (v.holiday ?? 0) + 1,
    }));
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLInputElement>('form input:not([type="hidden"])')
        ?.focus(),
    );
  }
  function values(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    return new FormData(e.currentTarget);
  }
  const school = data.school ?? emptySchool;
  const items = tab === "subjects" ? data.subjects : data.memorization;
  const type = tab === "subjects" ? "subject" : "memorization";
  const current = items.find((x) => x.id === editing);
  const filteredItems = items.filter((x) =>
    x.name.toLocaleLowerCase("id").includes(query.toLocaleLowerCase("id")),
  );
  const filteredHolidays = data.holidays.filter((x) =>
    (x.holiday_date + " " + x.description)
      .toLocaleLowerCase("id")
      .includes(query.toLocaleLowerCase("id")),
  );
  const total =
    tab === "holidays" ? filteredHolidays.length : filteredItems.length;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(total / 20)));
  const pagination = (
    <nav
      aria-label="Halaman data pengaturan"
      className="flex flex-wrap items-center gap-3"
    >
      <Button
        variant="outline"
        disabled={pending || currentPage <= 1}
        onClick={() => setPage(currentPage - 1)}
      >
        Sebelumnya
      </Button>
      <span className="text-sm">
        Halaman {currentPage} / {Math.max(1, Math.ceil(total / 20))} · {total}{" "}
        data
      </span>
      <Button
        variant="outline"
        disabled={pending || currentPage * 20 >= total}
        onClick={() => setPage(currentPage + 1)}
      >
        Berikutnya
      </Button>
    </nav>
  );
  const search = (
    <label className="block min-w-0 text-sm font-medium">
      Cari data
      <input
        type="search"
        className={inputClass}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
        placeholder={
          tab === "holidays"
            ? "Tanggal atau keterangan"
            : "Nama mata pelajaran atau hafalan"
        }
      />
    </label>
  );
  const currentHoliday = data.holidays.find((x) => x.id === editing);
  const section = async (value: string) => {
    if (value === tab || sending.current || !await discard()) return;
    dirty.current.clear();
    setQuery("");
    setPage(1);
    setTab(value);
    setEditing(null);
    setMessage("");
  };
  return (
    <div
      ref={root}
      className="min-w-0 space-y-6 wrap-anywhere [&_[data-slot=card-content]]:min-w-0 [&_[data-slot=card-content]]:px-4 [&_[data-slot=card-header]]:px-4 sm:[&_[data-slot=card-content]]:px-6 sm:[&_[data-slot=card-header]]:px-6"
      aria-busy={pending}
      onChangeCapture={(e) => {
        const form = (e.target as HTMLElement).closest("form");
        if (form?.dataset.draft) dirty.current.add(form.dataset.draft);
      }}
    >
      <nav aria-label="Bagian pengaturan" className="flex flex-wrap gap-2">
        {[
          ["school", "Profil dan logo"],
          ["subjects", "Mata pelajaran"],
          ["memorization", "Hafalan"],
          ["holidays", "Hari libur"],
        ].map(([value, label]) => (
          <Button
            key={value}
            disabled={pending}
            variant={tab === value ? "default" : "outline"}
            aria-pressed={tab === value}
            onClick={async () => await section(value ?? "school")}
          >
            {label}
          </Button>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-4">
        <p role="status" aria-live="polite" className="flex-1">
          {message}
        </p>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => void reload()}
        >
          Muat ulang
        </Button>
      </div>
      {tab === "school" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Profil madrasah</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                data-draft="profile"
                key={versions.profile ?? 0}
                onSubmit={(e) => {
                  const form = values(e);
                  const identity = Object.fromEntries(
                    Object.keys(emptySchool.identity_data).map((k) => [
                      k,
                      String(form.get(k) ?? ""),
                    ]),
                  );
                  const address = Object.fromEntries(
                    Object.keys(emptySchool.address_data).map((k) => [
                      k,
                      String(form.get(k) ?? ""),
                    ]),
                  );
                  void submit({
                    type: "profile",
                    profile: {
                      name: String(form.get("name")),
                      identity_data: identity,
                      address_data: address,
                    },
                  });
                }}
              >
                <fieldset disabled={busy} className="space-y-4">
                  <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                    <Field
                      name="name"
                      label="Nama sekolah"
                      value={school.name}
                      required
                    />
                    <Field
                      name="head_name"
                      label="Nama kepala madrasah"
                      value={school.identity_data.head_name}
                    />
                    <Field
                      name="head_nip"
                      label="NIP kepala madrasah"
                      value={school.identity_data.head_nip}
                      max={40}
                    />
                    <Field
                      name="phone"
                      label="Telepon"
                      value={school.identity_data.phone}
                      max={40}
                      type="tel"
                    />
                    <Field
                      name="npsn"
                      label="NPSN"
                      value={school.identity_data.npsn}
                      max={30}
                    />
                    <Field
                      name="street"
                      label="Alamat lengkap / jalan"
                      value={school.address_data.street}
                      max={500}
                    />
                    {(
                      [
                        ["province", "Provinsi"],
                        ["regency", "Kabupaten/kota"],
                        ["district", "Kecamatan"],
                        ["village", "Kelurahan/desa"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="grid gap-2">
                        <Field
                          name={key}
                          label={label}
                          value={school.address_data[key]}
                          max={150}
                        />
                        <Field
                          name={`${key}_id`}
                          label={`Kode wilayah ${label.toLowerCase()} (opsional)`}
                          value={school.address_data[`${key}_id`]}
                          max={20}
                        />
                      </div>
                    ))}
                  </div>
                  <Button type="submit">Simpan profil sekolah</Button>
                </fieldset>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Pratinjau kop madrasah</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-center gap-6 rounded border p-6 text-center">
                {data.school?.asset_data.school && (
                  <Logo
                    path={data.school.asset_data.school}
                    base={assetBase}
                    alt="Logo sekolah"
                  />
                )}
                <div>
                  <h2 className="text-xl font-bold">
                    {school.name || "Nama sekolah belum diisi"}
                  </h2>
                  <p>{schoolAddress(school.address_data)}</p>
                  <p>
                    {[
                      school.identity_data.npsn &&
                        `NPSN ${school.identity_data.npsn}`,
                      school.identity_data.phone &&
                        `Tel. ${school.identity_data.phone}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Identitas ini digunakan pada kop dokumen dan laporan madrasah.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Logo madrasah dan koperasi</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <p>
                Logo bersifat publik. PNG, JPEG atau WebP, maksimal 2 MB dan
                4096 × 4096 piksel. Simpan profil sebelum mengunggah.
              </p>
              {(["school", "cooperative"] as const).map((slot) => (
                <div key={slot} className="space-y-3 rounded border p-4">
                  <h3 className="font-semibold">
                    {slot === "school" ? "Logo sekolah" : "Logo koperasi"}
                  </h3>
                  {data.school?.asset_data[slot] && (
                    <Logo
                      path={data.school.asset_data[slot]}
                      base={assetBase}
                      alt={slot === "school" ? "Logo sekolah" : "Logo koperasi"}
                    />
                  )}
                  <form
                    data-draft={slot}
                    key={`${slot}-${versions[slot] ?? 0}`}
                    onSubmit={(e) => {
                      const form = values(e);
                      form.set("slot", slot);
                      form.set("revision", String(data.revision));
                      void submit(null, form);
                    }}
                  >
                    <fieldset
                      disabled={busy || !data.school}
                      className="grid min-w-0 gap-3 sm:flex sm:flex-wrap sm:items-end"
                    >
                      <label className="min-w-0 max-w-full flex-1">
                        Pilih gambar
                        <input
                          aria-label={`Pilih ${slot === "school" ? "logo sekolah" : "logo koperasi"}`}
                          type="file"
                          name="file"
                          accept="image/png,image/jpeg,image/webp"
                          required
                          className="mt-2 block w-full min-w-0 max-w-full text-sm file:mr-2 file:min-h-11 file:rounded-md file:border file:px-3"
                        />
                      </label>
                      <Button type="submit">Unggah logo</Button>
                      {data.school?.asset_data[slot] && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            if (await confirmAction("Hapus logo dari profil?"))
                              void submit({ type: "logo_clear", slot });
                          }}
                        >
                          Hapus logo
                        </Button>
                      )}
                    </fieldset>
                  </form>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
      {(tab === "subjects" || tab === "memorization") && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>
                {tab === "subjects"
                  ? "Master mata pelajaran"
                  : "Master hafalan"}
              </h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm">
              Nonaktifkan data yang tidak lagi digunakan. Riwayat dan relasinya
              tetap tersimpan; gunakan Edit untuk mengaktifkannya kembali.
            </p>
            <form
              data-draft="catalog"
              key={`${tab}-${editing}-${versions.catalog ?? 0}`}
              onSubmit={(e) => {
                const f = values(e);
                void submit({
                  type,
                  id: current?.id ?? null,
                  name: String(f.get("name")),
                  active: f.get("active") === "on",
                });
              }}
            >
              <fieldset disabled={busy} className="space-y-3">
                <Field
                  name="name"
                  label={current ? "Ubah nama" : "Nama baru"}
                  value={current?.name ?? ""}
                  required
                  max={type === "subject" ? 150 : 200}
                />
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    name="active"
                    className="size-5 accent-primary"
                    type="checkbox"
                    defaultChecked={current?.active ?? true}
                  />
                  Aktif
                </label>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <Button type="submit">
                    {current ? "Simpan perubahan" : "Tambah"}
                  </Button>
                  {editing && (
                    <Button
                      variant="outline"
                      type="button"
                      onClick={async () => await edit(null)}
                    >
                      Batal edit
                    </Button>
                  )}
                </div>
              </fieldset>
            </form>
            {search}
            {filteredItems.length === 0 ? (
              <p>
                {query
                  ? "Tidak ada data yang cocok dengan pencarian."
                  : "Belum ada data."}
              </p>
            ) : (
              <ul className="divide-y">
                {filteredItems
                  .slice((currentPage - 1) * 20, currentPage * 20)
                  .map((x) => (
                    <li
                      key={x.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <span>
                        {x.name}
                        {!x.active && (
                          <span className="ml-2 text-muted-foreground">
                            (Nonaktif)
                          </span>
                        )}
                      </span>
                      <div className="flex min-w-0 flex-wrap gap-2">
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={async () => await edit(x.id)}
                        >
                          Edit
                        </Button>
                        {x.active && (
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={async () => {
                              if (await confirmAction(`Nonaktifkan ${x.name}?`))
                                void submit({
                                  type: "deactivate",
                                  catalog: type,
                                  id: x.id,
                                });
                            }}
                          >
                            Nonaktifkan
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
      {(tab === "subjects" || tab === "memorization") && pagination}
      {tab === "holidays" && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Hari libur</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p>
              Rentang tanggal bersifat inklusif, maksimal 366 hari. Tanggal yang
              sudah ada dilewati tanpa mengubah keterangannya.
            </p>
            <form
              data-draft="holiday"
              key={`${editing}-${versions.holiday ?? 0}`}
              onSubmit={(e) => {
                const f = values(e);
                const start = String(f.get("start"));
                void submit({
                  type: "holiday",
                  id: currentHoliday?.id ?? null,
                  start,
                  end: currentHoliday ? start : String(f.get("end")),
                  description: String(f.get("description")),
                });
              }}
            >
              <fieldset
                disabled={busy}
                className="grid min-w-0 gap-4 sm:grid-cols-2"
              >
                <Field
                  type="date"
                  name="start"
                  label={currentHoliday ? "Tanggal" : "Tanggal awal"}
                  value={currentHoliday?.holiday_date}
                  required
                />
                {!currentHoliday && (
                  <Field
                    type="date"
                    name="end"
                    label="Tanggal akhir (sama untuk satu hari)"
                    required
                  />
                )}
                <Field
                  name="description"
                  label="Keterangan"
                  value={currentHoliday?.description}
                  required
                  max={500}
                />
                <div className="flex min-w-0 flex-wrap items-end gap-2">
                  <Button type="submit">
                    {currentHoliday
                      ? "Simpan perubahan"
                      : "Tambahkan hari libur"}
                  </Button>
                  {editing && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => await edit(null)}
                    >
                      Batal edit
                    </Button>
                  )}
                </div>
              </fieldset>
            </form>
            {search}
            {filteredHolidays.length === 0 ? (
              <p>
                {query
                  ? "Tidak ada hari libur yang cocok dengan pencarian."
                  : "Belum ada hari libur."}
              </p>
            ) : (
              <TableRegion label="Tabel data — gulir untuk melihat seluruh kolom">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Daftar hari libur</caption>
                  <thead>
                    <tr>
                      <th className="p-2" scope="col">
                        Tanggal
                      </th>
                      <th className="p-2" scope="col">
                        Keterangan
                      </th>
                      <th className="p-2" scope="col">
                        Tindakan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHolidays
                      .slice((currentPage - 1) * 20, currentPage * 20)
                      .map((x) => (
                        <tr className="border-t" key={x.id}>
                          <td className="whitespace-nowrap p-2">
                            {x.holiday_date}
                          </td>
                          <td className="p-2">{x.description}</td>
                          <td className="flex gap-2 p-2">
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={async () => await edit(x.id)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={async () => {
                                if (
                                  await confirmAction(
                                    `Hapus hari libur ${x.holiday_date}?`,
                                  )
                                )
                                  void submit({
                                    type: "holiday_delete",
                                    id: x.id,
                                  });
                              }}
                            >
                              Hapus
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </TableRegion>
            )}
          </CardContent>
        </Card>
      )}
      {tab === "holidays" && pagination}
    </div>
  );
}
function Logo({
  path,
  base,
  alt,
}: {
  path: string;
  base: string;
  alt: string;
}) {
  if (!/^[a-f0-9-]{36}\.png$/.test(path)) return null;
  return (
    <a
      href={base + path}
      target="_blank"
      rel="noreferrer"
      className="inline-block"
    >
      <span className="sr-only">Buka {alt}</span>
      <Image
        unoptimized
        src={base + path}
        alt={alt}
        width={96}
        height={96}
        className="h-24 w-24 object-contain"
      />
    </a>
  );
}
