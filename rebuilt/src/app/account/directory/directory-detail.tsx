import Link from "next/link";
import { UserRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import { clock, weekdays } from "@/lib/education/validation";
import {
  directoryRoleLabel,
  directoryDate,
  directoryToday,
  directoryAssignmentState,
  assignmentLabel,
  type DirectoryDetailData,
} from "@/lib/education/directory";
function DateValue({ value }: { value: string }) {
  const formatted = directoryDate(value);
  return formatted ? (
    <time dateTime={value}>{formatted}</time>
  ) : (
    <>Tanggal belum tersedia</>
  );
}
export function DirectoryDetailUnavailable() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="directory-detail space-y-4"
    >
      <h1 className="text-2xl font-semibold">
        Detail tidak tersedia untuk akun Anda
      </h1>
      <Status>
        Data mungkin sudah berubah atau berada di luar hak akses Anda.
      </Status>
    </main>
  );
}
export function DirectoryDetailView({
  person: p,
}: {
  person: DirectoryDetailData;
}) {
  const today = directoryToday(),
    hasHistory =
      ["student", "applicant", "alumni"].includes(p.role) ||
      p.enrollments.length > 0;
  const hasSections =
    p.contact !== null ||
    p.student !== null ||
    hasHistory ||
    p.children.length > 0 ||
    p.siblings.length > 0 ||
    p.role === "teacher" ||
    p.role === "parent";
  return (
    <div className="directory-detail space-y-6">
      <header className="directory-detail-header">
        <span className="summary-icon directory-detail-icon shrink-0">
          <UserRound aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Detail pengguna</p>
          <h1 className="directory-detail-name">{p.name}</h1>
          <p className="mt-2 text-muted-foreground">
            @{p.username} · {directoryRoleLabel(p.role)}
          </p>
        </div>
        <span
          className={`directory-status directory-detail-status ${p.status === "active" ? "directory-status-active" : ""}`}
        >
          <ShieldCheck aria-hidden="true" />
          <span>{p.status === "active" ? "Aktif" : "Nonaktif"}</span>
        </span>
      </header>
      <div className="directory-detail-grid">
        {p.contact ? (
          <section
            aria-labelledby="detail-contact"
            className="directory-detail-section"
          >
            <h2 id="detail-contact">Kontak dan profil</h2>
            <dl className="directory-contact-grid">
              <div>
                <dt>Nomor HP</dt>
                <dd>
                  {p.contact.phone?.trim() ? p.contact.phone : "Belum diisi"}
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  {p.contact.email?.trim() ? p.contact.email : "Belum diisi"}
                </dd>
              </div>
            </dl>
            <p className="mt-4 whitespace-pre-wrap text-sm">
              {p.contact.bio.trim()
                ? p.contact.bio
                : "Belum ada keterangan profil."}
            </p>
          </section>
        ) : null}
        {p.student !== null ? (
          <section
            aria-labelledby="detail-biodata"
            className="directory-detail-section"
          >
            <h2 id="detail-biodata">Biodata dan dokumen</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Lihat data dan dokumen pengguna sesuai izin akun Anda.
            </p>
            <Button asChild variant="outline">
              <Link prefetch={false} href={`/account/biodata/${p.id}`}>
                Buka biodata dan dokumen sesuai izin
              </Link>
            </Button>
          </section>
        ) : null}
        {hasHistory ? (
          <section
            aria-labelledby="detail-history"
            className="directory-detail-section"
          >
            <h2 id="detail-history">Riwayat kelas</h2>
            {p.enrollments.length ? (
              <ul className="directory-detail-list">
                {p.enrollments.map((e) => (
                  <li key={e.id}>
                    <p className="font-medium">
                      {e.class_name} · {e.year}/{e.year + 1}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Mulai <DateValue value={e.starts_on} /> ·{" "}
                      {e.ended_at ? "Penempatan berakhir" : "Aktif"}
                    </p>
                    {e.ended_at ? (
                      <p className="text-sm text-muted-foreground">
                        Berakhir <DateValue value={e.ended_at} />
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Belum ada riwayat kelas yang dapat ditampilkan.
              </p>
            )}
          </section>
        ) : null}
        {p.children.length > 0 || p.role === "parent" ? (
          <section
            aria-labelledby="detail-children"
            className="directory-detail-section"
          >
            <h2 id="detail-children">Anak terhubung</h2>
            {p.children.length ? (
              <ul className="directory-detail-list">
                {p.children.map((c) => (
                  <li key={`${c.id}-${c.relationship}`}>
                    <Link
                      prefetch={false}
                      href={`/account/directory/${c.id}`}
                      className="directory-related-link"
                    >
                      {c.name} (@{c.username})
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {(
                        {
                          father: "Ayah",
                          mother: "Ibu",
                          guardian: "Wali",
                        } as Record<string, string>
                      )[c.relationship] ?? c.relationship}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Tidak ada anak terhubung yang dapat ditampilkan.
              </p>
            )}
          </section>
        ) : null}
        {p.siblings.length > 0 ? (
          <section
            aria-labelledby="detail-siblings"
            className="directory-detail-section"
          >
            <h2 id="detail-siblings">Saudara yang dapat diakses</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Anggota grup keluarga yang telah diverifikasi sesuai izin Anda.
            </p>
            <ul className="directory-detail-list">
              {p.siblings.map((s) => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {p.role === "teacher" ? (
          <>
            <section
              aria-labelledby="detail-assignments"
              className="directory-detail-section"
            >
              <h2 id="detail-assignments">Tugas tambahan dan wali kelas</h2>
              <p className="text-sm">
                Wali kelas:{" "}
                {p.homerooms.map((c) => c.name).join(", ") ||
                  "Belum ditetapkan"}
              </p>
              {p.assignments.length ? (
                <ul className="directory-detail-list mt-4">
                  {p.assignments.map((a, i) => (
                    <li key={`${a.code}-${i}`}>
                      <p className="font-medium">{assignmentLabel(a.code)}</p>
                      <p className="directory-assignment-state">
                        {directoryAssignmentState(a, today)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        <DateValue value={a.valid_from} /> –{" "}
                        {a.valid_until ? (
                          <DateValue value={a.valid_until} />
                        ) : (
                          "Tanpa batas tanggal"
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Belum ada tugas tambahan.
                </p>
              )}
            </section>
            <section
              aria-labelledby="detail-schedule"
              className="directory-detail-section"
            >
              <h2 id="detail-schedule">Jadwal tahun ajaran aktif</h2>
              {p.lessons.length ? (
                <ul className="directory-detail-list">
                  {p.lessons.map((l) => (
                    <li key={l.id}>
                      <p className="font-medium">
                        {weekdays[l.weekday]} · {clock(l.start_minute)}–
                        {clock(l.end_minute)}
                      </p>
                      <p className="mt-1 text-sm">
                        {l.class_name} · {l.subject}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {l.jtm} JTM + istirahat {l.break_minutes} menit
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tidak ada jadwal aktif yang dapat ditampilkan.
                </p>
              )}
            </section>
          </>
        ) : null}
      </div>
      {!hasSections && (
        <Status>
          Informasi tambahan tidak tersedia dalam cakupan akses akun Anda.
        </Status>
      )}
    </div>
  );
}
