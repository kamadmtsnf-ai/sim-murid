export type InstallPlatform = "android" | "ios" | "desktop";
export function installPlatform(
  userAgent: string,
  touchPoints = 0,
): InstallPlatform {
  if (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && touchPoints > 1)
  )
    return "ios";
  return /Android/i.test(userAgent) ? "android" : "desktop";
}
export const installInstructions: Record<InstallPlatform, readonly string[]> = {
  android: [
    "Buka situs ini melalui Chrome atau Edge.",
    "Tekan Instal aplikasi jika tersedia, atau buka menu browser → Instal aplikasi / Tambahkan ke layar utama.",
    "Tutup tab ini, buka SiM-Murid melalui ikon perangkat, lalu masuk ke akun Anda.",
  ],
  ios: [
    "Buka situs ini melalui Safari di iPhone atau iPad.",
    "Pilih Bagikan → Tambahkan ke Layar Utama. Aktifkan Buka sebagai App jika tersedia, lalu pilih Tambah.",
    "Buka SiM-Murid dari ikon Layar Utama, lalu masuk ke akun Anda.",
  ],
  desktop: [
    "Buka situs ini melalui Chrome atau Edge di komputer.",
    "Tekan Instal aplikasi jika tersedia, atau gunakan ikon pemasangan di bilah alamat/menu browser.",
    "Buka SiM-Murid dari ikon aplikasi di komputer, lalu masuk ke akun Anda.",
  ],
};
