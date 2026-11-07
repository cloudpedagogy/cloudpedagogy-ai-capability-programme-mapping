import { DOMAINS } from "./content/domains";
import type { DomainKey } from "./content/domains";
import {
  LIMITATIONS_TEXT,
  PRIVACY_TEXT,
  PURPOSE_TEXT,
} from "./content/framing";

export type MapItemType = "Module" | "Activity" | "Assessment";

export type ItemWeight = "Low" | "Medium" | "High";

export const WEIGHT_MAP: Record<ItemWeight, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
};

export type MapItem = {
  id: string;
  type: MapItemType;
  name: string;
  notes: string;
  weight: ItemWeight;
  domains: Record<DomainKey, boolean>;
};

export type ProgrammeDetails = {
  programmeTitle: string;
  awardLevel: string;
  department: string;
  institution: string;
  mappingDate: string; // YYYY-MM-DD
  version: string;
  aiInvolvement?: string;
  assumptions?: string;
  risks?: string;
  rationale?: string;
  reviewNotes?: string;
};

export type ExportPayload = {
  tool: string;
  exportedAt: string; // ISO datetime
  programme: ProgrammeDetails;
  items: MapItem[];
  analytics?: {
    totalItems: number;
    weightedCoverage: Record<DomainKey, number>;
  };
};

export const STORAGE_KEY = "cloudpedagogy_programme_mapping_v1";

/** Fix pluralisation in Markdown export (Activity → Activities). */
export const PLURAL_LABELS: Record<MapItemType, string> = {
  Module: "Modules",
  Activity: "Activities",
  Assessment: "Assessments",
};

/**
 * Safe UUID generator for wider browser support.
 */
export function safeUUID(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function emptyDomains(): Record<DomainKey, boolean> {
  return {
    awareness: false,
    coagency: false,
    practice: false,
    ethics: false,
    governance: false,
    reflection: false,
  };
}

export function newItem(type: MapItemType): MapItem {
  const id = safeUUID();
  return { id, type, name: "", notes: "", weight: "Medium", domains: emptyDomains() };
}

export function todayISODate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function defaultProgrammeDetails(): ProgrammeDetails {
  return {
    programmeTitle: "",
    awardLevel: "",
    department: "",
    institution: "",
    mappingDate: todayISODate(),
    version: "v0.1",
  };
}

export function coerceMapItemType(v: unknown): MapItemType {
  if (v === "Module" || v === "Activity" || v === "Assessment") return v;
  return "Module";
}

export function coerceWeight(v: unknown): ItemWeight {
  if (v === "Low" || v === "Medium" || v === "High") return v;
  return "Medium";
}

export function normalizeItems(itemsRaw: unknown): MapItem[] {
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    return [newItem("Module")];
  }

  return itemsRaw.map((raw) => {
    const it = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const rawDomains =
      typeof it.domains === "object" && it.domains !== null
        ? (it.domains as Record<string, unknown>)
        : {};

    const domains = emptyDomains();
    for (const d of DOMAINS) {
      const val = rawDomains[d.key];
      if (typeof val === "boolean") {
        domains[d.key] = val;
      }
    }

    return {
      id: typeof it.id === "string" ? it.id : safeUUID(),
      type: coerceMapItemType(it.type),
      name: typeof it.name === "string" ? it.name : "",
      notes: typeof it.notes === "string" ? it.notes : "",
      weight: coerceWeight(it.weight),
      domains,
    };
  });
}

export function normalizeProgramme(p: unknown): ProgrammeDetails {
  const obj = p && typeof p === "object" ? (p as Record<string, unknown>) : {};
  const base = defaultProgrammeDetails();
  return {
    programmeTitle:
      typeof obj.programmeTitle === "string" ? obj.programmeTitle : base.programmeTitle,
    awardLevel: typeof obj.awardLevel === "string" ? obj.awardLevel : base.awardLevel,
    department: typeof obj.department === "string" ? obj.department : base.department,
    institution: typeof obj.institution === "string" ? obj.institution : base.institution,
    mappingDate: typeof obj.mappingDate === "string" ? obj.mappingDate : base.mappingDate,
    version: typeof obj.version === "string" ? obj.version : base.version,
    aiInvolvement: typeof obj.aiInvolvement === "string" ? obj.aiInvolvement : undefined,
    assumptions: typeof obj.assumptions === "string" ? obj.assumptions : undefined,
    risks: typeof obj.risks === "string" ? obj.risks : undefined,
    rationale: typeof obj.rationale === "string" ? obj.rationale : undefined,
    reviewNotes: typeof obj.reviewNotes === "string" ? obj.reviewNotes : undefined,
  };
}

