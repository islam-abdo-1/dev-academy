const TASHKEEL_PATTERN = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(TASHKEEL_PATTERN, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ئ/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

function compactCode(value) {
  return normalizeText(value).replace(/[\s-]+/g, "");
}

function tokenVariants(token) {
  const variants = [token];
  if (token.startsWith("ال") && token.length > 3) variants.push(token.slice(2));
  return variants;
}

function acronymOf(words) {
  if (!words.length) return "";
  return words.map((word) => word[0]).join("");
}

function scoreToken(subject, token) {
  let best = 0;
  const bump = (value) => {
    if (value > best) best = value;
  };

  const code = compactCode(subject.code);
  const compactToken = token.replace(/[\s-]+/g, "");
  if (code && compactToken) {
    if (code === compactToken) bump(130);
    else if (compactToken.length >= 2 && code.startsWith(compactToken)) bump(110);
    else if (compactToken.length >= 3 && code.includes(compactToken)) bump(60);
  }

  const name = normalizeText(subject.name);
  const english = normalizeText(subject.english_name) || (/[a-z]/.test(name) ? name : "");
  const englishWords = english ? english.split(" ").filter(Boolean) : [];
  if (english) {
    if (english === token) bump(120);
    const acronym = acronymOf(englishWords);
    if (token.length >= 2 && token === acronym) bump(115);
    else if (token.length >= 2 && acronym.startsWith(token)) bump(95);
    if (englishWords.some((word) => word.startsWith(token))) bump(90);
    if (english.includes(token)) bump(token.length >= 3 ? 70 : 35);
  }

  const nameWords = name ? name.split(" ").filter(Boolean) : [];
  if (name) {
    let prefixHit = false;
    for (const variant of tokenVariants(token)) {
      if (nameWords.some((word) => word.startsWith(variant))) {
        prefixHit = true;
        break;
      }
    }
    if (prefixHit) bump(85);
    if (name.includes(token)) bump(token.length >= 3 ? 55 : 30);
  }

  const tags = (subject.tags || [])
    .map((tag) => normalizeText(tag))
    .filter(Boolean);
  if (tags.some((tag) => tag === token)) bump(80);
  else if (tags.some((tag) => tag.startsWith(token))) bump(75);
  else if (tags.some((tag) => tag.includes(token))) bump(45);

  const description = normalizeText(subject.description);
  if (description.includes(token)) bump(token.length >= 3 ? 25 : 10);

  return best;
}

export function searchSubjects(subjects, query) {
  const normalized = normalizeText(query);
  if (!normalized) return subjects;
  const tokens = normalized.split(" ").filter(Boolean);
  const scored = [];
  for (const subject of subjects) {
    let total = 0;
    let matchedAll = true;
    for (const token of tokens) {
      const score = scoreToken(subject, token);
      if (score <= 0) {
        matchedAll = false;
        break;
      }
      total += score;
    }
    if (matchedAll) scored.push({ subject, score: total });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      String(a.subject.name || "").localeCompare(String(b.subject.name || ""), "ar"),
  );
  return scored.map((entry) => entry.subject);
}

export function searchResources(resources, query) {
  const normalized = normalizeText(query);
  if (!normalized) return resources;
  const tokens = normalized.split(" ").filter(Boolean);
  const scored = [];
  for (const resource of resources) {
    const fields = [
      normalizeText(resource.title),
      normalizeText(resource.description),
      normalizeText(resource.type),
    ].filter(Boolean);
    let total = 0;
    let matchedAll = true;
    for (const token of tokens) {
      let best = 0;
      for (const field of fields) {
        if (field === token) best = Math.max(best, 100);
        else if (field.split(" ").some((word) => word.startsWith(token)))
          best = Math.max(best, 80);
        else if (field.includes(token)) best = Math.max(best, 40);
      }
      if (best <= 0) {
        matchedAll = false;
        break;
      }
      total += best;
    }
    if (matchedAll) scored.push({ resource, score: total });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.resource);
}
