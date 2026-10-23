import "server-only";
import nodemailer from "nodemailer";
import { z } from "zod";
import { createAuthAdmin } from "@/lib/auth/admin";
import { emailEnvironment } from "@/lib/email/gmail";
import { gmailTransportOptions } from "@/lib/email/gmail-config";
export async function dispatchDelivery() {
  const admin = createAuthAdmin(),
    r = await admin.rpc("app_delivery_worker", { p_action: "claim" });
  if (r.error) throw new Error("Unavailable");
  const parsedClaim = z
    .object({
      code: z.enum(["claimed", "empty"]),
      delivery: z
        .object({
          id: z.uuid(),
          channel: z.enum(["email", "whatsapp"]),
          idempotency_key: z.string(),
          payload: z.object({
            email: z.email().optional(),
            phone: z.string().optional(),
            title: z.string(),
            message: z.string(),
          }),
        })
        .optional(),
    })
    .safeParse(r.data);
  if (!parsedClaim.success) throw Error("Invalid delivery acknowledgement");
  const claim = parsedClaim.data;
  if (claim.code === "empty")
    return {
      code: "empty" as const,
      message: "Tidak ada pengiriman siap diproses.",
    };
  if (!claim.delivery) throw Error("Invalid delivery claim");
  const d = claim.delivery;
  let status: "sent" | "failed" | "ambiguous" = "ambiguous",
    provider = "";
  try {
    if (d.channel === "whatsapp") {
      const endpoint = process.env.WHATSAPP_API_URL,
        secret = process.env.WHATSAPP_API_KEY;
      if (!endpoint || !secret || !d.payload.phone)
        throw new Error("not_configured");
      const url = new URL(endpoint);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error("invalid_configuration");
      const sent = await fetch(url, {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + secret,
          "Idempotency-Key": d.idempotency_key,
        },
        body: JSON.stringify({
          to: d.payload.phone,
          message: d.payload.message,
        }),
        signal: AbortSignal.timeout(15000),
      });
      status = sent.ok ? "sent" : "failed";
      provider = sent.headers.get("x-request-id") ?? "";
    } else {
      const env = emailEnvironment();
      if (!d.payload.email) throw new Error("not_configured");
      const transport = nodemailer.createTransport(gmailTransportOptions(env));
      try {
        const result = await transport.sendMail({
          from: { name: env.name, address: env.email },
          to: d.payload.email,
          subject: d.payload.title,
          text: d.payload.message,
          disableFileAccess: true,
          disableUrlAccess: true,
        });
        status = result.accepted.length ? "sent" : "failed";
        provider = result.messageId ?? "";
      } finally {
        transport.close();
      }
    }
  } catch (error) {
    const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "",
      message = error instanceof Error ? error.message : "";
    status =
      ["EAUTH", "EENVELOPE", "EMESSAGE"].includes(code) ||
      ["not_configured", "invalid_configuration"].includes(message) ||
      error instanceof z.ZodError
        ? "failed"
        : "ambiguous";
  }
  const complete = await admin.rpc("app_delivery_worker", {
    p_action: "complete",
    p_id: d.id,
    p_status: status,
    p_provider: provider,
  });
  if (
    complete.error ||
    !z.object({ code: z.literal("saved") }).safeParse(complete.data).success
  )
    return {
      code: "unconfirmed" as const,
      message: "Hasil provider belum tercatat; jangan mengulang otomatis.",
    };
  return {
    code: status,
    message:
      status === "sent"
        ? "Pengiriman diterima penyedia; bukan bukti penerimaan inbox/perangkat."
        : status === "ambiguous"
          ? "Hasil pengiriman ambigu; tidak diulang otomatis."
          : "Pengiriman gagal atau belum dikonfigurasi; retry dengan backoff tersedia.",
  };
}

/** Preserve the scheduled worker response contract. */
export async function dispatchOne() {
  return (await dispatchDelivery()).message;
}
