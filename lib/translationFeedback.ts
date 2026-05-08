const STORAGE_KEY = "msl_translation_feedback";

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type TranslationFeedbackRecord = {
  id: string;
  signs: string[];
  generated: {
    malay: string;
    english: string;
  };
  correction: string;
  createdAt: string;
};

export type TranslationFeedbackInput = Omit<TranslationFeedbackRecord, "id" | "createdAt">;

export type TranslationOverride = {
  malay: string;
  english: string;
};

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function createId() {
  return `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadTranslationFeedback(storage?: StorageLike): TranslationFeedbackRecord[] {
  const target = getStorage(storage);
  if (!target) return [];

  try {
    const raw = target.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTranslationFeedback(
  input: TranslationFeedbackInput,
  storage?: StorageLike
): TranslationFeedbackRecord {
  const target = getStorage(storage);
  const record: TranslationFeedbackRecord = {
    ...input,
    signs: [...input.signs],
    correction: input.correction.trim(),
    id: createId(),
    createdAt: new Date().toISOString(),
  };

  if (!target) return record;

  const existing = loadTranslationFeedback(target);
  target.setItem(STORAGE_KEY, JSON.stringify([...existing, record]));
  return record;
}

function signsMatch(left: string[], right: string[]) {
  return left.length === right.length && left.every((sign, index) => sign === right[index]);
}

export function parseTranslationCorrection(correction: string): TranslationOverride | null {
  const [malay, english, ...extra] = correction.split("|").map((part) => part.trim());

  if (extra.length > 0 || !malay || !english) {
    return null;
  }

  return { malay, english };
}

export function findTranslationFeedbackOverride(
  signs: string[],
  storage?: StorageLike
): TranslationOverride | null {
  const records = loadTranslationFeedback(storage);

  for (let index = records.length - 1; index >= 0; index--) {
    const record = records[index];
    if (!signsMatch(record.signs, signs)) continue;

    const override = parseTranslationCorrection(record.correction);
    if (override) return override;
  }

  return null;
}