export function loadState(): { programme: ProgrammeDetails; items: MapItem[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { programme: defaultProgrammeDetails(), items: [newItem("Module")] };

    const parsed = JSON.parse(raw) as { programme?: unknown; items?: unknown };
    return {
      programme: normalizeProgramme(parsed?.programme),
      items: normalizeItems(parsed?.items),
    };
  } catch {
    return { programme: defaultProgrammeDetails(), items: [newItem("Module")] };
  }
}

export function safeSlug(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function escapePipes(s: string): string {
  return s.replace(/\|/g, "\\|");
}

export function buildMarkdown(args: {
  toolName: string;
  exportedAtISO: string;
  programme: ProgrammeDetails;
  items: MapItem[];
  coverage: Record<DomainKey, number>;
  weightedCoverage: Record<DomainKey, number>;
  observations: string[];
}): string {
  const { toolName, exportedAtISO, programme, items, coverage, weightedCoverage, observations } = args;

  const programmeTitle = (programme.programmeTitle || "Programme mapping").trim();
  const mappingDate = (programme.mappingDate || todayISODate()).trim();

  const groups: Record<MapItemType, MapItem[]> = { Module: [], Activity: [], Assessment: [] };
  for (const it of items) groups[it.type].push(it);

  const totalTagged = DOMAINS.reduce((sum, d) => sum + coverage[d.key], 0);

  const md: string[] = [];
  md.push(`# ${programmeTitle}`);
  md.push("");
  md.push(`**Tool:** ${toolName}`);
  md.push(`**Exported:** ${exportedAtISO}`);
  md.push("");

  md.push("## Programme details");
  md.push("");
  md.push(`- **Programme title:** ${programme.programmeTitle?.trim() || "—"}`);
  md.push(`- **Award / level:** ${programme.awardLevel?.trim() || "—"}`);
  md.push(`- **Department / faculty:** ${programme.department?.trim() || "—"}`);
  md.push(`- **Institution:** ${programme.institution?.trim() || "—"}`);
  md.push(`- **Mapping date:** ${mappingDate}`);
  md.push(`- **Version / notes:** ${programme.version?.trim() || "—"}`);
  md.push("");

  md.push("## Purpose and framing");
  md.push("");
  md.push(PURPOSE_TEXT);
  md.push("");
  md.push(PRIVACY_TEXT);
  md.push("");

  md.push("## Coverage intensity snapshot");
  md.push("");
  md.push("| Domain | Tagged items | Intensity score |");
  md.push("|---|---:|---:|");
  for (const d of DOMAINS) {
    md.push(`| ${escapePipes(d.name)} | ${coverage[d.key]} | ${weightedCoverage[d.key]} |`);
  }
  md.push("");

  md.push("## Key observations");
  md.push("");
  for (const line of observations) md.push(`- ${line}`);
  md.push("");

  md.push("## Domain lenses");
  md.push("");
  for (const d of DOMAINS) md.push(`- **${d.name}:** ${d.prompt}`);
  md.push("");

  md.push("## Mapping items (QA-ready view)");
  md.push("");
  md.push(
    "_Items are grouped by type and include domain tags. Treat tags as interpretive lenses for discussion, not performance scores._"
  );
  md.push("");

  const renderType = (type: MapItemType) => {
    const list = groups[type];
    md.push(`### ${PLURAL_LABELS[type]}`);
    md.push("");

    if (list.length === 0) {
      md.push(`_(No ${PLURAL_LABELS[type].toLowerCase()} added.)_`);
      md.push("");
      return;
    }

    md.push("| # | Item | Intensity | Domain tags | Notes |");
    md.push("|---:|---|---|---|---|");

    list.forEach((it, idx) => {
      const name = (it.name || "").trim() || "Untitled";
      const tags = DOMAINS.filter((d) => it.domains[d.key]).map((d) => d.short);
      const notes = (it.notes || "").trim();

      md.push(
        `| ${idx + 1} | ${escapePipes(name)} | ${it.weight} | ${
          tags.length ? escapePipes(tags.join(", ")) : "_None_"
        } | ${notes ? escapePipes(notes) : "_—_"} |`
      );
    });

    md.push("");
  };

  renderType("Module");
  renderType("Activity");
  renderType("Assessment");

  md.push("## Interpretation prompts");
  md.push("");
  md.push(
    `- What does the current pattern of domain tags suggest about the programme’s explicit emphasis? (${items.length} item${
      items.length === 1 ? "" : "s"
    }, ${totalTagged} domain tag${totalTagged === 1 ? "" : "s"})`
  );
  md.push(
    "- Which domains are highly visible because they are easy to describe (or easy to evidence), rather than most important?"
  );
  md.push(
    "- Which domains might be present implicitly but not visible in module/activity/assessment descriptions?"
  );
  md.push("- Where are students required to exercise judgement with AI, not just use tools?");
  md.push("- What governance or ethical risks are “owned” nowhere in the programme design?");
  md.push("- What would it look like to strengthen one underrepresented domain without increasing workload?");
  md.push("");

  md.push("## Use and limitations");
  md.push("");
  md.push(LIMITATIONS_TEXT);
  md.push("");
  md.push(
    "_Next step (optional): paste this export into programme documentation (or QA/review notes), then revisit during review cycles._"
  );
  md.push("");

  return md.join("\n");
}

export function calculateCoverage(items: MapItem[]): Record<DomainKey, number> {
  const counts: Record<DomainKey, number> = {
    awareness: 0,
    coagency: 0,
    practice: 0,
    ethics: 0,
    governance: 0,
    reflection: 0,
  };
  for (const item of items) {
    (Object.keys(item.domains) as DomainKey[]).forEach((k) => {
      if (item.domains[k]) counts[k] += 1;
    });
  }
  return counts;
}

export function calculateWeightedCoverage(items: MapItem[]): Record<DomainKey, number> {
  const density: Record<DomainKey, number> = {
    awareness: 0,
    coagency: 0,
    practice: 0,
    ethics: 0,
    governance: 0,
    reflection: 0,
  };
  for (const item of items) {
    const w = WEIGHT_MAP[item.weight] || 2;
    (Object.keys(item.domains) as DomainKey[]).forEach((k) => {
      if (item.domains[k]) density[k] += w;
    });
  }
  return density;
}

export function generateObservations(
  totalItems: number,
  weightedCoverage: Record<DomainKey, number>
): string[] {
  const lines: string[] = [];

  lines.push(
    `The programme includes ${totalItems} mapped item${totalItems === 1 ? "" : "s"}. ` +
    "Embedding intensity varies across domains based on activity weighting (Low/Medium/High)."
  );

  const totalWeighted = Object.values(weightedCoverage).reduce((a, b) => a + b, 0);
  const avgWeighted = totalWeighted / DOMAINS.length;

  const primaryGaps = DOMAINS.filter((d) => weightedCoverage[d.key] === 0);
  const secondaryGaps = DOMAINS.filter((d) => {
    const val = weightedCoverage[d.key];
    return val > 0 && val < avgWeighted * 0.5;
  });

  if (primaryGaps.length > 0) {
    lines.push(
      `**Primary Gap Detected:** No explicit coverage found for ${primaryGaps.map((d) => d.name).join(", ")}. ` +
      "This indicates these domains are currently unowned or implicit in the curriculum design."
    );
  }

  if (secondaryGaps.length > 0) {
    lines.push(
      `**Secondary Gap Detected:** Relatively low embedding intensity for ${secondaryGaps.map((d) => d.name).join(", ")} ` +
      "(below 50% of the programme average). These domains may benefit from more explicit focus in future review cycles."
    );
  }

  if (totalWeighted > 0 && primaryGaps.length === 0 && secondaryGaps.length === 0) {
    lines.push(
      "Domain coverage appears relatively balanced across the programme, with no stand-out gaps detected based on current weighting."
    );
  }

  return lines;
}
