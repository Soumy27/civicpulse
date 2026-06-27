# CivicPulse — Project Description

> Report once. The AI handles the rest.

**Live app:** _[Cloud Run URL — add after deploy]_
**Repository:** https://github.com/Soumy27/civicpulse

---

## Problem Statement Selected

**Community Hero — Hyperlocal Problem Solver.**

Communities constantly face potholes, water leakages, damaged streetlights, waste
management gaps, and other public-infrastructure failures. Today, reporting these
issues is fragmented, hard to track, and opaque. Citizens file a complaint into a
black box, never hear back, and stop reporting. The work of chasing a resolution
falls entirely on the citizen.

CivicPulse addresses this by making reporting effortless **and** by removing the
follow-up burden from the citizen entirely: an autonomous AI agent does the
chasing, escalating, and de-duplicating on its own.

---

## Solution Overview

CivicPulse is a full-stack platform where a citizen reports an issue in about 45
seconds (photo → location → confirm), and an **autonomous AI Resolution Agent**
takes it from there.

The agent runs a multi-step reasoning loop on Gemini with function calling. It
monitors every open issue, checks its own memory of what it already tried,
decides the correct action per a strict rule set, and acts — escalating to the
right department, merging duplicates, requesting better evidence, flagging
low-confidence reports for human review, or closing dead issues. Every decision
is logged with full reasoning to a live activity feed, so the process is
transparent and accountable.

Three capabilities set it apart from existing civic platforms:

1. **Predictive hotspot alerts** — the agent detects recurring problem zones from
   90 days of resolved history and alerts the responsible department *before* the
   next complaint is filed.
2. **Agent self-correction** — when an escalation fails, the agent autonomously
   retries with a higher authority within the same reasoning cycle, with no human
   nudge.
3. **Live Civic Score** — a single 0–100 city-health metric, recalculated the
   moment any issue resolves.

---

## Key Features

- **Image-based AI reporting** — Gemini Vision classifies the photo into category,
  severity, responsible department, and a confidence score.
- **Autonomous Resolution Agent** — a 9-tool Gemini function-calling loop with
  Firestore-backed memory, strict decision rules, and visible self-correction.
- **Predictive insights** — clustering of resolved issues surfaces emerging
  hotspots and sends pre-emptive department alerts.
- **Geo-location & live map** — real-time Google Maps with category-coded pins and
  dashed markers for AI-predicted hotspots.
- **Community verification** — citizens corroborate reports; three verifications
  auto-confirm an issue. Users cannot verify their own report or verify twice.
- **Real-time tracking** — every issue has a status timeline and an agent-decision
  history; the whole UI updates live via Firestore snapshots.
- **Impact dashboard** — a city Civic Score plus per-ward health scores, category
  breakdowns, and resolution metrics.
- **Gamification** — XP for reporting and verifying, badge tiers, and a ward
  leaderboard to drive participation.
- **Predicted resolution time** — at report time, the app estimates a resolution
  window from the ward's history.
- **Citizen escalation drafts** — for stalled issues, Gemini drafts a polite,
  formal escalation message the reporter can send to a ward officer.

---

## Technologies Used

- **Frontend:** Next.js 14 (App Router), TypeScript (strict), Tailwind CSS,
  shadcn-style UI, Chart.js
- **Backend:** Next.js Route Handlers, Node runtime
- **Database & realtime:** Cloud Firestore (`onSnapshot` everywhere)
- **AI:** Gemini Flash via `@google/generative-ai` (vision + function calling)
- **Deployment:** Docker (multi-stage, `output: standalone`) on Google Cloud Run

---

## Google Technologies Utilized

CivicPulse is built deeply on the Google stack — **12 Google technologies**:

1. **Gemini Flash** — vision classification, the agent's reasoning, escalation
   drafting, and resolution-time prediction.
2. **Gemini function calling** — the 9-tool autonomous agent loop with memory and
   self-correction (the product core).
3. **Google Maps JavaScript API** — the live, real-time issue map.
4. **Google Maps Geocoding API** — GPS coordinates to human addresses.
5. **Google Places API** — address autocomplete in the report wizard.
6. **Cloud Natural Language API** — entity extraction (street names, landmarks)
   from issue descriptions.
7. **Cloud Firestore** — real-time database, live feeds, and agent memory.
8. **Firebase Authentication** — Google OAuth + anonymous sign-in.
9. **Firebase Storage** — issue photo upload and serving.
10. **Firebase Cloud Messaging** — push notifications to citizens and officers.
11. **Cloud Pub/Sub** — event-driven agent triggering on new-issue creation.
12. **Google Cloud Run** — containerized deployment in `asia-south1`.

---

## How it maps to the evaluation matrix

| Criterion | How CivicPulse delivers |
|---|---|
| **Problem Solving & Impact (20%)** | Removes the follow-up burden from citizens; a live Civic Score and ward dashboards show measurable improvement in real numbers. |
| **Agentic Depth (20%)** | A real multi-step Gemini agent: 6+ tool calls per cycle, Firestore-backed memory so it never repeats an action, and visible self-correction on failed escalations. |
| **Innovation & Creativity (20%)** | Predictive hotspot alerts, agent self-correction, and a live Civic Score — none of which exist in current civic platforms. |
| **Google Technologies (15%)** | 12 Google services integrated, with Gemini function calling as the core. |
| **Product Experience & Design (10%)** | A 45-second report flow, a polished landing page, real-time UI, and graceful degradation so a demo never shows an error screen. |
| **Technical Implementation (10%)** | TypeScript strict (zero `any`), a green production build, documented architecture, and a clean server/client module boundary. |
| **Completeness & Usability (5%)** | Every feature works against pre-seeded demo data via a one-command seed script. |
