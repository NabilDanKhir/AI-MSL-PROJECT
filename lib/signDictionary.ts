export type SignType = "subject" | "action" | "state" | "auxiliary" | "modifier" | "noun";

export type SignEntry = {
  malay: string;
  english: string;
  type: SignType;
};

export const SIGN_DICT: Record<string, SignEntry> = {
  Saya: { malay: "saya", english: "I", type: "subject" },
  Makan: { malay: "makan", english: "eat", type: "action" },
  Minum: { malay: "minum", english: "drink", type: "action" },
  Mahu: { malay: "mahu", english: "want", type: "auxiliary" },
  Demam: { malay: "demam", english: "fever", type: "state" },
  Baik: { malay: "baik", english: "fine/good", type: "state" },
  "Tak Baik": { malay: "tidak baik", english: "not well/not good", type: "state" },
  Senyap: { malay: "senyap", english: "quiet", type: "state" },
  Waktu: { malay: "masa", english: "time", type: "noun" },
};
