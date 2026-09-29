/**
 * What fails a screen opened in the browser. Takes what the page left behind
 * (console, exceptions, responses, text) and returns the problems, each with a
 * kind and a detail. An empty list means the screen passed.
 */

const HYDRATION = /hydrat|did not match|server rendered HTML|Minified React error #(418|423|425)\b/i;

/**
 * The browser logs every failed resource as a console error. Third-party ones
 * (analytics, pixel) are not the screen's problem; the site's own already fail
 * through the response.
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
    .map(({ text }) => problem(HYDRATION.test(text) ? 'hydration' : 'console', text));
}

function pageErrorProblems(pageErrors) {
  return pageErrors.map((message) => problem(HYDRATION.test(message) ? 'hydration' : 'exception', message));
}

function responseProblems(responses, origin) {
  return responses.filter(({ url, status }) => status >= 400 && isOwnAsset(url, origin)).map(({ url, status }) => problem('asset', `${status} ${url}`));
}

/**
 * @param {{ origin: string, consoleErrors: { text: string }[], pageErrors: string[],
 *   responses: { url: string, status: number }[], text: string, navigationError?: string | null }} page
 */
export function evaluatePage(page) {
  if (page.navigationError) return [problem('navigation', page.navigationError)];
  const problems = [...pageErrorProblems(page.pageErrors), ...consoleProblems(page.consoleErrors), ...responseProblems(page.responses, page.origin)];
  if (page.text.trim() === '') problems.push(problem('empty text', 'the page opened with no visible text'));
  return problems;
}
