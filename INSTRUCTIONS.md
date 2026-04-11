# AI Capability Programme Mapping — User Instructions

---
### 2. What This Tool Does
This application maps the density and distribution of AI capabilities across an entire academic programme. It visualizes exactly how much "exposure" students have to AI skills (like Ethics or Co-agency) as they progress through their degree.

---
### 3. Role in the Ecosystem
- **Phase:** Phase 3 — Capability System
- **Role:** Estimating coverage and exposure across full curricula.
- **Reference:** [../SYSTEM_OVERVIEW.md](../SYSTEM_OVERVIEW.md)

---
### 4. When to Use This Tool
- To verify that students are systematically exposed to AI literacy before graduation.
- To ensure there isn't an imbalance (e.g., heavy focus on Practice with zero exposure to Ethics).
- When a professional body requires evidence that AI competency is mapped into the programme structure.

---
### 5. Inputs
- An aggregated curriculum schema (JSON) containing all modules, their credit weights, and tagged capability domains.

---
### 6. How to Use (Step-by-Step)
1. Load the programme mapping dataset.
2. View the overall percentage distribution of the 6 core capabilities.
3. Review the visual matrix to see *where* those capabilities are taught (e.g., clustered in Year 1 vs distributed evenly).
4. Review the "Key Risk Signals" to identify warnings like "Ethics taught but never assessed."
5. Export the visualization for inclusion in the formal programme specification document (Research Object Template).

---
### 7. Key Outputs
- A clear visual map of where and how AI capability is structured within a student's journey.
- Specific warnings if critical domains are under-represented relative to others.

---
### 8. How It Connects to Other Tools
- **Upstream:** Built using the structural map formed in the **Curriculum Alignment Mapping Engine**.
- **Downstream:** Provides data that informs the final publication via the **Research Object Template**.

---
### 9. Limitations
- Maps intent, not reality; it assumes that what is tagged on the module specification is actually taught in the classroom.
- It is a coverage estimator, not a student grading system.

---
### 10. Tips
- Look out for "ghost modules" where AI is tagged as a capability but carries 0% assessment weight — students will likely ignore this capability.
