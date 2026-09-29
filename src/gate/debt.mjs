/**
 * Dívida contada por arquivo e código (erro do tsc ou regra de arquitetura):
 * `{ arquivo: { código: n } }`. A de agora não passa da baseline nos arquivos
 * tocados, e a baseline encolhe quando alguém conserta.
 */

export function countByFile(errors) {
  const counts = {};
  for (const { file, code } of errors) {
    counts[file] ??= {};
    counts[file][code] = (counts[file][code] ?? 0) + 1;
  }
  return counts;
}

/** Os itens dos arquivos tocados em (arquivo, código) que passaram da baseline. */
export function grownItems(errors, baseline, touched) {
  const counts = countByFile(errors.filter((error) => touched.has(error.file)));
  const grown = (file, code) => (counts[file]?.[code] ?? 0) > (baseline[file]?.[code] ?? 0);
  return errors.filter((error) => touched.has(error.file) && grown(error.file, error.code));
}

/** A baseline com os arquivos tocados encolhidos para o que sobrou (nunca cresce). */
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
