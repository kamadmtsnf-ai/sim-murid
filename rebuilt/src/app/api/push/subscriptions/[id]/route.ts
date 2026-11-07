import { type NextRequest } from "next/server";
import { pushApi } from "@/lib/push/api";
export const runtime = "nodejs";
export async function DELETE(request: NextRequest, context: {
    params: Promise<{
        id: string;
    }>;
}) { return pushApi(request, "revoke", (await context.params).id); }
