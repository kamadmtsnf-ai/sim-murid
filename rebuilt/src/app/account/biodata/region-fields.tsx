"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import type { Biodata } from "@/lib/student/validation";

const baseUrl = "https://www.emsifa.com/api-wilayah-indonesia/v2/";
const responseSchema = z.object({
  data: z.array(z.object({
    id: z.string().regex(/^\d{2}(?:\.\d{2}){0,2}(?:\.\d{4})?$/),
    name: z.string().trim().min(1).max(500),
  })),
});
type Regions = z.infer<typeof responseSchema>["data"];
const requests = new Map<string, Promise<Regions>>();
const empty: Regions = [];

function loadRegions(path: string) {
  const cached = requests.get(path);
  if (cached) return cached;
  const request = fetch(baseUrl + path, {
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(10000),
  }).then(async (response) => {
    if (!response.ok) throw new Error("Daftar wilayah tidak tersedia");
    return responseSchema.parse(await response.json()).data;
  }).catch((error: unknown) => {
    requests.delete(path);
    throw error;
  });
  requests.set(path, request);
  return request;
}

function useRegions(path: string | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    path: string;
    attempt: number;
    options?: Regions;
  }>();
  useEffect(() => {
    if (!path) return;
    let active = true;
    void loadRegions(path).then(
      (options) => { if (active) setResult({ path, attempt, options }); },
      () => { if (active) setResult({ path, attempt }); },
    );
    return () => { active = false; };
  }, [path, attempt]);
  const current = result?.path === path && result?.attempt === attempt ? result : undefined;
  return {
    options: current?.options ?? empty,
    loading: !!path && !current,
    failed: !!current && !current.options,
    retry: () => setAttempt((value) => value + 1),
  };
}

const levels = [
  ["Provinsi", "Provinsi"],
  ["Kabupaten", "Kabupaten/Kota"],
  ["Kecamatan", "Kecamatan"],
  ["Kelurahan", "Kelurahan/Desa"],
] as const;

function selected(options: Regions, value: string) {
  return options.find((item) => item.name.toLowerCase() === value.trim().toLowerCase());
}

export function RegionFields({ prefix, data, required, errors, className, onChange }: {
  prefix: string;
  data: Biodata;
  required: string[];
  errors: Record<string, string>;
  className: string;
  onChange: (patch: Biodata) => void;
}) {
  const valueAt = (suffix: string) => String(data[prefix + suffix] ?? "");
  const provinces = useRegions("provinces.json");
  const province = selected(provinces.options, valueAt("Provinsi"));
  const regencies = useRegions(province && `regencies/${province.id}.json`);
  const regency = selected(regencies.options, valueAt("Kabupaten"));
  const districts = useRegions(regency && `districts/${regency.id}.json`);
  const district = selected(districts.options, valueAt("Kecamatan"));
  const villages = useRegions(district && `villages/${district.id}.json`);
  const lists = [
    { level: levels[0], list: provinces, parent: true, parentLabel: "" },
    { level: levels[1], list: regencies, parent: province, parentLabel: "Provinsi" },
    { level: levels[2], list: districts, parent: regency, parentLabel: "Kabupaten/Kota" },
    { level: levels[3], list: villages, parent: district, parentLabel: "Kecamatan" },
  ];

  return lists.map(({ level: [suffix, label], list, parent, parentLabel }, index) => {
    const field = prefix + suffix;
    const { options, loading, failed, retry } = list;
    const saved = valueAt(suffix);
    const match = selected(options, saved);
    const id = "biodata-" + field;
    return (
      <div key={field} className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">
          {label}{required.includes(field) ? " *" : ""}
        </label>
        <select
          id={id}
          className={className}
          value={match?.id ?? (saved ? "saved" : "")}
          disabled={loading || failed || !parent || options.length === 0}
          aria-invalid={!!errors[field]}
          aria-describedby={errors[field] ? "error-" + field : undefined}
          onChange={(event) => {
            const choice = options.find((item) => item.id === event.target.value);
            const patch: Biodata = { [field]: choice?.name ?? "" };
            for (const [child] of levels.slice(index + 1)) patch[prefix + child] = "";
            onChange(patch);
          }}
        >
          <option value="">{loading ? "Memuat wilayah…" : !parent ? `Pilih ${parentLabel} dahulu` : failed ? "Daftar wilayah tidak tersedia" : "Pilih…"}</option>
          {saved && !match && <option value="saved" disabled>{saved}</option>}
          {options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {failed && (
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={retry}>
            Muat ulang {label}
          </Button>
        )}
        {errors[field] && <p id={"error-" + field} className="mt-1 text-sm text-destructive">{errors[field]}</p>}
      </div>
    );
  });
}
