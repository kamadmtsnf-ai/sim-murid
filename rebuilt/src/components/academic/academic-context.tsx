"use client";
import {
  createContext,
  useCallback,
  useId,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  academicStorageKey,
  parseAcademicSelection,
  academicSelection,
  academicSelectionLabel,
  academicSelectionIssue,
  type AcademicSelection,
  type AcademicCatalog,
} from "@/lib/academic/context";
import {
  academicPeriodForDate,
  formatAcademicYear,
  semesterLabel,
} from "@/lib/academic/period";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import { Field, fieldControlClass } from "@/components/ui/field";

type ContextValue = {
  selection: AcademicSelection | null;
  invalid: boolean;
  persistent: boolean;
  ready: boolean;
  today: string | undefined;
  save: (value: AcademicSelection) => void;
  clear: () => void;
};
const Context = createContext<ContextValue | null>(null);
const changeEvent = "sim-academic-context";
export function AcademicContextProvider({
  username,
  today,
  children,
}: {
  username: string;
  today?: string | undefined;
  children: ReactNode;
}) {
  const key = academicStorageKey(username);
  const [memory, setMemory] = useState<string | null>(null),
    [persistent, setPersistent] = useState(true);
  const subscribe = useCallback(
    (notify: () => void) => {
      const storage = (e: StorageEvent) => {
        if (e.key === key || e.key === null) notify();
      };
      window.addEventListener("storage", storage);
      window.addEventListener(changeEvent, notify);
      return () => {
        window.removeEventListener("storage", storage);
        window.removeEventListener(changeEvent, notify);
      };
    },
    [key],
  );
  const read = useCallback(() => {
    if (!persistent) return memory;
    try {
      return localStorage.getItem(key);
    } catch {
      return memory;
    }
  }, [key, memory, persistent]);
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  function write(value: string | null) {
    setMemory(value);
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      setPersistent(false);
    }
    window.dispatchEvent(new Event(changeEvent));
  }
  return (
    <Context.Provider
      value={{
        selection: parseAcademicSelection(raw),
        invalid: !!raw && !parseAcademicSelection(raw),
        ready,
        persistent,
        today,
        save: (value) => write(JSON.stringify(academicSelection.parse(value))),
        clear: () => write(null),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function clearAcademicPreference(username: string) {
  try {
    localStorage.removeItem(academicStorageKey(username));
    window.dispatchEvent(new Event(changeEvent));
  } catch {
    /* Logout must remain available if storage is blocked. */
  }
}
export function AcademicContextSummary() {
  const c = useContext(Context);
  if (!c?.selection) return null;
  return (
    <p className="academic-context-summary">
      Pilihan akademik tersimpan: {academicSelectionLabel(c.selection)}
      <span className="block text-xs text-muted-foreground">
        Tidak mengubah filter halaman secara otomatis.
      </span>
    </p>
  );
}
/** Explicit transfer: a storage event never changes a module's filters or draft. */
export function AcademicContextBar({
  current,
  catalog,
  onApply,
  disabled = false,
  requiresClass = false,
}: {
  current: {
    year: number | null;
    classId: string | null;
    semester?: number | undefined;
  };
  catalog: AcademicCatalog;
  onApply: (value: AcademicSelection) => void | Promise<void>;
  disabled?: boolean;
  requiresClass?: boolean;
}) {
  const c = useContext(Context),
    lock = useRef(false);
  const semesterId = useId();
  const [choice, setChoice] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  if (!c) return null;
  const sem = Number(
    choice ||
      current.semester ||
      c.selection?.semester ||
      (c.today ? academicPeriodForDate(c.today)?.semester : ""),
  );
  const proposed = academicSelection.safeParse({
    version: 1,
    year: current.year,
    semester: sem,
    classId: current.classId,
  });
  const issue = c.selection
    ? academicSelectionIssue(c.selection, catalog, requiresClass)
    : null;
  const className = current.classId
    ? catalog.classes.find(
        (x) => x.id === current.classId && x.year === current.year,
      )?.name
    : null;
  const canSave =
    proposed.success &&
    !academicSelectionIssue(proposed.data, catalog, requiresClass);
  async function apply() {
    if (!c?.selection || issue || lock.current || disabled) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await onApply(c.selection);
    } catch {
      setMessage(
        "Pilihan belum dapat diterapkan. Data dan isian halaman tetap dipertahankan.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <details className="academic-context-bar">
      <summary className="min-h-11 cursor-pointer py-2 font-medium">
        Konteks akademik halaman:{" "}
        {current.year ? formatAcademicYear(current.year) : "belum dipilih"}
        {current.semester ? ` · ${semesterLabel(current.semester)}` : ""}
        {className ? ` · ${className}` : ""}
      </summary>
      <div className="space-y-3 pt-3">
        <p className="text-sm text-muted-foreground">
          Pilihan tersimpan tidak mengubah filter atau isian hingga Anda
          menerapkannya.{" "}
          {current.semester === undefined
            ? "Semester tidak menyaring halaman ini; pilihan semester berikut hanya untuk lintas halaman."
            : ""}
        </p>
        {current.semester === undefined && (
          <Field id={semesterId} label="Semester pilihan lintas halaman">
            <select
              id={semesterId}
              className={fieldControlClass}
              value={[1, 2].includes(sem) ? String(sem) : ""}
              onChange={(e) => setChoice(e.target.value)}
              disabled={disabled || busy}
            >
              <option value="">Pilih semester</option>
              <option value="1">Ganjil</option>
              <option value="2">Genap</option>
            </select>
          </Field>
        )}
        <p className="text-sm">
          Pilihan tersimpan:{" "}
          {c.selection ? academicSelectionLabel(c.selection) : "belum ada"}
          {c.selection?.classId ? " · kelas tertentu" : ""}
        </p>
        {issue && (
          <p role="status" className="text-sm text-warning">
            {issue}
          </p>
        )}
        {c.invalid && (
          <Status tone="warning">
            Pilihan tersimpan tidak valid dan tidak diterapkan. Hapus pilihan
            lalu simpan ulang.
          </Status>
        )}
        {!c.persistent && (
          <Status tone="warning">
            Penyimpanan perangkat tidak tersedia. Pilihan hanya diingat selama
            ruang kerja ini terbuka.
          </Status>
        )}
        {message && <Status>{message}</Status>}
        <div className="ds-actions">
          <Button
            type="button"
            variant="outline"
            disabled={!c.ready || disabled || busy || !canSave}
            onClick={() => {
              if (proposed.success) {
                c.save(proposed.data);
                setMessage(
                  "Pilihan halaman diingat untuk digunakan pada halaman lain.",
                );
              }
            }}
          >
            Ingat pilihan halaman
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!c.ready || disabled || busy || !c.selection || !!issue}
            onClick={() => void apply()}
          >
            {busy ? "Menerapkan pilihan…" : "Terapkan pilihan tersimpan"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || busy || (!c.selection && !c.invalid)}
            onClick={() => {
              c.clear();
              setMessage("Pilihan tersimpan dihapus. Filter halaman tetap.");
            }}
          >
            Hapus pilihan tersimpan
          </Button>
        </div>
      </div>
    </details>
  );
}
