export const STARTER_NAMES = ["Atlas", "Orion", "Vega", "Lumen", "Axiom"];

export const PERSONALITIES = [
  {
    id: "professional",
    label: "Professional & Sophisticated",
    description: "Polished, precise, and composed."
  },
  {
    id: "friendly",
    label: "Friendly & Conversational",
    description: "Warm, approachable, and easy to talk to."
  },
  {
    id: "calm",
    label: "Calm & Supportive",
    description: "Gentle, reassuring, and patient."
  },
  {
    id: "witty",
    label: "Witty & Humorous",
    description: "Clever and lighthearted with tasteful humor."
  },
  {
    id: "technical",
    label: "Technical & Analytical",
    description: "Precise, logical, and detail-oriented."
  }
];

export const PERSONALITY_LABEL = (id) =>
  PERSONALITIES.find((p) => p.id === id)?.label || "Friendly & Conversational";