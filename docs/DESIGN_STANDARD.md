# CloudPedagogy Tools  
## Internal Design Standard

**Status:** Canonical  
**Audience:** CloudPedagogy tool developers (internal)  
**Applies to:** All AI Capability tools (current and future)

---

## Purpose of this document

This standard ensures that all CloudPedagogy tools form a **coherent capability system**, not a collection of disconnected apps.

It defines the **shared UI structure, language rules, framing principles, and architectural constraints** that apply to every tool.

This is an **internal build standard**, not marketing copy.

---

## 1. Design intent (non-negotiable)

All tools must feel:

- Calm  
- Serious  
- Reflective  
- Trustworthy  
- Non-performative  

These are **thinking environments**, not productivity hacks or “AI assistants”.

Avoid:
- Gamification
- Conversational or chatty UX
- Marketing language
- Claims of optimisation, automation, or certainty

---

## 2. Canonical app structure

Every tool must follow the same **five-part layout**:

1. Header  
2. Purpose  
3. Activity  
4. Output  
5. Framing & Next Steps  

This structure must be recognisable across all tools.

---

## 3. Header standard

**Required**
- Tool name: `AI Capability + [Function]`
- One-line descriptive subtitle
- Quiet CloudPedagogy attribution

**Rules**
- No hero imagery
- No slogans
- No performance claims

---

## 4. Purpose block (mandatory)

Every tool must include this block near the top.

**Canonical text**

> **Purpose**  
> This tool supports reflective thinking and discussion. It does not provide definitive answers, recommendations, or compliance decisions.

Minor wording variation is acceptable; meaning is not.

---

## 5. Activity section

**Interaction rules**
- One cognitive task per screen
- Maximum five inputs per step
- Visible progress (e.g. “Step 2 of 4”)

**Tone**
- Explanatory, not instructional
- Invites consideration, not completion

---

## 6. Output structure (standardised)

All outputs must use the same internal structure:

1. Summary  
2. Key observations  
3. Capability lens (six domains)  
4. Reflection prompts  

Outputs must:
- Be indicative, not prescriptive
- Support discussion and judgement
- Avoid language implying correctness or compliance

---

## 7. AI Capability domains (canonical)

Domain names must **never vary**:

1. Awareness & Orientation  
2. Human–AI Co-Agency  
3. Applied Practice & Innovation  
4. Ethics, Equity & Impact  
5. Decision-Making & Governance  
6. Reflection, Learning & Renewal  

Each domain is presented as a **lens**, framed using “Consider…”.

No abbreviations.  
No app-specific renaming.

---

## 8. Language rules (strict)

### Approved phrasing
- “This suggests that…”
- “This may indicate…”
- “In this context, it may be useful to consider…”
- “One potential implication is…”

### Prohibited phrasing
- “You should…”
- “The correct approach is…”
- “This guarantees…”
- “Optimise / supercharge / unlock”

Tone must remain **neutral, conditional, reflective**.

---

## 9. Visual principles

- Neutral background
- Single accent colour
- Minimal chart palette
- Charts support interpretation, not judgement

Avoid:
- Alerts
- Bright status colours
- Over-visualisation

---

## 10. Framing footer (mandatory)

Every tool must end with a limitations block.

**Canonical text**

> **Use and limitations**  
> This tool is designed to support reflective practice and informed discussion. It does not replace professional judgement, institutional policy, or formal governance processes.

Optional **Next steps** may link to:
- Another tool
- The free course
- Framework resources

No sales language.

---

## 11. Architectural constraints

- Static, client-side by default  
- No accounts  
- No required backend  
- Local or session storage only  

This supports trust, low friction, longevity, and simple hosting (e.g. S3).

---

## 12. Guardrail question

Before shipping a tool, ask:

> *Does this help a thoughtful professional think more clearly about AI, without telling them what to do?*

If not, revise.

---
