/** Nearest-rank quantiles; missing observations are never converted into zero. */
export function summarize(values) {
  const sorted = values.filter(v => typeof v === 'number' && Number.isFinite(v) && v >= 0).sort((a,b) => a-b);
  return {samples: sorted.length, missing: values.length-sorted.length, p75: sorted.length ? sorted[Math.ceil(sorted.length*.75)-1] : null};
}
