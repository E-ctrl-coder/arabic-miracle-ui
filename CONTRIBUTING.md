# Contributing to the Arabic Morphology Analyzer (analyzer.elbagirdomain.com)

This document codifies the current scope, goals, constraints, and architectural guidelines for development. It serves as a non-negotiable context lock for this repository and must be honored in every contribution, fix, or feature addition.

## 🚀 Primary Objective
Deliver a browser-only, QAC-only Arabic morphology analyzer hosted at [analyzer.elbagirdomain.com](https://analyzer.elbagirdomain.com). This tool must be:
- Accessible: Usable by non-programmers with no terminal or setup required.
- Deterministic: Every analysis is reproducible and traceable to the dataset.
- Minimal: Only essential assets and files—no ambiguity, no clutter.
- Transparent: UI clearly reflects the source data with diagnostics and rationale.

## 📦 Dataset Rules
- Dataset: Only the QAC corpus is used. No Nemlar or other datasets.
- Data files in public/:  
  - `qac.txt`: line-oriented source reference  
  - `qac.json`: canonical structured asset loaded in-browser

### Expected qac.json fields:
| Field       | Description                                         |
|-------------|-----------------------------------------------------|
| `location`  | Surah:ayah:word identifier                         |
| `form`      | Surface Arabic form                                |
| `lemma`     | Dictionary form                                    |
| `root`      | Triliteral/quadriliteral root                      |
| `tag`       | POS/morphological tag                              |
| `features`  | Grammatical features (e.g., gender, case)          |
| `segments`  | `{ prefixes, stem, suffixes }` segmentation object |
| `gloss`     | Optional translation or gloss                      |

## 🧠 App Behavior
- Loads `/qac.json` via browser-only fetch (no servers, no CORS).
- UI features:
  - Arabic input box with real-time analysis
  - Result card: form, lemma, root, pattern, segmentation, POS, features, gloss, corpus locations
  - Normalization toggle
  - Diagnostics panel (e.g., entry count + parity with `qac.txt`)
- Always uses capped views and filters. Never renders full corpus at once.

## 🛡️ Guardrails
✅ Permitted:
- Add/remove files or code when justified by function, clarity, or hygiene
- Propose features if they improve transparency, performance, or UX

❌ Not permitted:
- New datasets without consent
- Architectural changes without explicit confirmation
- Unused or ambiguous code/assets

## 🗝️ Contribution Signals
- Messages starting with `**.` indicate instructions within this context lock.  
  These are prioritized and non-optional.

## ✨ Feature Suggestions
Contributors and Copilot may proactively suggest UX tricks or onboarding enhancements  
— so long as they uphold clarity, reproducibility, and non-programmer usability.

## ✅ Checklist for any contribution
- [ ] qac.json loads from `/qac.json` with HTTP 200
- [ ] `qac.json.length === qac.txt.length`
- [ ] Diagnostics panel confirms parity and fetch success
- [ ] No console errors
- [ ] UI is responsive, intuitive, and capped to avoid lock-ups

## 🧭 Milestone Acceptance
Milestone M1:
> analyzer.elbagirdomain.com loads qac.json, accepts Arabic input, and renders an analysis card with all primary fields—plus normalization toggle and diagnostics. No external dependencies.

Future milestones must define scope and acceptance criteria explicitly.

## 📌 Context lock enforcement
This file overrides implicit assumptions and governs the repo’s evolution.
Contributors must refer to it for guidance and alignment.
