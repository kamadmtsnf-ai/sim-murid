const childNumbers = Array.from({ length: 12 }, (_, index) => String(index + 1));

const neighborhoodNumbers = Array.from({ length: 13 }, (_, index) => String(index).padStart(3, "0"));

const familyChoices = {
  Pendidikan: ["MI/SD/Sederajat", "MTs/SMP/Sederajat", "MA/SMA/Sederajat", "D1", "D2", "D3", "D4/S1", "S2", "S3", "Tidak Bersekolah"],
  Pekerjaan: [
    "Tidak Bekerja", "Pensiunan", "PNS", "TNI/Polisi", "Guru/Dosen",
    "Pegawai Swasta", "Wiraswasta", "Pengacara/Jaksa/Hakim/Notaris/Sejenisnya",
    "Seniman/Pelukis/Artis/Sejenisnya", "Dokter/Bidan/Perawat/Sejenisnya",
    "Pilot/Pramugara/Pramugari/Sejenisnya", "Pedagang/Peternak", "Nelayan",
    "Buruh (Tani/Pabrik/Bangunan)", "Sopir/Masinis/Kondektur/Sejenisnya", "Politikus", "Lainnya",
  ],
  Penghasilan: [
    "Di bawah Rp800.000", "Rp800.001 - Rp1.200.000", "Rp1.200.001 - Rp1.800.000",
    "Rp1.800.001 - Rp2.500.000", "Rp2.500.001 - Rp3.500.000", "Rp3.500.001 - Rp4.800.000",
    "Rp4.800.001 - Rp6.500.000", "Rp6.500.001 - Rp10.000.000",
    "Rp10.000.001 - Rp20.000.000", "Di atas Rp20.000.000",
  ],
  StatusKepemilikanRumah: ["Milik Sendiri", "Rumah Orang Tua", "Rumah Saudara/Kerabat", "Rumah Dinas", "Sewa/Kontrak", "Lainnya"],
};

export const biodataChoices: Record<string, string[]> = {
  ...Object.fromEntries(
    ["Siswa", "Ayah", "Ibu", "Wali"].flatMap((person) =>
      ["RT", "RW"].map((field) => [person + field, neighborhoodNumbers]),
    ),
  ),
  JumlahSaudara: childNumbers,
  AnakKe: childNumbers,
  Agama: ["Islam", "Protestan", "Katolik", "Hindu", "Buddha", "Konghucu"],
  CitaCita: ["PNS", "TNI/Polisi", "Guru/Dosen", "Politikus", "Wiraswasta", "Seniman/Artis", "Ilmuwan", "Agamawan", "Lainnya"],
  Hobi: ["Olahraga", "Kesenian", "Membaca", "Menulis", "Jalan-jalan", "Lainnya"],
  BiayaSekolah: ["Orang Tua", "Wali/Orang Tua Asuh", "Tanggungan Sendiri", "Lainnya"],
  PraSekolah: ["Pernah TK/RA", "Pernah PAUD", "Tidak Pernah"],
  SiswaJarak: ["Kurang dari 5 KM", "Antara 5 - 10 KM", "Antara 11 - 20 KM", "Antara 21 - 30 KM", "Lebih dari 30 KM"],
  SiswaTransportasi: ["Jalan Kaki", "Sepeda", "Sepeda Listrik", "Sepeda Motor", "Mobil Pribadi", "Antar Jemput Orang Tua/Wali", "Angkutan Umum", "Perahu/Sampan", "Ojek", "Lainnya"],
  SiswaWaktuTempuh: ["Kurang dari 10 Menit", "10 - 19 Menit", "20 - 29 Menit", "30 - 39 Menit", "40 - 59 Menit", "1 - 2 Jam", "Lebih dari 2 Jam"],
  ...Object.fromEntries(
    ["Ayah", "Ibu", "Wali"].flatMap((person) =>
      Object.entries(familyChoices).map(([field, options]) => [person + field, options]),
    ),
  ),
};

export function digitField(field: string) {
  if (field.endsWith("NIK") || field === "NomorKK") return "identity";
  if (field.endsWith("NoHP")) return "phone";
}

// Store the label and detail in the existing text field so saved choices round-trip.
export const otherChoice = "Lainnya";
export const otherChoicePrefix = "Lainnya: ";
export const otherDetailMaxLength = 500 - otherChoicePrefix.length;

export function supportsOtherDetail(field: string) {
  return biodataChoices[field]?.includes(otherChoice) ?? false;
}
