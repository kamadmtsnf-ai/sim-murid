import { rules, type Biodata } from "./validation.ts";
export const biodataSections = [
  ["student", "Data siswa"],
  ["father", "Ayah"],
  ["mother", "Ibu"],
  ["guardian", "Wali"],
  ["address", "Alamat siswa"],
  ["documents", "Dokumen"],
] as const;
export function fieldSection(field: string) {
  return field.startsWith("Ayah")
    ? "father"
    : field.startsWith("Ibu")
      ? "mother"
      : field.startsWith("Wali")
        ? "guardian"
        : field.startsWith("Siswa")
          ? "address"
          : "student";
}
export const fieldLabel = (field: string) =>
  field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/No HP/g, "No. HP");
export function fieldVisible(field: string, data: Biodata) {
  if (field.startsWith("Ayah") && rules.fatherAddress.includes(field))
    return (
      data.AyahStatus === "Masih Hidup" &&
      data.AyahAlamatTinggalLuarNegeri !== true
    );
  if (field === "AyahAlamatTinggalLuarNegeri")
    return data.AyahStatus === "Masih Hidup";
  if (field.startsWith("Ibu") && rules.motherAddress.includes(field))
    return (
      data.IbuStatus === "Masih Hidup" &&
      data.IbuAlamatTinggalLuarNegeri !== true &&
      data.IbuAlamatSamadenganAyah !== true
    );
  if (["IbuAlamatTinggalLuarNegeri", "IbuAlamatSamadenganAyah"].includes(field))
    return data.IbuStatus === "Masih Hidup";
  if (field.startsWith("Wali") && field !== "WaliPilihan") {
    if (data.WaliPilihan !== "Lainnya") return false;
    if (rules.guardianAddress.includes(field))
      return (
        data.WaliAlamatStatus === "Lainnya" &&
        data.WaliAlamatTinggalLuarNegeri !== true
      );
    if (field === "WaliAlamatTinggalLuarNegeri")
      return data.WaliAlamatStatus === "Lainnya";
  }
  return true;
}
