/** Explicit logout clears survey drafts from every module without touching other preferences. */
export function clearSurveyDrafts(storage?: Storage) {
  try {
    const source = storage ?? window.localStorage;
    const keys = Array.from({ length: source.length }, (_, i) => source.key(i));
    for (const key of keys)
      if (key?.startsWith("sim-survey:")) source.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
