import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WEIGHT_MAP,
  STORAGE_KEY,
  PLURAL_LABELS,
  safeUUID,
  emptyDomains,
  newItem,
  todayISODate,
  defaultProgrammeDetails,
  coerceMapItemType,
  coerceWeight,
  normalizeItems,
  normalizeProgramme,
  loadState,
  safeSlug,
  escapePipes,
  buildMarkdown,
  calculateCoverage,
  calculateWeightedCoverage,
  generateObservations,
} from "../mapping";
import type { MapItem, ProgrammeDetails } from "../mapping";
import { DOMAINS } from "../content/domains";
import { TOOL_NAME } from "../content/framing";

describe("Mapping calculations, input boundaries, and utilities", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("1. Coverage calculations", () => {
    it("returns zero coverage for an empty items list", () => {
      const coverage = calculateCoverage([]);
      DOMAINS.forEach((d) => {
        expect(coverage[d.key]).toBe(0);
      });
    });

    it("correctly counts items tagged per domain", () => {
      const items: MapItem[] = [
        {
          id: "item-1",
          type: "Module",
          name: "Module 1",
          notes: "",
          weight: "Medium",
          domains: { ...emptyDomains(), awareness: true, ethics: true },
        },
        {
          id: "item-2",
          type: "Activity",
          name: "Activity 1",
          notes: "",
          weight: "High",
          domains: { ...emptyDomains(), ethics: true, coagency: true },
        },
      ];

      const coverage = calculateCoverage(items);
      expect(coverage.awareness).toBe(1);
      expect(coverage.ethics).toBe(2);
      expect(coverage.coagency).toBe(1);
      expect(coverage.practice).toBe(0);
      expect(coverage.governance).toBe(0);
      expect(coverage.reflection).toBe(0);
    });
  });

  describe("2. Weighted coverage calculations", () => {
    it("applies WEIGHT_MAP values: Low=1, Medium=2, High=3", () => {
      expect(WEIGHT_MAP.Low).toBe(1);
      expect(WEIGHT_MAP.Medium).toBe(2);
      expect(WEIGHT_MAP.High).toBe(3);

      const items: MapItem[] = [
        {
          id: "1",
          type: "Module",
          name: "Low Item",
          notes: "",
          weight: "Low",
          domains: { ...emptyDomains(), practice: true },
        },
        {
          id: "2",
          type: "Activity",
          name: "Medium Item",
          notes: "",
          weight: "Medium",
          domains: { ...emptyDomains(), practice: true },
        },
        {
          id: "3",
          type: "Assessment",
          name: "High Item",
          notes: "",
          weight: "High",
          domains: { ...emptyDomains(), practice: true },
        },
      ];

      const weighted = calculateWeightedCoverage(items);
      expect(weighted.practice).toBe(1 + 2 + 3); // 6
      expect(weighted.awareness).toBe(0);
    });

    it("defaults to weight 2 (Medium) if an unknown weight is encountered", () => {
      const item = {
        id: "1",
        type: "Module" as const,
        name: "Test",
        notes: "",
        weight: "InvalidWeight" as unknown as "Medium",
        domains: { ...emptyDomains(), governance: true },
      };

      const weighted = calculateWeightedCoverage([item]);
      expect(weighted.governance).toBe(2);
    });
  });

  describe("3. Observation and gap analysis logic", () => {
    it("reports item count correctly with singular/plural grammar", () => {
      const singleItemObs = generateObservations(1, calculateWeightedCoverage([]));
      expect(singleItemObs[0]).toContain("The programme includes 1 mapped item.");

      const multiItemObs = generateObservations(4, calculateWeightedCoverage([]));
      expect(multiItemObs[0]).toContain("The programme includes 4 mapped items.");
    });

    it("flags all 6 domains as Primary Gaps when total weighted coverage is zero", () => {
      const weighted = calculateWeightedCoverage([]);
      const obs = generateObservations(1, weighted);

      const primaryLine = obs.find((l) => l.includes("Primary Gap Detected:"));
      expect(primaryLine).toBeDefined();
      DOMAINS.forEach((d) => {
        expect(primaryLine).toContain(d.name);
      });
      expect(obs.some((l) => l.includes("Secondary Gap Detected:"))).toBe(false);
    });

    it("flags Secondary Gap strictly when 0 < intensity < (avgWeighted * 0.5)", () => {
      // 5 domains have intensity 10, total = 50.
      // 1 domain (ethics) has intensity 4.
      // Total = 54. Average = 54 / 6 = 9. 50% of average = 4.5.
      // 4 is > 0 and < 4.5 -> Secondary Gap.
      const weighted = {
        awareness: 10,
        coagency: 10,
        practice: 10,
        ethics: 4,
        governance: 10,
        reflection: 10,
      };

      const obs = generateObservations(6, weighted);
      expect(obs.some((l) => l.includes("Primary Gap Detected:"))).toBe(false);

      const secLine = obs.find((l) => l.includes("Secondary Gap Detected:"));
      expect(secLine).toBeDefined();
      expect(secLine).toContain("Ethics, Equity & Impact");
    });

    it("does not flag Secondary Gap if intensity equals or exceeds 50% of average", () => {
      // 5 domains have intensity 10, 1 domain has intensity 5.
      // Total = 55. Average = 55 / 6 = 9.166. 50% of avg = 4.583.
      // 5 is >= 4.583 -> No secondary gap.
      const weighted = {
        awareness: 10,
        coagency: 10,
        practice: 10,
        ethics: 5,
        governance: 10,
        reflection: 10,
      };

      const obs = generateObservations(6, weighted);
      expect(obs.some((l) => l.includes("Secondary Gap Detected:"))).toBe(false);
      expect(obs.some((l) => l.includes("Domain coverage appears relatively balanced"))).toBe(true);
    });

    it("reports balanced coverage when all domains are > 0 and no secondary gaps exist", () => {
      const weighted = {
        awareness: 6,
        coagency: 6,
        practice: 6,
        ethics: 6,
        governance: 6,
        reflection: 6,
      };

      const obs = generateObservations(3, weighted);
      expect(obs.some((l) => l.includes("Domain coverage appears relatively balanced"))).toBe(true);
    });
  });

  describe("4. String formatting and Markdown generation", () => {
    it("safeSlug formats strings for clean filenames", () => {
      expect(safeSlug("MSc Artificial Intelligence & Ethics")).toBe("msc-artificial-intelligence-ethics");
      expect(safeSlug("---Leading and Trailing---")).toBe("leading-and-trailing");
      expect(safeSlug("")).toBe("");
    });

    it("escapePipes escapes pipe characters for Markdown tables", () => {
      expect(escapePipes("Item A | Item B")).toBe("Item A \\| Item B");
      expect(escapePipes("No pipes")).toBe("No pipes");
    });

    it("buildMarkdown formats complete QA-ready markdown output", () => {
      const programme: ProgrammeDetails = {
        programmeTitle: "MSc AI & Education",
        awardLevel: "Level 7",
        department: "Learning Sciences",
        institution: "London",
        mappingDate: "2026-11-01",
        version: "v1.0",
      };

      const items: MapItem[] = [
        {
          id: "m-1",
          type: "Module",
          name: "Foundations | Core",
          notes: "Essential AI introduction",
          weight: "Medium",
          domains: { ...emptyDomains(), awareness: true },
        },
        {
          id: "a-1",
          type: "Activity",
          name: "Prompt Lab",
          notes: "Hands-on",
          weight: "High",
          domains: { ...emptyDomains(), practice: true, coagency: true },
        },
      ];

      const coverage = calculateCoverage(items);
      const weightedCoverage = calculateWeightedCoverage(items);
      const observations = generateObservations(items.length, weightedCoverage);

      const md = buildMarkdown({
        toolName: TOOL_NAME,
        exportedAtISO: "2026-11-07T12:00:00.000Z",
        programme,
        items,
        coverage,
        weightedCoverage,
        observations,
      });

      expect(md).toContain("# MSc AI & Education");
      expect(md).toContain(`**Tool:** ${TOOL_NAME}`);
      expect(md).toContain("- **Programme title:** MSc AI & Education");
      expect(md).toContain("## Coverage intensity snapshot");
      expect(md).toContain("## Mapping items (QA-ready view)");
      expect(md).toContain("### Modules");
      expect(md).toContain("### Activities");
      expect(md).toContain("### Assessments");
      expect(md).toContain("_(No assessments added.)_");
      expect(md).toContain("Foundations \\| Core");
      expect(md).toContain("Prompt Lab");
    });
  });

  describe("5. Input normalization and boundaries", () => {
    it("coerceMapItemType defaults invalid types to Module", () => {
      expect(coerceMapItemType("Module")).toBe("Module");
      expect(coerceMapItemType("Activity")).toBe("Activity");
      expect(coerceMapItemType("Assessment")).toBe("Assessment");
      expect(coerceMapItemType("Lecture")).toBe("Module");
      expect(coerceMapItemType(null)).toBe("Module");
      expect(coerceMapItemType(undefined)).toBe("Module");
    });

    it("coerceWeight defaults invalid weights to Medium", () => {
      expect(coerceWeight("Low")).toBe("Low");
      expect(coerceWeight("Medium")).toBe("Medium");
      expect(coerceWeight("High")).toBe("High");
      expect(coerceWeight("Critical")).toBe("Medium");
      expect(coerceWeight(null)).toBe("Medium");
      expect(coerceWeight(undefined)).toBe("Medium");
    });

    it("normalizeProgramme sanitizes non-string values and retains optional fields", () => {
      const malformed = {
        programmeTitle: 999,
        awardLevel: true,
        department: null,
        institution: undefined,
        mappingDate: "2026-01-01",
        version: "v0.9",
        aiInvolvement: "Used for auto-grading",
      };

      const result = normalizeProgramme(malformed);
      expect(result.programmeTitle).toBe("");
      expect(result.awardLevel).toBe("");
      expect(result.department).toBe("");
      expect(result.institution).toBe("");
      expect(result.mappingDate).toBe("2026-01-01");
      expect(result.version).toBe("v0.9");
      expect(result.aiInvolvement).toBe("Used for auto-grading");
      expect(result.assumptions).toBeUndefined();
    });

    it("normalizeItems ensures at least 1 item is returned and validates domain booleans", () => {
      expect(normalizeItems(null)).toHaveLength(1);
      expect(normalizeItems([])).toHaveLength(1);
      expect(normalizeItems("invalid")).toHaveLength(1);

      const items = normalizeItems([
        {
          id: 123,
          type: "Activity",
          name: "Test Activity",
          weight: "High",
          domains: {
            awareness: true,
            ethics: "truthy string should not be boolean true",
          },
        },
      ]);

      expect(items).toHaveLength(1);
      expect(typeof items[0].id).toBe("string");
      expect(items[0].type).toBe("Activity");
      expect(items[0].weight).toBe("High");
      expect(items[0].domains.awareness).toBe(true);
      expect(items[0].domains.ethics).toBe(false); // Non-boolean ignored
      expect(items[0].domains.coagency).toBe(false);
    });

    it("loadState loads from storage or returns clean defaults if empty or corrupted", () => {
      // Empty storage
      const emptyState = loadState();
      expect(emptyState.programme.programmeTitle).toBe("");
      expect(emptyState.items).toHaveLength(1);

      // Corrupted storage
      localStorage.setItem(STORAGE_KEY, "invalid-json{{");
      const corruptedState = loadState();
      expect(corruptedState.programme.programmeTitle).toBe("");
      expect(corruptedState.items).toHaveLength(1);

      // Valid storage
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          programme: { programmeTitle: "Saved Title" },
          items: [{ type: "Assessment", name: "Saved Exam" }],
        })
      );
      const validState = loadState();
      expect(validState.programme.programmeTitle).toBe("Saved Title");
      expect(validState.items[0].name).toBe("Saved Exam");
    });

    it("safeUUID returns a valid uuid and falls back when randomUUID is unavailable", () => {
      const id1 = safeUUID();
      expect(typeof id1).toBe("string");
      expect(id1.length).toBeGreaterThan(0);

      const originalCrypto = globalThis.crypto;
      try {
        Object.defineProperty(globalThis, "crypto", {
          value: undefined,
          configurable: true,
        });
        const fallbackId = safeUUID();
        expect(fallbackId).toMatch(/^id-[a-z0-9]+-[a-z0-9]+$/);
      } finally {
        Object.defineProperty(globalThis, "crypto", {
          value: originalCrypto,
          configurable: true,
        });
      }
    });

    it("todayISODate returns YYYY-MM-DD format", () => {
      const today = todayISODate();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("defaultProgrammeDetails returns initial structure with today's date and v0.1", () => {
      const defaults = defaultProgrammeDetails();
      expect(defaults.programmeTitle).toBe("");
      expect(defaults.awardLevel).toBe("");
      expect(defaults.department).toBe("");
      expect(defaults.institution).toBe("");
      expect(defaults.version).toBe("v0.1");
      expect(defaults.mappingDate).toBe(todayISODate());
    });

    it("newItem creates an empty item with default weight Medium", () => {
      const item = newItem("Assessment");
      expect(item.type).toBe("Assessment");
      expect(item.weight).toBe("Medium");
      expect(item.name).toBe("");
      expect(item.notes).toBe("");
      DOMAINS.forEach((d) => {
        expect(item.domains[d.key]).toBe(false);
      });
    });

    it("PLURAL_LABELS maps correctly", () => {
      expect(PLURAL_LABELS.Module).toBe("Modules");
      expect(PLURAL_LABELS.Activity).toBe("Activities");
      expect(PLURAL_LABELS.Assessment).toBe("Assessments");
    });
  });
});
