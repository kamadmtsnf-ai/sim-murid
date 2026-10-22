import type { NextRequest } from "next/server";
import { z } from "zod";
import { loadDirectoryDetail } from "@/lib/education/directory-server";
import { educationContext, failure } from "@/lib/education/server";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { caller, reply } = await educationContext(request);
  if (!caller) return reply({ message: "Sesi tidak berlaku." }, 401);
  try {
    const target = z.uuid().parse((await params).id);
    const detail = await loadDirectoryDetail(
      caller.principal.id,
      caller.sessionId,
      target,
    );
    if (detail === null)
      return reply({ message: "Data tidak tersedia untuk akun Anda." }, 404);
    return reply({ detail: detail.payload });
  } catch (error) {
    const e = failure(error);
    return reply({ message: e.message }, e.status);
  }
}
