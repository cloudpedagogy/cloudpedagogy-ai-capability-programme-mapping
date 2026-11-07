import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { DOMAINS } from "../content/domains";
import { TOOL_NAME, SUBTITLE, PURPOSE_TEXT, LIMITATIONS_TEXT } from "../content/framing";

const STORAGE_KEY = "cloudpedagogy_programme_mapping_v1";

describe("AI Capability Programme Mapping — Regression Tests", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("1. Initial state and default presentation", () => {
    it("renders tool header, title, and framing copy", () => {
      render(<App />);

      expect(screen.getByRole("heading", { level: 1, name: TOOL_NAME })).toBeInTheDocument();
      expect(screen.getByText(SUBTITLE)).toBeInTheDocument();
      expect(screen.getAllByText(PURPOSE_TEXT).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(LIMITATIONS_TEXT).length).toBeGreaterThanOrEqual(1);
    });

    it("initializes with 1 default Module item and 0 domain tags", () => {
      render(<App />);

      expect(screen.getByText(/1 item/)).toBeInTheDocument();
      expect(screen.getByText(/0 domain tags/)).toBeInTheDocument();
      expect(screen.getByText("Saved locally")).toBeInTheDocument();

      // Export buttons should be disabled when there are 0 domain tags
      const exportMdBtn = screen.getByRole("button", { name: "Export Markdown" });
      const exportJsonBtn = screen.getByRole("button", { name: "Export JSON" });
      expect(exportMdBtn).toBeDisabled();
      expect(exportJsonBtn).toBeDisabled();
      expect(screen.getByText("Add at least one domain tag to enable export.")).toBeInTheDocument();
    });

    it("renders default primary gap detection when no items have domain tags", () => {
      render(<App />);

      // All 6 domains should be flagged as Primary Gap
      const primaryGapBadges = screen.getAllByText("Primary Gap");
      expect(primaryGapBadges).toHaveLength(6);
      expect(
        screen.getByText((content) => content.includes("Primary Gap Detected:"))
      ).toBeInTheDocument();
    });

    it("renders the 6 capability domains in the lenses list and table header", () => {
      render(<App />);

      DOMAINS.forEach((domain) => {
        expect(screen.getAllByText(domain.name).length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("2. Programme details and metadata", () => {
    it("allows updating programme details fields and reflects them in storage", async () => {
      const user = userEvent.setup();
      render(<App />);

      const titleInput = screen.getByPlaceholderText("e.g. MSc Public Health");
      const awardInput = screen.getByPlaceholderText("e.g. MSc / PGCert / UG Year 2");
      const deptInput = screen.getByPlaceholderText("e.g. Faculty of Public Health");
      const instInput = screen.getByPlaceholderText("e.g. LSHTM");
      const versionInput = screen.getByPlaceholderText("e.g. v0.1 draft / pre-approval / post-review");

      await user.type(titleInput, "MSc Health Data Science");
      await user.type(awardInput, "MSc Level 7");
      await user.type(deptInput, "Department of Computer Science");
      await user.type(instInput, "University College");
      await user.clear(versionInput);
      await user.type(versionInput, "v1.0 Final");

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.programme.programmeTitle).toBe("MSc Health Data Science");
      expect(saved.programme.awardLevel).toBe("MSc Level 7");
      expect(saved.programme.department).toBe("Department of Computer Science");
      expect(saved.programme.institution).toBe("University College");
      expect(saved.programme.version).toBe("v1.0 Final");
    });

    it("supports optional governance fields (AI involvement, assumptions, risks, rationale, review notes)", async () => {
      const user = userEvent.setup();
      render(<App />);

      const aiInvolvementInput = screen.getByPlaceholderText("How is AI involved in this process?");
      const assumptionsInput = screen.getByPlaceholderText("What assumptions are being made?");
      const risksInput = screen.getByPlaceholderText("What are the potential risks?");
      const rationaleInput = screen.getByPlaceholderText("Why was this approach chosen?");
      const reviewNotesInput = screen.getByPlaceholderText("Notes from human review and oversight");

      await user.type(aiInvolvementInput, "AI coding copilot used in assignments");
      await user.type(assumptionsInput, "Students have basic Python background");
      await user.type(risksInput, "Over-reliance without verification");
      await user.type(rationaleInput, "Authentic industry preparation");
      await user.type(reviewNotesInput, "Reviewed by Curriculum Committee");

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.programme.aiInvolvement).toBe("AI coding copilot used in assignments");
      expect(saved.programme.assumptions).toBe("Students have basic Python background");
      expect(saved.programme.risks).toBe("Over-reliance without verification");
      expect(saved.programme.rationale).toBe("Authentic industry preparation");
      expect(saved.programme.reviewNotes).toBe("Reviewed by Curriculum Committee");
    });
  });

  describe("3. Map items CRUD and intensity weighting", () => {
    it("can add Activity and Assessment items", async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole("button", { name: "+ Activity" }));
      await user.click(screen.getByRole("button", { name: "+ Assessment" }));

      expect(screen.getByText(/3 items/)).toBeInTheDocument();
      expect(screen.getAllByText("Activity").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Assessment")).toBeInTheDocument();

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.items).toHaveLength(3);
      expect(saved.items[0].type).toBe("Module");
      expect(saved.items[1].type).toBe("Activity");
      expect(saved.items[2].type).toBe("Assessment");
    });

    it("prevents removing the last remaining item", () => {
      render(<App />);

      const removeBtn = screen.getByRole("button", { name: "Remove" });
      expect(removeBtn).toBeDisabled();
    });

    it("allows removing an item when more than one exists", async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole("button", { name: "+ Activity" }));
      expect(screen.getByText(/2 items/)).toBeInTheDocument();

      const removeButtons = screen.getAllByRole("button", { name: "Remove" });
      expect(removeButtons[0]).not.toBeDisabled();
      await user.click(removeButtons[1]);

      expect(screen.getByText(/1 item/)).toBeInTheDocument();
    });

    it("updates item name and notes", async () => {
      const user = userEvent.setup();
      render(<App />);

      const nameInput = screen.getByPlaceholderText("e.g. Foundations of...");
      const notesInput = screen.getByPlaceholderText(/what AI use is expected/);

      await user.type(nameInput, "Machine Learning Fundamentals");
      await user.type(notesInput, "Covers neural network basics and ethical bias.");

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.items[0].name).toBe("Machine Learning Fundamentals");
      expect(saved.items[0].notes).toBe("Covers neural network basics and ethical bias.");
    });

    it("updates embedding intensity (Low = 1, Medium = 2, High = 3)", async () => {
      const user = userEvent.setup();
      render(<App />);

      const lowBtn = screen.getByRole("button", { name: "Low" });
      const highBtn = screen.getByRole("button", { name: "High" });

      await user.click(highBtn);

      let saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.items[0].weight).toBe("High");

      await user.click(lowBtn);
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.items[0].weight).toBe("Low");
    });
  });

  describe("4. Capability domain mapping, gap calculations, and balance logic", () => {
    it("toggles capability domain tags on and off and updates badge counts", async () => {
      const user = userEvent.setup();
      render(<App />);

      // Find the domain toggle button for Ethics
      const ethicsBtn = screen.getByRole("button", { name: "Ethics" });
      expect(ethicsBtn).toHaveAttribute("aria-pressed", "false");

      await user.click(ethicsBtn);
      expect(ethicsBtn).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText(/1 domain tag/)).toBeInTheDocument();

      // Exports should become enabled
      expect(screen.getByRole("button", { name: "Export Markdown" })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: "Export JSON" })).not.toBeDisabled();

      // Untoggle Ethics
      await user.click(ethicsBtn);
      expect(ethicsBtn).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByText(/0 domain tags/)).toBeInTheDocument();
    });

    it("calculates weighted intensity correctly (weight * tag count)", async () => {
      const user = userEvent.setup();
      render(<App />);

      // Set item 1 to High (weight 3) and tag Awareness & Ethics
      const highBtn = screen.getByRole("button", { name: "High" });
      await user.click(highBtn);

      const awarenessBtn = screen.getByRole("button", { name: "Awareness" });
      const ethicsBtn = screen.getByRole("button", { name: "Ethics" });
      await user.click(awarenessBtn);
      await user.click(ethicsBtn);

      // Add item 2, leave default Medium (weight 2), tag Awareness
      await user.click(screen.getByRole("button", { name: "+ Activity" }));
      const allAwarenessBtns = screen.getAllByRole("button", { name: "Awareness" });
      await user.click(allAwarenessBtns[1]);

      // Awareness intensity should be 3 + 2 = 5
      // Ethics intensity should be 3
      expect(screen.getByText("5 intensity")).toBeInTheDocument();
      expect(screen.getByText("3 intensity")).toBeInTheDocument();
    });

    it("identifies Secondary Gaps when intensity is > 0 but < 50% of programme average", async () => {
      const user = userEvent.setup();
      render(<App />);

      // Create a scenario where one domain has very high intensity, making the average high,
      // while another domain has low intensity (< 50% of average)
      // Item 1: High weight (3), tag Awareness, Coagency, Practice, Ethics, Governance
      await user.click(screen.getByRole("button", { name: "High" }));
      const tagDomains = ["Awareness", "Co-Agency", "Practice", "Ethics", "Governance"];
      for (const tag of tagDomains) {
        await user.click(screen.getByRole("button", { name: tag }));
      }

      // Add another High weight (3) item with the same 5 domains
      await user.click(screen.getByRole("button", { name: "+ Module" }));
      const highBtns = screen.getAllByRole("button", { name: "High" });
      await user.click(highBtns[1]);
      for (const tag of tagDomains) {
        const btns = screen.getAllByRole("button", { name: tag });
        await user.click(btns[1]);
      }

      // Add a third item with Low weight (1), tag Renewal (Reflection)
      await user.click(screen.getByRole("button", { name: "+ Activity" }));
      const lowBtns = screen.getAllByRole("button", { name: "Low" });
      await user.click(lowBtns[2]);
      const renewalBtns = screen.getAllByRole("button", { name: "Renewal" });
      await user.click(renewalBtns[2]);

      // Intensities: 5 domains have 6, Renewal has 1.
      // Total = 31. Average = 31 / 6 = 5.166. 50% of avg = 2.58.
      // Renewal is 1, which is > 0 and < 2.58 -> Secondary Gap!
      expect(screen.getByText("Secondary Gap")).toBeInTheDocument();
      expect(
        screen.getByText((content) => content.includes("Secondary Gap Detected:"))
      ).toBeInTheDocument();
    });

    it("displays balanced coverage message when all domains are adequately covered with no gaps", async () => {
      const user = userEvent.setup();
      render(<App />);

      // Tag all 6 domains on the single item
      const allTags = ["Awareness", "Co-Agency", "Practice", "Ethics", "Governance", "Renewal"];
      for (const tag of allTags) {
        await user.click(screen.getByRole("button", { name: tag }));
      }

      expect(screen.getByText(/Domain coverage appears relatively balanced across the programme/)).toBeInTheDocument();
      expect(screen.queryByText("Primary Gap")).not.toBeInTheDocument();
      expect(screen.queryByText("Secondary Gap")).not.toBeInTheDocument();
    });
  });

  describe("5. Storage and restoration", () => {
    it("loads saved state from localStorage on mount", () => {
      const savedPayload = {
        programme: {
          programmeTitle: "Existing Stored Programme",
          awardLevel: "BSc",
          department: "Informatics",
          institution: "City University",
          mappingDate: "2026-05-15",
          version: "v2.0",
        },
        items: [
          {
            id: "test-item-1",
            type: "Assessment",
            name: "Final Capstone",
            notes: "Integrates all capability domains",
            weight: "High",
            domains: {
              awareness: true,
              coagency: true,
              practice: true,
              ethics: true,
              governance: false,
              reflection: true,
            },
          },
        ],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPayload));

      render(<App />);

      expect(screen.getByDisplayValue("Existing Stored Programme")).toBeInTheDocument();
      expect(screen.getByDisplayValue("BSc")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Final Capstone")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Integrates all capability domains")).toBeInTheDocument();
      expect(screen.getByText("Assessment")).toBeInTheDocument();
      expect(screen.getByText(/5 domain tags/)).toBeInTheDocument();
    });

    it("handles corrupted or invalid JSON in localStorage gracefully", () => {
      localStorage.setItem(STORAGE_KEY, "{ bad json format %&*");

      render(<App />);

      // Should fall back to default state safely
      expect(screen.getByText(/1 item/)).toBeInTheDocument();
      expect(screen.getByText(/0 domain tags/)).toBeInTheDocument();
    });

    it("clears state back to default upon confirmation", async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<App />);

      const titleInput = screen.getByPlaceholderText("e.g. MSc Public Health");
      await user.type(titleInput, "Temporary Programme");
      expect(screen.getByDisplayValue("Temporary Programme")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Clear" }));

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Clear this mapping?"));
      expect(screen.queryByDisplayValue("Temporary Programme")).not.toBeInTheDocument();
    });

    it("does not clear state if user cancels confirmation", async () => {
      const user = userEvent.setup();
      vi.spyOn(window, "confirm").mockReturnValue(false);

      render(<App />);

      const titleInput = screen.getByPlaceholderText("e.g. MSc Public Health");
      await user.type(titleInput, "Retained Programme");

      await user.click(screen.getByRole("button", { name: "Clear" }));

      expect(screen.getByDisplayValue("Retained Programme")).toBeInTheDocument();
    });
  });

  describe("6. Export and import workflows", () => {
    it("exports JSON with expected payload structure and analytics", async () => {
      const user = userEvent.setup();

      let createdBlob: Blob | null = null;
      let downloadFilename = "";
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;

      URL.createObjectURL = vi.fn((blob: Blob) => {
        createdBlob = blob;
        return "blob:mock-url";
      });
      URL.revokeObjectURL = vi.fn();

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
        downloadFilename = this.download;
      });

      render(<App />);

      // Fill in title and tag Ethics
      const titleInput = screen.getByPlaceholderText("e.g. MSc Public Health");
      await user.type(titleInput, "Data Science MSc");
      await user.click(screen.getByRole("button", { name: "Ethics" }));

      await user.click(screen.getByRole("button", { name: "Export JSON" }));

      expect(downloadFilename).toMatch(/^data-science-msc-.*\.json$/);
      expect(createdBlob).not.toBeNull();

      if (createdBlob) {
        const text = await (createdBlob as Blob).text();
        const payload = JSON.parse(text);
        expect(payload.tool).toBe(TOOL_NAME);
        expect(payload.programme.programmeTitle).toBe("Data Science MSc");
        expect(payload.items).toHaveLength(1);
        expect(payload.analytics).toBeDefined();
        expect(payload.analytics.totalItems).toBe(1);
        expect(payload.analytics.weightedCoverage.ethics).toBe(2); // Medium default = 2
      }

      clickSpy.mockRestore();
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it("exports Markdown containing headings, snapshot table, and QA items", async () => {
      const user = userEvent.setup();

      let markdownContent = "";
      let downloadFilename = "";
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;

      URL.createObjectURL = vi.fn(() => {
        return "blob:mock-url";
      });
      URL.revokeObjectURL = vi.fn();

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
        downloadFilename = this.download;
      });

      // Capture Blob created
      const originalBlob = globalThis.Blob;
      globalThis.Blob = class extends originalBlob {
        constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          if (options?.type?.includes("text/markdown") && parts) {
            markdownContent = parts.map(String).join("");
          }
        }
      } as typeof Blob;

      render(<App />);

      const titleInput = screen.getByPlaceholderText("e.g. MSc Public Health");
      await user.type(titleInput, "Bioinformatics Core");
      await user.click(screen.getByRole("button", { name: "Practice" }));

      await user.click(screen.getByRole("button", { name: "Export Markdown" }));

      expect(downloadFilename).toMatch(/^bioinformatics-core-.*\.md$/);
      expect(markdownContent).toContain("# Bioinformatics Core");
      expect(markdownContent).toContain(`**Tool:** ${TOOL_NAME}`);
      expect(markdownContent).toContain("## Coverage intensity snapshot");
      expect(markdownContent).toContain("## Key observations");
      expect(markdownContent).toContain("## Mapping items (QA-ready view)");
      expect(markdownContent).toContain("### Modules");

      clickSpy.mockRestore();
      globalThis.Blob = originalBlob;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it("imports valid JSON mapping file after confirmation", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);

      const importPayload = {
        tool: TOOL_NAME,
        exportedAt: new Date().toISOString(),
        programme: {
          programmeTitle: "Imported AI Strategy",
          awardLevel: "MBA",
          department: "Business School",
          institution: "Imperial",
          mappingDate: "2026-06-01",
          version: "v3.0",
        },
        items: [
          {
            id: "imp-1",
            type: "Module",
            name: "AI Strategy Module",
            notes: "Focus on governance and coagency",
            weight: "High",
            domains: {
              awareness: true,
              coagency: true,
              practice: false,
              ethics: true,
              governance: true,
              reflection: false,
            },
          },
        ],
      };

      const file = new File([JSON.stringify(importPayload)], "mapping.json", {
        type: "application/json",
      });

      render(<App />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByDisplayValue("Imported AI Strategy")).toBeInTheDocument();
      });
      expect(screen.getByDisplayValue("MBA")).toBeInTheDocument();
      expect(screen.getByDisplayValue("AI Strategy Module")).toBeInTheDocument();
    });

    it("shows alert for invalid JSON on import", async () => {
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

      const file = new File(["not valid json"], "corrupt.json", { type: "application/json" });

      render(<App />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith("That file could not be parsed as JSON.");
      });
    });

    it("normalizes incomplete items on import and prompts confirmation", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

      const file = new File([JSON.stringify({ programme: { programmeTitle: "Sparse Export" } })], "sparse.json", {
        type: "application/json",
      });

      render(<App />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Import this mapping?"));
      });
      expect(screen.getByDisplayValue("Sparse Export")).toBeInTheDocument();
    });
  });

  describe("7. Boundary and edge-case inputs", () => {
    it("handles boundary weights and item types during import normalization", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);

      const payloadWithUnknowns = {
        programme: {
          programmeTitle: 12345, // invalid title type
        },
        items: [
          {
            id: 999, // non-string id
            type: "UnknownType", // invalid type -> should coerce to Module
            weight: "UltraHigh", // invalid weight -> should coerce to Medium
            name: null, // invalid name
            notes: undefined,
            domains: "invalid domains", // invalid domains -> should fallback
          },
        ],
      };

      const file = new File([JSON.stringify(payloadWithUnknowns)], "edge.json", {
        type: "application/json",
      });

      render(<App />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        // Coerced to Module
        expect(screen.getByText("Module")).toBeInTheDocument();
      });

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.items[0].type).toBe("Module");
      expect(saved.items[0].weight).toBe("Medium");
      expect(saved.items[0].name).toBe("");
      expect(typeof saved.items[0].id).toBe("string");
    });
  });
});
