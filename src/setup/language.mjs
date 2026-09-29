/**
 * The language of the files `setup` writes into the target project. The kit
 * itself is in English; the generated docs, workflow comments and AGENTS.md
 * snippet follow the project (`language` in the answers, saved in the config).
 */

export const LANGUAGES = ['en', 'pt-BR'];

export function languageOf(config) {
  return LANGUAGES.includes(config?.language) ? config.language : 'en';
}

/** The language an existing screen map was written in, read from its table header. */
export function mapLanguage(markdown) {
  return /^\|\s*Arquivo\s*\|/im.test(markdown) ? 'pt-BR' : 'en';
}
