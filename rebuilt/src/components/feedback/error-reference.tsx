import { errorDigest } from "@/lib/observability/reference";
export function ErrorReference({ digest }: { digest: unknown }) {
  const reference = errorDigest(digest);
  return reference ? (
    <p className="min-w-0 text-sm text-muted-foreground">
      Kode laporan: <code className="break-all font-medium">{reference}</code>.
      Sertakan kode ini saat menghubungi pengelola.
    </p>
  ) : null;
}
