"use client";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { profileSchema } from "@/lib/auth/recovery-validation";
import {
  profileWriteSchema,
  profileDraft,
  sameProfileContent,
  profileFields,
  type ProfileField,
  type PersonalProfile,
} from "@/lib/auth/profile";
const labels: Record<ProfileField, string> = {
  full_name: "Nama lengkap",
  phone: "Nomor HP",
  contact_email: "Email kontak",
  bio: "Bio",
};
const field =
  "mt-2 min-h-11 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function ProfileForm({
  initialProfile,
}: {
  initialProfile: PersonalProfile;
}) {
  const router = useRouter(),
    [profile, setProfile] = useState(initialProfile),
    [draft, setDraft] = useState(() => profileDraft(initialProfile)),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({}),
    [pending, setPending] = useState<PersonalProfile | null>(null);
  const lock = useRef(false),
    mounted = useRef(true),
    focus = useRef<ProfileField | null>(null);
  const dirty = profileFields.some((k) => draft[k] !== profile[k]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (focus.current) {
      document.getElementById("profile-" + focus.current)?.focus();
      focus.current = null;
    }
  }, [errors]);
  function notice(text: string, error = false) {
    if (mounted.current) {
      setMessage(text);
      setFailed(error);
    }
  }
  function apply(next: PersonalProfile) {
    if (!mounted.current) return;
    setProfile(next);
    setDraft(profileDraft(next));
    setPending(null);
    setErrors({});
    router.refresh();
  }
  async function readProfile() {
    const r = await fetch("/api/account/profile", { cache: "no-store" });
    if (r.status === 401) {
      if (mounted.current) {
        router.replace("/login?expired=1");
        router.refresh();
      }
      throw Error("Sesi berakhir. Silakan masuk kembali.");
    }
    const body: unknown = await r.json();
    if (!r.ok)
      throw Error(
        "Profil belum dapat diperiksa. Coba kembali tanpa mengirim ulang perubahan.",
      );
    const result = profileSchema.parse(
      (body as { profile?: unknown })?.profile,
    );
    if (result.username !== profile.username)
      throw Error("Identitas profil tidak sesuai.");
    return result;
  }
  async function checkSaved() {
    if (lock.current || !pending) return;
    lock.current = true;
    setBusy(true);
    notice("Memeriksa profil yang tersimpan…");
    try {
      const current = await readProfile();
      if (sameProfileContent(current, pending)) {
        apply(current);
        notice("Profil tersimpan sesuai perubahan Anda.");
      } else
        notice(
          "Data tersimpan berbeda dari isian Anda. Isian tetap dipertahankan. Muat ulang untuk meninjau data terbaru sebelum menyimpan lagi.",
          true,
        );
    } catch {
      notice(
        "Status penyimpanan belum dapat diperiksa. Isian tetap dipertahankan. Coba periksa status kembali.",
        true,
      );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current || pending) return;
    const parsed = profileWriteSchema.safeParse({
      ...draft,
      username: profile.username,
      updated_at: profile.updated_at,
    });
    if (!parsed.success) {
      const next: Partial<Record<ProfileField, string>> = {};
      for (const issue of parsed.error.issues) {
        const name = String(issue.path[0]) as ProfileField;
        if (profileFields.includes(name))
          next[name] =
            name === "contact_email"
              ? "Masukkan email kontak yang valid atau kosongkan."
              : name === "full_name"
                ? "Isi nama lengkap 1–200 karakter yang valid."
                : "Periksa " + labels[name].toLowerCase() + ".";
      }
      focus.current = profileFields.find((k) => next[k]) ?? null;
      setErrors(next);
      notice("Periksa isian yang ditandai.", true);
      return;
    }
    lock.current = true;
    setBusy(true);
    setErrors({});
    notice("Menyimpan profil…");
    try {
      const r = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!mounted.current) return;
      if (r.status === 401) {
        router.replace("/login?expired=1");
        router.refresh();
        notice("Sesi berakhir. Silakan masuk kembali.", true);
        return;
      }
      const body: unknown = await r.json();
      if (!mounted.current) return;
      const info =
        body && typeof body === "object"
          ? (body as Record<string, unknown>)
          : {};
      if (!r.ok) {
        if (r.status === 409 || r.status >= 500) setPending(parsed.data);
        notice(
          typeof info.message === "string"
            ? info.message
            : "Profil belum dapat disimpan. Isian tetap dipertahankan.",
          true,
        );
        return;
      }
      const next = profileSchema.parse(info.profile);
      if (!sameProfileContent(next, parsed.data))
        throw Error("Unconfirmed profile");
      const emailChanged = profile.contact_email !== next.contact_email;
      apply(next);
      notice(
        emailChanged
          ? "Profil berhasil diperbarui. Email kontak berubah; verifikasi email lama dibatalkan."
          : "Profil berhasil diperbarui.",
      );
    } catch {
      if (mounted.current) setPending(parsed.data);
      notice(
        "Hasil penyimpanan belum dapat dipastikan. Isian tetap dipertahankan. Periksa status penyimpanan sebelum mengirim ulang.",
        true,
      );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function reload() {
    if (lock.current) return;
    if (
      dirty &&
      !window.confirm(
        "Muat ulang profil dan batalkan isian yang belum disimpan?",
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    notice("Memuat profil terbaru…");
    try {
      apply(await readProfile());
      notice("Profil terbaru berhasil dimuat.");
    } catch {
      notice(
        "Profil belum dapat dimuat ulang. Isian Anda tetap dipertahankan.",
        true,
      );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <Card className="min-w-0">
      <CardHeader className="min-w-0 grid-cols-1 px-4 sm:px-6">
        <CardTitle>
          <h2>Informasi akun</h2>
        </CardTitle>
        <p className="min-w-0 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
          Username:{" "}
          <strong className="text-foreground">{profile.username}</strong>
        </p>
      </CardHeader>
      <CardContent className="min-w-0 px-4 sm:px-6">
        <form
          noValidate
          onSubmit={(e) => void submit(e)}
          className="min-w-0 space-y-5"
          aria-busy={busy}
        >
          <p className="text-sm text-muted-foreground">
            Nama lengkap wajib diisi. Nomor HP, email kontak, dan bio dapat
            dikosongkan.
          </p>
          <fieldset
            disabled={busy || !!pending}
            className="grid min-w-0 gap-5 sm:grid-cols-2"
          >
            <legend className="sr-only">Edit profil pribadi</legend>
            {profileFields.map((name) => (
              <div
                key={name}
                className={
                  "min-w-0 " +
                  (name === "bio" || name === "contact_email"
                    ? "sm:col-span-2"
                    : "")
                }
              >
                <label
                  htmlFor={"profile-" + name}
                  className="text-sm font-medium"
                >
                  {labels[name]}
                  {name === "full_name" ? " *" : ""}
                </label>
                {name === "bio" ? (
                  <textarea
                    id={"profile-" + name}
                    name={name}
                    className={field + " min-h-32 resize-y"}
                    value={draft[name]}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, [name]: e.target.value }));
                      setErrors((s) => {
                        const next = { ...s };
                        delete next[name];
                        return next;
                      });
                    }}
                    maxLength={2000}
                    rows={4}
                    aria-invalid={!!errors[name]}
                    aria-describedby={
                      "profile-" +
                      name +
                      "-help" +
                      (errors[name] ? " profile-" + name + "-error" : "")
                    }
                  />
                ) : (
                  <input
                    id={"profile-" + name}
                    name={name}
                    className={field}
                    type={
                      name === "phone"
                        ? "tel"
                        : name === "contact_email"
                          ? "email"
                          : "text"
                    }
                    autoComplete={
                      name === "full_name"
                        ? "name"
                        : name === "phone"
                          ? "tel"
                          : "email"
                    }
                    value={draft[name]}
                    maxLength={
                      name === "full_name" ? 200 : name === "phone" ? 40 : 320
                    }
                    required={name === "full_name"}
                    aria-invalid={!!errors[name]}
                    aria-describedby={
                      (name === "contact_email"
                        ? "profile-contact_email-help"
                        : "") +
                        (errors[name] ? " profile-" + name + "-error" : "") ||
                      undefined
                    }
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, [name]: e.target.value }));
                      setErrors((s) => {
                        const next = { ...s };
                        delete next[name];
                        return next;
                      });
                    }}
                  />
                )}
                {name === "contact_email" && (
                  <p
                    id="profile-contact_email-help"
                    className="mt-2 text-xs text-muted-foreground"
                  >
                    Jika email kontak berubah atau dihapus, verifikasi email
                    lama dibatalkan. Email kontak berbeda dari username untuk
                    masuk.
                  </p>
                )}
                {name === "bio" && (
                  <p
                    id="profile-bio-help"
                    className="mt-2 text-xs text-muted-foreground"
                  >
                    {draft.bio.length.toLocaleString("id-ID")} / 2.000 karakter
                  </p>
                )}
                {errors[name] && (
                  <p
                    id={"profile-" + name + "-error"}
                    className="mt-2 text-sm text-destructive"
                  >
                    {errors[name]}
                  </p>
                )}
              </div>
            ))}
          </fieldset>
          {dirty && (
            <p className="text-sm font-medium">
              Ada perubahan yang belum disimpan.
            </p>
          )}
          <div
            role={failed ? "alert" : "status"}
            aria-live={failed ? "assertive" : "polite"}
            className={
              message
                ? "rounded-lg border p-3 text-sm break-words " +
                  (failed
                    ? "border-destructive text-destructive"
                    : "bg-muted/30")
                : ""
            }
          >
            {message}
          </div>
          <div className="flex flex-col flex-wrap gap-3 sm:flex-row">
            <Button type="submit" disabled={busy || !!pending}>
              {busy ? "Memproses…" : "Simpan profil"}
            </Button>
            {pending && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                className="max-w-full whitespace-normal"
                onClick={() => void checkSaved()}
              >
                Periksa status penyimpanan
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void reload()}
            >
              Muat ulang
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
