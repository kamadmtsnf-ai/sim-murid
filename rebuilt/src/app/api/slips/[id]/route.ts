import type { NextRequest } from "next/server";
import { z } from "zod";
import nodemailer from "nodemailer";
import { educationContext, failure } from "@/lib/education/server";
import { createAuthAdmin } from "@/lib/auth/admin";
import { sameOrigin, privateJson } from "@/lib/auth/http";
import { slipPdf, slipText, htmlEscape, object } from "@/lib/learning/print";
import { emailEnvironment } from "@/lib/email/gmail";
import {
  gmailTransportOptions,
  gmailFailureReason,
} from "@/lib/email/gmail-config";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    const id = z.uuid().parse((await params).id),
      r = await createAuthAdmin().rpc("app_slip_read", {
        p_actor: caller.principal.id,
        p_session: caller.sessionId,
        p_id: id,
      });
    if (r.error) throw new Error("Unavailable");
    if (!r.data) return reply({ message: "Akses ditolak." }, 403);
    if (request.nextUrl.searchParams.get("format") === "pdf")
      return new Response((await slipPdf(r.data)) as BodyInit, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="slip.pdf"',
          "Cache-Control": "no-store",
        },
      });
    if (request.nextUrl.searchParams.get("format") === "html")
      return new Response(
        '<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Slip penarikan</title><body><main style="max-width:60rem;margin:auto;padding:1rem"><h1>Slip penarikan</h1><pre style="font:16px/1.7 sans-serif;white-space:pre-wrap;overflow-wrap:anywhere">' +
          htmlEscape(slipText(r.data)) +
          "</pre></main></body></html>",
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy":
              "default-src 'none'; style-src 'unsafe-inline'",
          },
        },
      );
    return reply({ slip: r.data });
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request))
    return privateJson({ message: "Permintaan ditolak." }, 403);
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Silakan masuk." }, 401);
  try {
    const id = z.uuid().parse((await params).id),
      admin = createAuthAdmin(),
      args = {
        p_actor: caller.principal.id,
        p_session: caller.sessionId,
        p_slip: id,
      };
    const env = emailEnvironment();
    const queued = await admin.rpc("app_slip_delivery", {
      ...args,
      p_action: "queue",
    });
    if (queued.error) throw new Error("Unavailable");
    const q = object(queued.data);
    if (q.code !== "queued")
      return reply({ message: "Slip tidak dapat dikirim." }, 403);
    if (!q.count)
      return reply(
        { message: "Belum ada email Admin/Pengelola yang terverifikasi." },
        409,
      );
    const slip = await admin.rpc("app_slip_read", {
      p_actor: args.p_actor,
      p_session: args.p_session,
      p_id: id,
    });
    if (slip.error || !slip.data) throw new Error("Slip unavailable");
    const attachment = Buffer.from(await slipPdf(slip.data));
    const claimed = await admin.rpc("app_slip_delivery", {
      ...args,
      p_action: "claim",
    });
    if (claimed.error) throw new Error("Claim unavailable");
    const claim = z
      .object({
        code: z.string(),
        id: z.uuid().optional(),
        email: z.email().optional(),
      })
      .parse(claimed.data);
    if (claim.code !== "claimed" || !claim.id || !claim.email)
      return reply({
        message: "Tidak ada pengiriman baru; periksa status slip.",
      });
    let transport: ReturnType<typeof nodemailer.createTransport> | undefined;
    let status: "sent" | "failed" | "ambiguous" = "ambiguous",
      provider = "";
    try {
      transport = nodemailer.createTransport(gmailTransportOptions(env));
      const result = await transport.sendMail({
        from: { name: env.name, address: env.email },
        to: claim.email,
        subject: "Slip penarikan SiM-Murid",
        text: slipText(slip.data),
        attachments: [
          {
            filename: "slip.pdf",
            content: attachment,
          },
        ],
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      if (result.accepted.length) {
        status = "sent";
        provider = result.messageId;
      } else status = "failed";
    } catch (error) {
      status =
        gmailFailureReason(error) === "connection" ? "ambiguous" : "failed";
    } finally {
      transport?.close();
    }
    const completed = await admin.rpc("app_slip_delivery", {
      ...args,
      p_action: "complete",
      p_delivery: claim.id,
      p_status: status,
      p_provider: provider,
    });
    if (
      completed.error ||
      !z.object({ code: z.literal("saved") }).safeParse(completed.data).success
    )
      return reply(
        {
          status: "ambiguous",
          message:
            "Pengiriman diproses, tetapi pencatatan status belum dapat dipastikan. Periksa status slip sebelum mencoba lagi.",
        },
        503,
      );
    return reply({
      message:
        status === "sent"
          ? "Email diterima server Gmail; periksa status pengiriman lainnya."
          : status === "ambiguous"
            ? "Hasil pengiriman belum pasti; tidak diulang otomatis."
            : "Pengiriman gagal; dapat dicoba kembali.",
      status,
    });
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
