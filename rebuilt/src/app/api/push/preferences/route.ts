import { type NextRequest } from "next/server";
import { pushApi } from "@/lib/push/api";
export const runtime = "nodejs";
export async function GET(request: NextRequest) { return pushApi(request, "preferences"); }
export async function PATCH(request: NextRequest) { return pushApi(request, "preferences"); }
