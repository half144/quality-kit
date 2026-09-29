/** Minimal glob for the config: `**`, `*`, `?` and `{a,b}`. Paths always use `/`. */

const cache = new Map();

function escape(char) {
  return /[.+^$()|[\]\\]/.test(char) ? `\\${char}` : char;
}

function translate(pattern) {
  let out = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '*' && pattern[index + 1] === '*') {
      const slash = pattern[index + 2] === '/';
      out += slash ? '(?:.*/)?' : '.*';
      index += slash ? 2 : 1;
    } else if (char === '*') out += '[^/]*';
    else if (char === '?') out += '[^/]';
    else if (char === '{') out += '(?:';
    else if (char === '}') out += ')';
    else if (char === ',') out += '|';
    else out += escape(char);
  }
  return out;
}

export function globToRegExp(pattern) {
  if (!cache.has(pattern)) cache.set(pattern, new RegExp(`^${translate(pattern)}$`));
  return cache.get(pattern);
}

export function matchesAny(path, patterns = []) {
  return patterns.some((pattern) => globToRegExp(pattern).test(path));
}
