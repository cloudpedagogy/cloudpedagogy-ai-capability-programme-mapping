# PROJECT_SPEC: cloudpedagogy-ai-capability-programme-mapping

## 1. Repo Name
`cloudpedagogy-ai-capability-programme-mapping`

## 2. One-Sentence Purpose
A specialized tool for mapping curriculum modules, activities, and assessments against the 6 CloudPedagogy capability domains.

## 3. Problem the App Solves
Difficulty in ensuring that complex academic programmes provide balanced coverage across all AI capability domains; prevents technical skills from crowding out ethics and governance.

## 4. Primary User / Audience
Programme leads, curriculum designers, and academic chairs.

## 5. Core Role in the CloudPedagogy Ecosystem
The "Resolution Layer"; maps at a higher granularity (including "Activities") than high-level dashboarding tools but with broader scope than content refactoring tools.

## 6. Main Entities / Data Structures
- **MapItem**: Represents a Module, Activity, or Assessment with associated capability domain flags.
- **ProgrammeDetails**: Metadata (Title, Award, Department) defining the mapping context.
- **ExportPayload**: The full serialized programme structure for import/export.
- **DomainKey**: Standard 6 domains (Awareness, Coagency, Practice, Ethics, Governance, Reflection).

## 7. Main User Workflows
1. **Define Programme**: Set institutional and award-level metadata.
2. **Populate Map**: Add modules and specific learning activities.
3. **Map Domains**: Explicitly toggle which of the 6 domains each item addresses.
4. **Analysis & Export**: Review coverage and export as JSON or Markdown for validation.

## 8. Current Features
- CRUD management for MapItems.
- Support for "Activity" as a first-class mapping entity.
- 6-domain boolean mapping interface.
- Local persistence via `localStorage`.
- Multi-format exports (JSON/Markdown).

## 9. Stubbed / Partial / Incomplete Features
- Not explicitly defined in repository documentation.

## 10. Import / Export and Storage Model
- **Storage**: Persistent local storage (`cloudpedagogy_programme_mapping_v1`).
- **Import/Export**: Robust JSON `ExportPayload` and human-readable Markdown.

## 11. Relationship to Other CloudPedagogy Apps
Produces the map of "Intended Capability" that can be compared against "Actual Capability" results in the `ai-capability-dashboard`.

## 12. Potential Overlap or Duplication Risks
High overlap with `programme-governance-dashboard`; distinguished by its "Activity-level" resolution and lack of deep operational audit logic.

## 13. Distinctive Value of This App
"Activity-level" mapping captures non-credit-bearing capability development that is often missed at the module level.

## 14. Recommended Future Enhancements
(Inferred) Visual "Heatmap" overlay to identify programme-wide domain gaps; synchronization with the `integration-sdk` format for cross-tool data flow.

## 15. Anything Unclear or Inferred from Repo Contents
Individual item weights (e.g., credit value impact) are inferred to be handled qualitatively in "Notes" rather than via numeric weighting in this prototype.
