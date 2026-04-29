import { useEffect, useMemo, useRef, useState } from "react";
import { DOMAINS } from "./content/domains";
import type { DomainKey } from "./content/domains";
import {
  LIMITATIONS_TEXT,
  PRIVACY_TEXT,
  PURPOSE_TEXT,
  SUBTITLE,
  TOOL_NAME,
} from "./content/framing";

type MapItemType = "Module" | "Activity" | "Assessment";

type ItemWeight = "Low" | "Medium" | "High";

const WEIGHT_MAP: Record<ItemWeight, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
};

type MapItem = {
  id: string;
  type: MapItemType;
  name: string;
  notes: string;
  weight: ItemWeight;
  domains: Record<DomainKey, boolean>;
};

type ProgrammeDetails = {
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

type ExportPayload = {
  tool: string;
  exportedAt: string; // ISO datetime
  programme: ProgrammeDetails;
  items: MapItem[];
  analytics?: {
    totalItems: number;
    weightedCoverage: Record<DomainKey, number>;
  };
};

const STORAGE_KEY = "cloudpedagogy_programme_mapping_v1";

/** Fix pluralisation in Markdown export (Activity → Activities). */
const PLURAL_LABELS: Record<MapItemType, string> = {
  Module: "Modules",
  Activity: "Activities",
  Assessment: "Assessments",
};

/**
 * Safe UUID generator for wider browser support.
 */
function safeUUID(): string {
  try {
    const c: any = typeof crypto !== "undefined" ? crypto : undefined;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    // ignore
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function emptyDomains(): Record<DomainKey, boolean> {
  return {
    awareness: false,
    coagency: false,
    practice: false,
    ethics: false,
    governance: false,
    reflection: false,
  };
}

function newItem(type: MapItemType): MapItem {
  const id = safeUUID();
  return { id, type, name: "", notes: "", weight: "Medium", domains: emptyDomains() };
}

function todayISODate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function defaultProgrammeDetails(): ProgrammeDetails {
  return {
    programmeTitle: "",
    awardLevel: "",
    department: "",
    institution: "",
    mappingDate: todayISODate(),
    version: "v0.1",
  };
}

function coerceMapItemType(v: unknown): MapItemType {
  if (v === "Module" || v === "Activity" || v === "Assessment") return v;
  return "Module";
}

function coerceWeight(v: unknown): ItemWeight {
  if (v === "Low" || v === "Medium" || v === "High") return v;
  return "Medium";
}

function normalizeItems(itemsRaw: unknown): MapItem[] {
  const arr = Array.isArray(itemsRaw) ? (itemsRaw as any[]) : [];
  if (arr.length === 0) return [newItem("Module")];

  return arr.map((it) => ({
    id: typeof it?.id === "string" ? it.id : safeUUID(),
    type: coerceMapItemType(it?.type),
    name: typeof it?.name === "string" ? it.name : "",
    notes: typeof it?.notes === "string" ? it.notes : "",
    weight: coerceWeight(it?.weight),
    domains: {
      ...emptyDomains(),
      ...(typeof it?.domains === "object" && it?.domains ? it.domains : {}),
    },
  }));
}

function normalizeProgramme(p: unknown): ProgrammeDetails {
  const obj = p && typeof p === "object" ? (p as any) : {};
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

function loadState(): { programme: ProgrammeDetails; items: MapItem[] } {
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


function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadJSON(filename: string, data: unknown) {
  downloadBlob(
    filename,
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  );
}

function downloadText(filename: string, text: string) {
  downloadBlob(filename, new Blob([text], { type: "text/markdown;charset=utf-8" }));
}

function safeSlug(input: string) {
  return (input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapePipes(s: string) {
  return s.replace(/\|/g, "\\|");
}

function buildMarkdown(args: {
  toolName: string;
  exportedAtISO: string;
  programme: ProgrammeDetails;
  items: MapItem[];
  coverage: Record<DomainKey, number>;
  weightedCoverage: Record<DomainKey, number>;
  observations: string[];
}) {
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

export default function App() {
  const initial = loadState();

  const [programme, setProgramme] = useState<ProgrammeDetails>(initial.programme);
  const [items, setItems] = useState<MapItem[]>(initial.items);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ programme, items }));
  }, [programme, items]);

  const coverage = useMemo(() => {
    const counts: Record<DomainKey, number> = {
      awareness: 0, coagency: 0, practice: 0, ethics: 0, governance: 0, reflection: 0,
    };
    for (const item of items) {
      (Object.keys(item.domains) as DomainKey[]).forEach((k) => {
        if (item.domains[k]) counts[k] += 1;
      });
    }
    return counts;
  }, [items]);

  const weightedCoverage = useMemo(() => {
    const density: Record<DomainKey, number> = {
      awareness: 0, coagency: 0, practice: 0, ethics: 0, governance: 0, reflection: 0,
    };
    for (const item of items) {
      const w = WEIGHT_MAP[item.weight] || 2;
      (Object.keys(item.domains) as DomainKey[]).forEach((k) => {
        if (item.domains[k]) density[k] += w;
      });
    }
    return density;
  }, [items]);

  const observations = useMemo(() => {
    const lines: string[] = [];
    const totalItems = items.length;

    lines.push(
      `The programme includes ${totalItems} mapped item${totalItems === 1 ? "" : "s"}. ` +
      "Embedding intensity varies across domains based on activity weighting (Low/Medium/High)."
    );

    const totalWeighted = Object.values(weightedCoverage).reduce((a, b) => a + b, 0);
    const avgWeighted = totalWeighted / DOMAINS.length;

    const primaryGaps = DOMAINS.filter(d => weightedCoverage[d.key] === 0);
    const secondaryGaps = DOMAINS.filter(d => {
      const val = weightedCoverage[d.key];
      return val > 0 && val < (avgWeighted * 0.5);
    });

    if (primaryGaps.length > 0) {
      lines.push(
        `**Primary Gap Detected:** No explicit coverage found for ${primaryGaps.map(d => d.name).join(", ")}. ` +
        "This indicates these domains are currently unowned or implicit in the curriculum design."
      );
    }

    if (secondaryGaps.length > 0) {
      lines.push(
        `**Secondary Gap Detected:** Relatively low embedding intensity for ${secondaryGaps.map(d => d.name).join(", ")} ` +
        "(below 50% of the programme average). These domains may benefit from more explicit focus in future review cycles."
      );
    }

    if (totalWeighted > 0 && primaryGaps.length === 0 && secondaryGaps.length === 0) {
      lines.push("Domain coverage appears relatively balanced across the programme, with no stand-out gaps detected based on current weighting.");
    }

    return lines;
  }, [weightedCoverage, items.length]);

  const totalItems = items.length;
  const totalDomainTags = useMemo(() => {
    return DOMAINS.reduce((sum, d) => sum + coverage[d.key], 0);
  }, [coverage]);
  const hasAnyTag = totalDomainTags > 0;

  function updateProgramme(patch: Partial<ProgrammeDetails>) {
    setProgramme((prev) => ({ ...prev, ...patch }));
  }

  function updateItem(id: string, patch: Partial<MapItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function toggleDomain(id: string, key: DomainKey) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, domains: { ...it.domains, [key]: !it.domains[key] } } : it
      )
    );
  }

  function addItem(type: MapItemType) {
    setItems((prev) => [...prev, newItem(type)]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  function clearAll() {
    const ok = window.confirm(
      "Clear this mapping?\n\nThis will remove programme details and all items from this browser. You can export first if you want a backup."
    );
    if (!ok) return;
    setProgramme(defaultProgrammeDetails());
    setItems([newItem("Module")]);
  }

  function exportJSON() {
    const payload: ExportPayload = {
      tool: TOOL_NAME,
      exportedAt: new Date().toISOString(),
      programme,
      items,
      analytics: {
        totalItems: items.length,
        weightedCoverage,
      },
    };

    const safeTitle =
      safeSlug(programme.programmeTitle || "programme-mapping") || "programme-mapping";
    const date = programme.mappingDate || todayISODate();
    downloadJSON(`${safeTitle}-${date}.json`, payload);
  }

  function exportMarkdown() {
    const exportedAt = new Date().toISOString();
    const safeTitle =
      safeSlug(programme.programmeTitle || "programme-mapping") || "programme-mapping";
    const date = programme.mappingDate || todayISODate();

    const md = buildMarkdown({
      toolName: TOOL_NAME,
      exportedAtISO: exportedAt,
      programme,
      items,
      coverage,
      weightedCoverage,
      observations,
    });

    downloadText(`${safeTitle}-${date}.md`, md);
  }

  function triggerImport() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(file: File) {
    const text = await file.text();

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      window.alert("That file could not be parsed as JSON.");
      return;
    }

    const nextProgramme = normalizeProgramme(parsed?.programme);
    const nextItems = normalizeItems(parsed?.items);

    if (!Array.isArray(nextItems) || nextItems.length === 0) {
      window.alert("This JSON file does not look like a programme mapping export.");
      return;
    }

    const ok = window.confirm(
      "Import this mapping?\n\nThis will replace your current mapping in this browser. You may want to export first as a backup."
    );
    if (!ok) return;

    setProgramme(nextProgramme);
    setItems(nextItems);
  }

  function onImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";
    void handleImportFile(file);
  }

  return (
    <>
      <header className="tool-header">
        <div className="tool-header-content">
          <a href="https://www.cloudpedagogy.com/" className="brand-link">
            CloudPedagogy
          </a>
          <h1 className="h1">{TOOL_NAME}</h1>
        </div>
      </header>

      <div className="container">
        <div className="stack">
        {/* Header */}
        <div className="card stack">
          <p className="p secondary">{SUBTITLE}</p>

          <div className="badge">
            <span>Saved locally</span>
            <span className="muted">•</span>
            <span>{totalItems} item{totalItems === 1 ? "" : "s"}</span>
            <span className="muted">•</span>
            <span>{totalDomainTags} domain tag{totalDomainTags === 1 ? "" : "s"}</span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <button
              onClick={exportMarkdown}
              className="primary"
              disabled={!hasAnyTag}
              title={!hasAnyTag ? "Add at least one domain tag to enable export." : undefined}
            >
              Export Markdown
            </button>
            <button
              onClick={exportJSON}
              className="secondary"
              disabled={!hasAnyTag}
              title={!hasAnyTag ? "Add at least one domain tag to enable export." : undefined}
            >
              Export JSON
            </button>
            <button onClick={triggerImport} className="secondary">Import JSON</button>
            <button onClick={clearAll} className="secondary">Clear</button>
          </div>

          {!hasAnyTag && (
            <p className="small" style={{ marginTop: 8 }}>
              Add at least one domain tag to enable export.
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={onImportChange}
          />

          <p className="small muted" style={{ marginTop: 10 }}>
            Exports download to your computer. Your in-progress work is saved in your browser automatically. Import a
            file previously exported from this tool.
          </p>
        </div>

        {/* Programme details (collapsed by default) */}
        <div className="card stack">
          <details>
            <summary
              className="h2"
              style={{
                cursor: "pointer",
                listStyle: "none",
              }}
            >
              Programme details (optional){" "}
              <span className="muted" style={{ fontSize: 14 }}>
                — click to expand
              </span>
            </summary>

            <p className="p muted" style={{ marginTop: 10 }}>
              Add minimal context so the mapping can be interpreted later (e.g. during review, QA, or team discussion).
              This information is included in exports.
            </p>

            <div className="row">
              <div className="stack">
                <label>Programme title</label>
                <input
                  type="text"
                  value={programme.programmeTitle}
                  placeholder="e.g. MSc Public Health"
                  onChange={(e) => updateProgramme({ programmeTitle: e.target.value })}
                />
              </div>

              <div className="stack">
                <label>Award / level</label>
                <input
                  type="text"
                  value={programme.awardLevel}
                  placeholder="e.g. MSc / PGCert / UG Year 2"
                  onChange={(e) => updateProgramme({ awardLevel: e.target.value })}
                />
              </div>
            </div>

            <div className="row">
              <div className="stack">
                <label>Department / faculty (optional)</label>
                <input
                  type="text"
                  value={programme.department}
                  placeholder="e.g. Faculty of Public Health"
                  onChange={(e) => updateProgramme({ department: e.target.value })}
                />
              </div>

              <div className="stack">
                <label>Institution (optional)</label>
                <input
                  type="text"
                  value={programme.institution}
                  placeholder="e.g. LSHTM"
                  onChange={(e) => updateProgramme({ institution: e.target.value })}
                />
              </div>
            </div>

            <div className="row">
              <div className="stack">
                <label>Mapping date</label>
                <input
                  type="date"
                  value={programme.mappingDate}
                  onChange={(e) => updateProgramme({ mappingDate: e.target.value })}
                />
              </div>

              <div className="stack">
                <label>Version / notes</label>
                <input
                  type="text"
                  value={programme.version}
                  placeholder="e.g. v0.1 draft / pre-approval / post-review"
                  onChange={(e) => updateProgramme({ version: e.target.value })}
                />
              </div>
            </div>
          </details>
        </div>

        {/* Purpose */}
        <div className="card stack">
          <h2 className="h2">Purpose</h2>
          <p className="p">{PURPOSE_TEXT}</p>
          <p className="small">{PRIVACY_TEXT}</p>
        </div>

        {/* Activity */}
        <div className="card stack">
          <h2 className="h2">Activity</h2>
          <p className="p muted">
            Add modules, activities, and assessments, then tag each item against one or more domains. Use tags as lenses
            for discussion—avoid “perfect mapping”.
          </p>

          <div className="row">
            <div className="stack">
              <div className="badge">Add items</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="primary" onClick={() => addItem("Module")}>
                  + Module
                </button>
                <button className="secondary" onClick={() => addItem("Activity")}>+ Activity</button>
                <button className="secondary" onClick={() => addItem("Assessment")}>+ Assessment</button>
              </div>
              <p className="small muted">
                Tip: keep items granular enough to discuss (e.g. “Research Methods Seminar 2”, “Portfolio”, “Lab practical
                1”).
              </p>
            </div>

            <div className="stack">
              <div className="badge">Domain lenses</div>
              <div className="stack">
                {DOMAINS.map((d) => (
                  <div key={d.key} className="small">
                    <strong>{d.name}:</strong> {d.prompt}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <hr className="sep" />

          <div className="stack">
            {items.map((item, idx) => (
              <div key={item.id} className="card nested stack">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div className="badge">
                    <strong>{idx + 1}.</strong> <span>{item.type}</span>
                  </div>
                  <button className="secondary" onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                    Remove
                  </button>
                </div>

                <div className="row">
                  <div className="stack">
                    <label>Name</label>
                    <input
                      type="text"
                      value={item.name}
                      placeholder={`e.g. ${
                        item.type === "Module"
                          ? "Foundations of..."
                          : item.type === "Activity"
                          ? "Workshop: ..."
                          : "Portfolio / Exam"
                      }`}
                      onChange={(e) => updateItem(item.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="stack">
                    <label>Notes (optional)</label>
                      <textarea
                        value={item.notes}
                        placeholder="e.g. what AI use is expected, what judgement is required, what risks or governance concerns exist…"
                        onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row">
                    <div className="stack-tight">
                      <label>Embedding Intensity</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {(["Low", "Medium", "High"] as ItemWeight[]).map((w) => (
                          <button
                            key={w}
                            className={`tag ${item.weight === w ? "active" : ""}`}
                            onClick={() => updateItem(item.id, { weight: w })}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                      <p className="small muted">
                        Intensity reflects how deeply the capability is embedded (e.g. mention vs evaluation).
                      </p>
                    </div>

                    <div className="stack-tight">
                      <label>Tag domains</label>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {DOMAINS.map((d) => {
                        const active = item.domains[d.key];
                        return (
                          <button
                            key={d.key}
                            onClick={() => toggleDomain(item.id, d.key)}
                            className={`tag ${active ? "active" : ""}`}
                            aria-pressed={active}
                            title={d.name}
                          >
                            {d.short}
                          </button>
                        );
                      })}
                    </div>
                    <p className="small muted">
                      Tags represent <em>meaningful</em> engagement with a domain, not mere mention. Use judgement.
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Output */}
        <div className="card stack">
          <h2 className="h2">Output & Coverage Analysis</h2>
          
          <div className="stack">
            <h3 className="h2" style={{ fontSize: 15 }}>Domain Coverage Heatmap</h3>
            <p className="small muted">Visual matrix of items vs capability domains. Cell intensity reflects embedding weight (Low to High).</p>
            <div style={{ 
              overflowX: "auto", 
              border: "1px solid #E5E7EB", 
              borderRadius: 6,
              background: "#F9FAFB",
              padding: 12
            }}>
              <table style={{ borderCollapse: "collapse", minWidth: 600, width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: 180, textAlign: "left", fontSize: 11, padding: 8, color: "#777" }}>Item</th>
                    {DOMAINS.map(d => (
                      <th key={d.key} title={d.name} style={{ textAlign: "center", fontSize: 11, padding: 8, color: "#777", width: 60 }}>
                        {d.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                      <td style={{ fontSize: 12, padding: 8, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
                        {idx + 1}. {item.name || "Untitled"}
                      </td>
                      {DOMAINS.map(d => {
                        const active = item.domains[d.key];
                        const w = WEIGHT_MAP[item.weight];
                        const opacity = active ? (w === 3 ? 1 : w === 2 ? 0.6 : 0.3) : 0;
                        return (
                          <td key={d.key} style={{ padding: 4 }}>
                            <div style={{ 
                              height: 20, 
                              background: active ? "#111111" : "transparent", 
                              opacity, 
                              borderRadius: 3,
                              border: active ? "1px solid #111111" : "1px dashed #E5E7EB"
                            }} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="row" style={{ marginTop: 24 }}>
            <div className="stack">
              <div className="badge">Coverage intensity</div>
              <div className="stack">
                {DOMAINS.map((d) => {
                  const val = weightedCoverage[d.key];
                  const totalWeighted = Object.values(weightedCoverage).reduce((a, b) => a + b, 0) || 1;
                  const avgWeighted = totalWeighted / DOMAINS.length;
                  const isPrimaryGap = val === 0;
                  const isSecondaryGap = val > 0 && val < (avgWeighted * 0.5);
                  
                  return (
                    <div key={d.key} className="stack-tight">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <span className="small" style={{ fontWeight: 600 }}>{d.name}</span>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {isPrimaryGap && <span className="tag" style={{ background: "#FEE2E2", color: "#B91C1C", borderColor: "#FEE2E2", fontSize: 10 }}>Primary Gap</span>}
                          {isSecondaryGap && <span className="tag" style={{ background: "#FEF3C7", color: "#92400E", borderColor: "#FEF3C7", fontSize: 10 }}>Secondary Gap</span>}
                          <span className="small muted">{val} intensity</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: "#F3F4F6", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ 
                          height: "100%", 
                          width: `${Math.min(100, (val / (Math.max(...Object.values(weightedCoverage)) || 1)) * 100)}%`, 
                          background: isPrimaryGap ? "#E5E7EB" : isSecondaryGap ? "#F59E0B" : "#111111" 
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="stack">
              <div className="badge">Key observations</div>
              <div className="stack">
                {observations.map((line, i) => (
                  <p key={i} className="p muted">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <hr className="sep" />

          <div className="stack">
            <div className="badge">Reflection prompts</div>
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Which domains are heavily represented because they are easy to evidence, rather than most important?</li>
              <li>
                Which domains might be present implicitly but not visible in module/activity/assessment descriptions?
              </li>
              <li>Where are students required to exercise judgement with AI, not just use tools?</li>
              <li>What governance or ethical risks are “owned” nowhere in the programme design?</li>
              <li>What would it look like to strengthen one underrepresented domain without increasing workload?</li>
            </ul>
          </div>
        </div>


        {/* Framing & next steps */}
        <div className="card stack">
          <h2 className="h2">Use and limitations</h2>
          <p className="p">{LIMITATIONS_TEXT}</p>
          <p className="small">
            Next step (optional): export your mapping notes into your programme documentation, then revisit during review
            or QA cycles.
          </p>
        </div>

        {/* Lightweight capability and governance layer */}
        {/* Optional, non-blocking, and does not alter core workflow */}
        <div className="card stack">
          <details>
            <summary className="h2" style={{ cursor: "pointer", listStyle: "none" }}>
              Capability & Governance Notes (Optional) <span className="muted" style={{ fontSize: 14 }}>— click to expand</span>
            </summary>
            
            <p className="p muted" style={{ marginTop: 10 }}>
              Use these optional fields to make AI assumptions, risks, and rationales visible.
            </p>

            <div className="stack" style={{ marginTop: 16 }}>
              <label>AI Involvement</label>
              <textarea
                value={programme.aiInvolvement || ""}
                placeholder="How is AI involved in this process?"
                onChange={(e) => updateProgramme({ aiInvolvement: e.target.value })}
              />
            </div>
            
            <div className="stack">
              <label>Assumptions</label>
              <textarea
                value={programme.assumptions || ""}
                placeholder="What assumptions are being made?"
                onChange={(e) => updateProgramme({ assumptions: e.target.value })}
              />
            </div>

            <div className="stack">
              <label>Risks or Concerns</label>
              <textarea
                value={programme.risks || ""}
                placeholder="What are the potential risks?"
                onChange={(e) => updateProgramme({ risks: e.target.value })}
              />
            </div>

            <div className="stack">
              <label>Rationale</label>
              <textarea
                value={programme.rationale || ""}
                placeholder="Why was this approach chosen?"
                onChange={(e) => updateProgramme({ rationale: e.target.value })}
              />
            </div>

            <div className="stack">
              <label>Human Review Notes</label>
              <textarea
                value={programme.reviewNotes || ""}
                placeholder="Notes from human review and oversight"
                onChange={(e) => updateProgramme({ reviewNotes: e.target.value })}
              />
            </div>
          </details>
        </div>

        </div>
      </div>

      <footer className="tool-footer">
        <div className="tool-footer-content">
          CloudPedagogy · Governance-ready AI and curriculum systems
        </div>
      </footer>
    </>
  );
}
