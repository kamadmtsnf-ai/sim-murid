export function reconcile(
  source: unknown,
  target: unknown,
): {
  status: string;
  issues: string[];
  findings: unknown[];
  sourceHash: string;
  limitations: string[];
};
