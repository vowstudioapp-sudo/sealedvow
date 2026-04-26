export const OCCASION_OPENING_LINES = {
  anniversary: "Time remembers what words often cannot.",

  birthday: "Today is not just a celebration of time — but of you.",
  apology: "Some words take time before they find the courage to be said.",
  "just-because": "Not every feeling needs a reason to exist.",
  "thank-you": "Some gratitude deserves more than silence.",
  eid: "May this moment carry more than just celebration.",
} as const;

export type OccasionType = keyof typeof OCCASION_OPENING_LINES;
