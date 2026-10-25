import { createRoot } from "react-dom/client";
import { BulkImport } from "../../src/components/bulk/bulk-import";

import type { BulkDomain } from "../../src/lib/bulk/validation";
const domain = (new URLSearchParams(location.search).get("domain") ??
  "enrollment") as BulkDomain;
const id = "00000000-0000-4000-8000-000000000001";
Object.assign(window, {
  bulkDone: 0,
  unmountBulk: () => root.unmount(),
});
const root = createRoot(document.getElementById("root")!);
root.render(
  <main id="main-content" className="mx-auto max-w-5xl space-y-6 p-4">
    <h1 className="text-3xl font-semibold">Input massal</h1>
    <BulkImport
      domain={domain}
      classes={[{ id, label: "7A · 2026/2027" }]}
      {...(domain === "grades"
        ? { subjectId: id, subjectLabel: "IPS", semester: 1 as const }
        : {})}
      onFinished={() => {
        Object.assign(window, { bulkDone: 1 });
      }}
    />
  </main>,
);
