/**
 * O que reprova uma tela aberta no navegador. Recebe o que a página deixou
 * (console, exceções, respostas, texto) e devolve os problemas, cada um com o
 * tipo e o detalhe. Lista vazia é tela aprovada.
 */

const HYDRATION = /hydrat|did not match|server rendered HTML|Minified React error #(418|423|425)\b/i;

/**
 * O navegador loga todo recurso que falhou como erro de console. O de fora
 * (analytics, pixel) não é da tela; o próprio já reprova pela resposta.
 */
const FAILED_RESOURCE = /^Failed to load resource\b/;

function problem(kind, detail) {
  return { kind, detail };
}

function isOwnAsset(url, origin) {
  return url.startsWith(`${origin}/`) || url === origin;
}

function consoleProblems(consoleErrors) {
  return consoleErrors
    .filter(({ text }) => !FAILED_RESOURCE.test(text))
    .map(({ text }) => problem(HYDRATION.test(text) ? 'hidratação' : 'console', text));
}

function pageErrorProblems(pageErrors) {
  return pageErrors.map((message) => problem(HYDRATION.test(message) ? 'hidratação' : 'exceção', message));
}

function responseProblems(responses, origin) {
  return responses.filter(({ url, status }) => status >= 400 && isOwnAsset(url, origin)).map(({ url, status }) => problem('asset', `${status} ${url}`));
}

/**
 * @param {{ origin: string, consoleErrors: { text: string }[], pageErrors: string[],
 *   responses: { url: string, status: number }[], text: string, navigationError?: string | null }} page
 */
export function evaluatePage(page) {
  if (page.navigationError) return [problem('navegação', page.navigationError)];
  const problems = [...pageErrorProblems(page.pageErrors), ...consoleProblems(page.consoleErrors), ...responseProblems(page.responses, page.origin)];
  if (page.text.trim() === '') problems.push(problem('texto vazio', 'a página abriu sem nenhum texto visível'));
  return problems;
}
