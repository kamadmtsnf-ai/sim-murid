/** Advisory identity; structural, cell, permission and domain checks remain mandatory. */
export type TemplateIdentity = { id: string; version: number };
export const userTemplate: TemplateIdentity = { id: "users", version: 1 };
export const bulkTemplate = (domain: "enrollment" | "schedules" | "grades"): TemplateIdentity => ({ id: domain, version: 1 });
export function templateMarker(template: TemplateIdentity) {
  return `SIM-MURID-TEMPLATE|${template.id}|${template.version}`;
}
export function verifyTemplateMarkers(values: unknown[], expected: TemplateIdentity) {
  const markers = values.filter((v): v is string => typeof v === "string" && v.startsWith("SIM-MURID-TEMPLATE|"));
  // Legacy templates still undergo all existing structural and business checks.
  if (markers.length && (markers.length !== 1 || markers[0] !== templateMarker(expected)))
    throw Error("Versi atau jenis template tidak sesuai. Unduh template terbaru.");
}
export function importQuality(count: number, issueRows: readonly number[]) {
  if (!Number.isInteger(count) || count < 1 || count > 100 || issueRows.some(row=>!Number.isInteger(row)||row<2||row>count+1))
    throw new RangeError("Ringkasan pemeriksaan Excel tidak valid.");
  const invalid = new Set(issueRows).size;
  return { count, valid: count - invalid, invalid, percentage: Math.round((count - invalid) * 100 / count) };
}
