/**
 * Debt counted per file and code (tsc error or architecture rule):
 * `{ file: { code: n } }`. Current debt may not exceed the baseline in touched
 * files, and the baseline shrinks when someone fixes something.
 */

export function countByFile(errors) {
  const counts = {};
  for (const { file, code } of errors) {
    counts[file] ??= {};
    counts[file][code] = (counts[file][code] ?? 0) + 1;
  }
  return counts;
}

/** Items in touched files whose (file, code) count exceeds the baseline. */
export function grownItems(errors, baseline, touched) {
  const counts = countByFile(errors.filter((error) => touched.has(error.file)));
  const grown = (file, code) => (counts[file]?.[code] ?? 0) > (baseline[file]?.[code] ?? 0);
  return errors.filter((error) => touched.has(error.file) && grown(error.file, error.code));
}

/** The baseline with touched files shrunk to what is left (it never grows). */
export function shrinkBaseline(baseline, errors, touched) {
  const counts = countByFile(errors);
  const next = { ...baseline };
  for (const file of touched) {
    const kept = Object.entries(baseline[file] ?? {})
      .map(([code, count]) => [code, Math.min(count, counts[file]?.[code] ?? 0)])
      .filter(([, count]) => count > 0);
    if (kept.length > 0) next[file] = Object.fromEntries(kept);
    else delete next[file];
  }
  return next;
}
