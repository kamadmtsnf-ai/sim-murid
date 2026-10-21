import {z} from "zod";
const strings = z.array(z.string().max(4000)).max(30);
export const analysisSchema = z
  .object({
    ringkasan_umum: z.string().max(10000),
    tema_positif: strings,
    tema_perlu_perhatian: strings,
    kutipan_representatif: z
      .array(
        z
          .object({ teks: z.string().max(1500), sentimen: z.string().max(50) })
          .strict(),
      )
      .max(10),
    rekomendasi_tindakan: strings,
    skor_sentimen_keseluruhan: z.enum(["positif","campuran","perlu_perhatian"]),
  })
  .strict();
