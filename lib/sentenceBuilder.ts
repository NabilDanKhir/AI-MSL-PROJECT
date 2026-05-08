import { SIGN_DICT, type SignEntry } from "./signDictionary";

type SentenceResult = {
  malay: string;
  english: string;
};

function capitalise(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function dedupeConsecutive(signs: string[]) {
  return signs.filter((sign, index) => index === 0 || sign !== signs[index - 1]);
}

function joinMalay(entries: SignEntry[]) {
  return entries.map((entry) => entry.malay).join(" dan ");
}

function joinEnglish(entries: SignEntry[]) {
  return entries.map((entry) => entry.english).join(" and ");
}

export function buildSentence(signs: string[]): SentenceResult {
  const knownSigns = signs.filter((sign) => sign !== "UNKNOWN" && SIGN_DICT[sign]);

  if (knownSigns.length === 0) {
    return { malay: "–", english: "–" };
  }

  const dedupedSigns = dedupeConsecutive(knownSigns);
  const entries = dedupedSigns.map((sign) => ({ sign, entry: SIGN_DICT[sign] }));
  const first = entries[0];
  const subject = first.entry.type === "subject" ? first.entry : null;
  const remaining = subject ? entries.slice(1) : entries;

  const actions = remaining.filter(({ entry }) => entry.type === "action").map(({ entry }) => entry);
  const states = remaining.filter(({ entry }) => entry.type === "state").map(({ entry }) => entry);
  const modifiers = remaining.filter(({ entry }) => entry.type === "modifier").map(({ entry }) => entry);
  const nouns = remaining.filter(({ entry }) => entry.type === "noun").map(({ entry }) => entry);
  const hasMahu = remaining.some(({ sign }) => sign === "Mahu");

  let malay: string;
  let english: string;

  if (subject && remaining.length === 0) {
    malay = subject.malay;
    english = subject.english;
  } else if (subject && actions.length > 0) {
    malay = `${subject.malay} mahu ${joinMalay(actions)}`;
    english = `${subject.english} want to ${joinEnglish(actions)}`;
  } else if (subject && states.length > 0) {
    const onlyTakBaik = states.length === 1 && states[0].malay === SIGN_DICT["Tak Baik"].malay;
    malay = onlyTakBaik
      ? `${subject.malay} ${states[0].malay}`
      : `${subject.malay} rasa ${joinMalay(states)}`;
    english = `${subject.english} ${onlyTakBaik ? states[0].english : `feel ${joinEnglish(states)}`}`;
  } else if (!subject && actions.length > 0) {
    malay = `mahu ${joinMalay(actions)}`;
    english = `want to ${joinEnglish(actions)}`;
  } else if (!subject && states.length > 0) {
    malay = joinMalay(states);
    english = joinEnglish(states);
  } else {
    const fallbackEntries = remaining.map(({ entry }) => entry);
    malay = [...(subject ? [subject.malay] : []), ...fallbackEntries.map((entry) => entry.malay)].join(" ");
    english = [...(subject ? [subject.english] : []), ...fallbackEntries.map((entry) => entry.english)].join(" ");
  }

  if (hasMahu && subject && actions.length === 0 && states.length === 0) {
    malay = `${subject.malay} mahu`;
    english = `${subject.english} want`;
  }

  if (!malay.trim() && (modifiers.length > 0 || nouns.length > 0)) {
    malay = [...modifiers, ...nouns].map((entry) => entry.malay).join(" ");
    english = [...modifiers, ...nouns].map((entry) => entry.english).join(" ");
  }

  return {
    malay: capitalise(malay),
    english: capitalise(english),
  };
}
