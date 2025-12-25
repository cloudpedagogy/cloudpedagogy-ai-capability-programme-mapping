export type DomainKey =
  | "awareness"
  | "coagency"
  | "practice"
  | "ethics"
  | "governance"
  | "reflection";

export type Domain = {
  key: DomainKey;
  name: string;
  short: string;
  prompt: string;
};

export const DOMAINS: Domain[] = [
  {
    key: "awareness",
    name: "Awareness & Orientation",
    short: "Awareness",
    prompt: "Consider current AI awareness, assumptions, and shared understanding in this programme context.",
  },
  {
    key: "coagency",
    name: "Human–AI Co-Agency",
    short: "Co-Agency",
    prompt: "Consider how people will partner with AI systems, maintain agency, and clarify roles and responsibilities.",
  },
  {
    key: "practice",
    name: "Applied Practice & Innovation",
    short: "Practice",
    prompt: "Consider where learners apply AI in authentic practice, experimentation, and improvement—beyond surface tool use.",
  },
  {
    key: "ethics",
    name: "Ethics, Equity & Impact",
    short: "Ethics",
    prompt: "Consider ethical risk, equity, accessibility, bias, and downstream impacts across learners and stakeholders.",
  },
  {
    key: "governance",
    name: "Decision-Making & Governance",
    short: "Governance",
    prompt: "Consider decision ownership, approval processes, safeguards, documentation, and institutional alignment.",
  },
  {
    key: "reflection",
    name: "Reflection, Learning & Renewal",
    short: "Renewal",
    prompt: "Consider how learning is reviewed, improved over time, and supported through reflective practice and feedback loops.",
  },
];
