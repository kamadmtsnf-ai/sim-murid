import { NextResponse } from "next/server";
import { appConfig } from "@/config/app";

/** Liveness saja. Tidak mengklaim kesiapan database/layanan yang belum dipasang. */
export function GET() {
  return NextResponse.json(
    { status: "ok", application: "sim-murid", stage: appConfig.foundationStage, scope: "liveness" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
