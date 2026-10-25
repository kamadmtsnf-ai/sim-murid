export function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(Error("Berkas belum dapat dibaca."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}
