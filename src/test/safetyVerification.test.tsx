import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../App";
import {
  STORAGE_KEY,
  calculateCoverage,
  calculateWeightedCoverage,
  generateObservations,
  buildMarkdown,
  normalizeItems,
  normalizeProgramme,
  loadState,
  WEIGHT_MAP,
} from "../mapping";
import type { MapItem, ProgrammeDetails, ExportPayload } from "../mapping";
import { DOMAINS } from "../content/domains";
import type { DomainKey } from "../content/domains";
import { TOOL_NAME } from "../content/framing";

// Baseline inline implementations (extracted directly from c9afb39:src/App.tsx)
function baselineCoverage(items: MapItem[]): Record<DomainKey, number> {
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

function baselineWeightedCoverage(items: MapItem[]): Record<DomainKey, number> {
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

function baselineObservations(
  itemsCount: number,
  weightedCoverage: Record<DomainKey, number>
): string[] {
  const lines: string[] = [];
  const totalItems = itemsCount;

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

describe("Final Pre-Commit Safety Verification", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("1. Baseline calculation comparison with representative fixed inputs", () => {
    const testCases: { name: string; items: MapItem[] }[] = [
      {
        name: "Empty programme (0 items)",
        items: [],
      },
      {
        name: "Single untagged item (all primary gaps)",
        items: [
          {
            id: "item-0",
            type: "Module",
            name: "Intro",
            notes: "",
            weight: "Medium",
            domains: {
              awareness: false,
              coagency: false,
              practice: false,
              ethics: false,
              governance: false,
              reflection: false,
            },
          },
        ],
      },
      {
        name: "Complex curriculum with primary and secondary gaps",
        items: [
          {
            id: "m-1",
            type: "Module",
            name: "Core AI",
            notes: "High exposure",
            weight: "High",
            domains: {
              awareness: true,
              coagency: true,
              practice: true,
              ethics: true,
              governance: false,
              reflection: false,
            },
          },
          {
            id: "act-1",
            type: "Activity",
            name: "Ethics seminar",
            notes: "Discussion",
            weight: "Medium",
            domains: {
              awareness: false,
              coagency: false,
              practice: false,
              ethics: true,
              governance: false,
              reflection: false,
            },
          },
          {
            id: "ass-1",
            type: "Assessment",
            name: "Briefing paper",
            notes: "Reflection",
            weight: "Low",
            domains: {
              awareness: false,
              coagency: false,
              practice: false,
              ethics: false,
              governance: false,
              reflection: true,
            },
          },
        ],
      },
      {
        name: "Balanced curriculum across all 6 domains",
        items: [
          {
            id: "bal-1",
            type: "Module",
            name: "Capstone",
            notes: "Balanced",
            weight: "High",
            domains: {
              awareness: true,
              coagency: true,
              practice: true,
              ethics: true,
              governance: true,
              reflection: true,
            },
          },
        ],
      },
    ];

    testCases.forEach(({ name, items }) => {
      it(`matches baseline exactly for: ${name}`, () => {
        // 1. Coverage counts
        const baseCov = baselineCoverage(items);
        const upCov = calculateCoverage(items);
        expect(upCov).toEqual(baseCov);

        // 2. Weighted coverage
        const baseWeighted = baselineWeightedCoverage(items);
        const upWeighted = calculateWeightedCoverage(items);
        expect(upWeighted).toEqual(baseWeighted);

        // 3. Observations, primary gaps, secondary gaps, and balance condition
        const baseObs = baselineObservations(items.length, baseWeighted);
        const upObs = generateObservations(items.length, upWeighted);
        expect(upObs).toEqual(baseObs);

        // 4. Markdown export structure
        const fixedISO = "2026-11-07T12:00:00.000Z";
        const sampleProg: ProgrammeDetails = {
          programmeTitle: "Fixed Test Title",
          awardLevel: "Level 7",
          department: "Dept",
          institution: "Inst",
          mappingDate: "2026-11-07",
          version: "v1.0",
        };

        const mdOutput = buildMarkdown({
          toolName: TOOL_NAME,
          exportedAtISO: fixedISO,
          programme: sampleProg,
          items,
          coverage: upCov,
          weightedCoverage: upWeighted,
          observations: upObs,
        });

        expect(mdOutput).toContain(`# ${sampleProg.programmeTitle}`);
        expect(mdOutput).toContain(`**Exported:** ${fixedISO}`);
        for (const line of upObs) {
          expect(mdOutput).toContain(line);
        }
      });
    });
  });

  describe("2. Historical data preservation", () => {
    const historicalPayload = {
      programme: {
        programmeTitle: "Historical MSc Curriculum",
        awardLevel: "MSc",
        department: "Social Science & Informatics",
        institution: "Imperial College",
        mappingDate: "2025-10-15",
        version: "v1.2-approved",
        aiInvolvement: "Extensive genAI use in coding labs",
        assumptions: "Students have personal laptop access",
        risks: "Hallucinated citations in literature review",
        rationale: "Align with faculty AI readiness benchmark",
        reviewNotes: "Re-reviewed by QA Committee 2025-11-01",
      },
      items: [
        {
          id: "hist-mod-001",
          type: "Module",
          name: "Foundations of Data Systems",
          notes: "Module-level foundational exposure",
          weight: "High",
          domains: {
            awareness: true,
            coagency: true,
            practice: false,
            ethics: false,
            governance: false,
            reflection: false,
          },
        },
        {
          id: "hist-act-002",
          type: "Activity",
          name: "Red Teaming Workshop",
          notes: "Adversarial testing exercise",
          weight: "Medium",
          domains: {
            awareness: false,
            coagency: false,
            practice: true,
            ethics: true,
            governance: false,
            reflection: false,
          },
        },
        {
          id: "hist-ass-003",
          type: "Assessment",
          name: "Governance & Risk Audit Report",
          notes: "Summative assessment",
          weight: "High",
          domains: {
            awareness: false,
            coagency: false,
            practice: false,
            ethics: false,
            governance: true,
            reflection: true,
          },
        },
      ],
    };

    it("preserves historical metadata, IDs, weights, and all six domains intact", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(historicalPayload));

      const loaded = loadState();

      // Verify programme metadata
      expect(loaded.programme).toEqual(historicalPayload.programme);

      // Verify items: length, stable IDs, weights, notes, and exact domain flags
      expect(loaded.items).toHaveLength(3);
      loaded.items.forEach((item, index) => {
        const original = historicalPayload.items[index];
        expect(item.id).toBe(original.id);
        expect(item.type).toBe(original.type);
        expect(item.name).toBe(original.name);
        expect(item.notes).toBe(original.notes);
        expect(item.weight).toBe(original.weight);
        expect(item.domains).toEqual(original.domains);
      });
    });

    it("safely handles missing optional governance fields in historical records", () => {
      const minimalHistorical = {
        programme: {
          programmeTitle: "Legacy Minimal Programme",
          awardLevel: "BSc",
          department: "Maths",
          institution: "Bristol",
          mappingDate: "2025-01-01",
          version: "v0.1",
        },
        items: [
          {
            id: "item-min-1",
            type: "Module",
            name: "Calculus",
            notes: "",
            weight: "Low",
            domains: {
              awareness: true,
              coagency: false,
              practice: false,
              ethics: false,
              governance: false,
              reflection: false,
            },
          },
        ],
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalHistorical));
      const loaded = loadState();

      expect(loaded.programme.programmeTitle).toBe("Legacy Minimal Programme");
      expect(loaded.programme.aiInvolvement).toBeUndefined();
      expect(loaded.programme.assumptions).toBeUndefined();
      expect(loaded.programme.risks).toBeUndefined();
      expect(loaded.programme.rationale).toBeUndefined();
      expect(loaded.programme.reviewNotes).toBeUndefined();
      expect(loaded.items[0].id).toBe("item-min-1");
    });
  });

  describe("3. Import safety and non-destructive validation", () => {
    it("does not overwrite current programme when file contains unparseable JSON", async () => {
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

      // Seed existing work
      const existingState = {
        programme: { programmeTitle: "Protected Current Work" },
        items: [{ id: "keep-1", type: "Module", name: "Keep Me", weight: "High", domains: { awareness: true } }],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existingState));

      render(<App />);
      expect(screen.getByDisplayValue("Protected Current Work")).toBeInTheDocument();

      const corruptFile = new File(["{{{ not json syntax"], "broken.json", { type: "application/json" });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(fileInput, { target: { files: [corruptFile] } });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("That file could not be parsed as JSON.");
      });

      // Existing work in DOM and storage remains unmodified
      expect(screen.getByDisplayValue("Protected Current Work")).toBeInTheDocument();
      const currentStorage = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(currentStorage.programme.programmeTitle).toBe("Protected Current Work");
      expect(currentStorage.items[0].name).toBe("Keep Me");
    });

    it("does not overwrite current work if user cancels import confirmation", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

      const existingState = {
        programme: { programmeTitle: "Active In-Progress Work" },
        items: [{ id: "active-1", type: "Module", name: "Active Item", weight: "Medium", domains: {} }],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existingState));

      render(<App />);

      const validNewFile = new File(
        [
          JSON.stringify({
            tool: TOOL_NAME,
            programme: { programmeTitle: "Incoming File That Should Be Cancelled" },
            items: [{ id: "new-1", type: "Activity", name: "New Item", weight: "High", domains: {} }],
          }),
        ],
        "import.json",
        { type: "application/json" }
      );

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [validNewFile] } });

      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Import this mapping?"));
      });

      // Current work preserved
      expect(screen.getByDisplayValue("Active In-Progress Work")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("Incoming File That Should Be Cancelled")).not.toBeInTheDocument();
    });

    it("verifies importing JSON without an items array matches baseline behavior", () => {
      // Direct baseline comparison for normalization of payload without items
      const sparsePayload = { programme: { programmeTitle: "Sparse Payload" } };

      const normProg = normalizeProgramme(sparsePayload.programme);
      const normItems = normalizeItems((sparsePayload as Record<string, unknown>).items);

      expect(normProg.programmeTitle).toBe("Sparse Payload");
      // Baseline behavior: normalizes to a single default Module item
      expect(normItems).toHaveLength(1);
      expect(normItems[0].type).toBe("Module");
      expect(normItems[0].weight).toBe("Medium");
    });
  });

  describe("4. Export round-trip fidelity", () => {
    it("ensures exported JSON can be fully imported without losing any fields", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);

      const exportOriginal: ExportPayload = {
        tool: TOOL_NAME,
        exportedAt: "2026-11-07T18:00:00.000Z",
        programme: {
          programmeTitle: "Round-Trip Degree",
          awardLevel: "BSc Computer Science",
          department: "Computing",
          institution: "UCL",
          mappingDate: "2026-11-07",
          version: "v2.1",
          aiInvolvement: "Automated coding feedback",
          assumptions: "Git fluency required",
          risks: "Submission leakage",
          rationale: "Continuous assessment",
          reviewNotes: "Passed validation",
        },
        items: [
          {
            id: "rt-1",
            type: "Module",
            name: "Systems Architecture",
            notes: "Deep architectural principles",
            weight: "High",
            domains: {
              awareness: true,
              coagency: true,
              practice: true,
              ethics: false,
              governance: false,
              reflection: false,
            },
          },
          {
            id: "rt-2",
            type: "Assessment",
            name: "Governance Essay",
            notes: "Legal accountability essay",
            weight: "Medium",
            domains: {
              awareness: false,
              coagency: false,
              practice: false,
              ethics: true,
              governance: true,
              reflection: true,
            },
          },
        ],
        analytics: {
          totalItems: 2,
          weightedCoverage: {
            awareness: 3,
            coagency: 3,
            practice: 3,
            ethics: 2,
            governance: 2,
            reflection: 2,
          },
        },
      };

      const file = new File([JSON.stringify(exportOriginal)], "export.json", {
        type: "application/json",
      });

      render(<App />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByDisplayValue("Round-Trip Degree")).toBeInTheDocument();
      });

      // Verify all inputs rendered accurately
      expect(screen.getByDisplayValue("BSc Computer Science")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Computing")).toBeInTheDocument();
      expect(screen.getByDisplayValue("UCL")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Systems Architecture")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Governance Essay")).toBeInTheDocument();

      // Verify stored state in localStorage matches exported data
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.programme).toEqual(exportOriginal.programme);
      expect(saved.items[0]).toEqual(exportOriginal.items[0]);
      expect(saved.items[1]).toEqual(exportOriginal.items[1]);
    });
  });
});
