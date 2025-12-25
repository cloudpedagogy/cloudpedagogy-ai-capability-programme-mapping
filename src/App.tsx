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

type MapItem = {
  id: string;
  type: MapItemType;
  name: string;
  notes: string;
  domains: Record<DomainKey, boolean>;
};

type ProgrammeDetails = {
  programmeTitle: string;
  awardLevel: string;
  department: string;
  institution: string;
  mappingDate: string; // YYYY-MM-DD
  version: string;
};

type ExportPayload = {
  tool: string;
  exportedAt: string; // ISO datetime
  programme: ProgrammeDetails;
  items: MapItem[];
};

const STORAGE_KEY = "cloudpedagogy_programme_mapping_v1";

/** Fix pluralisation in Markdown export (Activity → Activities). */
const PLURAL_LABELS: Record<MapItemType, string> = {
  Module: "Modules",
  Activity: "Activities",
  Assessment: "Assessments",
};

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
  const id = crypto.randomUUID();
  return { id, type, name: "", notes: "", domains: emptyDomains() };
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

function normalizeItems(itemsRaw: unknown): MapItem[] {
  const arr = Array.isArray(itemsRaw) ? (itemsRaw as any[]) : [];
  if (arr.length === 0) return [newItem("Module")];

  return arr.map((it) => ({
    id: typeof it?.id === "string" ? it.id : crypto.randomUUID(),
    type: coerceMapItemType(it?.type),
    name: typeof it?.name === "string" ? it.name : "",
    notes: typeof it?.notes === "string" ? it.notes : "",
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
  observations: string[];
}) {
  const { toolName, exportedAtISO, programme, items, coverage, observations } = args;

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

  md.push("## Coverage snapshot");
  md.push("");
  md.push("| Domain | Tagged items |");
  md.push("|---|---:|");
  for (const d of DOMAINS) {
    md.push(`| ${escapePipes(d.name)} | ${coverage[d.key]} |`);
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

    md.push("| # | Item | Domain tags | Notes |");
    md.push("|---:|---|---|---|");

    list.forEach((it, idx) => {
      const name = (it.name || "").trim() || "Untitled";
      const tags = DOMAINS.filter((d) => it.domains[d.key]).map((d) => d.short);
      const notes = (it.notes || "").trim();

      md.push(
        `| ${idx + 1} | ${escapePipes(name)} | ${
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
  }, [items]);

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

  const observations = useMemo(() => {
    const lines: string[] = [];

    lines.push(
      `You mapped ${totalItems} item${
        totalItems === 1 ? "" : "s"
      }. Domain tagging indicates where attention is currently concentrated.`
    );

    const totalTagged = DOMAINS.reduce((sum, d) => sum + coverage[d.key], 0);

    if (totalTagged > 0) {
      const sorted = [...DOMAINS].sort((a, b) => coverage[b.key] - coverage[a.key]);
      const most = sorted[0];
      const least = sorted[sorted.length - 1];

      if (most) {
        lines.push(
          `The most represented domain is **${most.name}** (${coverage[most.key]} item${
            coverage[most.key] === 1 ? "" : "s"
          }).`
        );
      }
      if (least) {
        lines.push(
          `The least represented domain is **${least.name}** (${coverage[least.key]} item${
            coverage[least.key] === 1 ? "" : "s"
          }).`
        );
      }

      const zeroDomains = DOMAINS.filter((d) => coverage[d.key] === 0);
      if (zeroDomains.length) {
        lines.push(
          `No items were tagged for: ${zeroDomains
            .map((d) => d.name)
            .join(
              ", "
            )}. This may indicate a gap, or that the domain is addressed implicitly rather than explicitly.`
        );
      }
    } else {
      lines.push(
        "No domain tags yet. Add a few items and tag at least one domain to generate coverage insights."
      );
    }

    lines.push("Treat these signals as prompts for discussion, not as performance scores.");

    return lines;
  }, [coverage, totalItems]);

  function exportJSON() {
    const payload: ExportPayload = {
      tool: TOOL_NAME,
      exportedAt: new Date().toISOString(),
      programme,
      items,
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

    // Accept our export payload: { programme, items, ... }
    // Or direct state: { programme, items }
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

    // Reset input so importing the same file twice still triggers change event.
    e.target.value = "";

    void handleImportFile(file);
  }

  return (
    <div className="container">
      <div className="stack">
        {/* Header */}
        <div className="card stack">
          <div className="badge">
            <span>CloudPedagogy</span>
            <span className="muted">•</span>
            <span className="muted">AI Capability Tools</span>
          </div>

          <h1 className="h1">{TOOL_NAME}</h1>
          <p className="p muted">{SUBTITLE}</p>

          <div className="small muted" style={{ marginTop: 6 }}>
            Saved locally • {totalItems} item{totalItems === 1 ? "" : "s"} •{" "}
            {totalDomainTags} domain tag{totalDomainTags === 1 ? "" : "s"}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <button onClick={exportMarkdown} className="primary" disabled={!hasAnyTag} title={!hasAnyTag ? "Add at least one domain tag to enable export." : undefined}>
              Export Markdown
            </button>
            <button onClick={exportJSON} disabled={!hasAnyTag} title={!hasAnyTag ? "Add at least one domain tag to enable export." : undefined}>
              Export JSON
            </button>
            <button onClick={triggerImport}>Import JSON</button>
            <button onClick={clearAll}>Clear</button>
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
            Exports download to your computer. Your in-progress work is saved in your browser automatically. Import a file previously exported from this tool.
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

            {/* ✅ Step 5 guidance: programme context is optional, included in exports */}
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
                <button onClick={() => addItem("Activity")}>+ Activity</button>
                <button onClick={() => addItem("Assessment")}>+ Assessment</button>
              </div>
              <p className="small">
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
              <div key={item.id} className="card stack" style={{ background: "#fcfcfc" }}>
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
                  <button onClick={() => removeItem(item.id)} disabled={items.length === 1}>
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

                <div className="stack">
                  <label>Tag domains</label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {DOMAINS.map((d) => {
                      const active = item.domains[d.key];
                      return (
                        <button
                          key={d.key}
                          onClick={() => toggleDomain(item.id, d.key)}
                          className={active ? "primary" : undefined}
                          aria-pressed={active}
                          title={d.name}
                        >
                          {active ? "✓ " : ""}
                          {d.short}
                        </button>
                      );
                    })}
                  </div>
                  <p className="small">
                    Tags represent <em>meaningful</em> engagement with a domain, not mere mention. Use judgement.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Output */}
        <div className="card stack">
          <h2 className="h2">Output</h2>

          <div className="row">
            <div className="stack">
              <div className="badge">Coverage snapshot</div>
              <div className="stack">
                {DOMAINS.map((d) => (
                  <div key={d.key} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span className="small">
                      <strong>{d.name}</strong>
                    </span>
                    <span className="small">
                      {coverage[d.key]} item{coverage[d.key] === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
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

        <div className="small muted" style={{ textAlign: "center", paddingBottom: 10 }}>
          CloudPedagogy • Static tool scaffold • Client-side only
        </div>
      </div>
    </div>
  );
}
