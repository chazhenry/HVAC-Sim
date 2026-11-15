# ToDo: EPA 608 exam-prep expansion

Assessment written 2026-11-14. The section below is a ready-to-use prompt: paste everything under
**Prompt** into a new Claude Code session in this repository when you are ready to expand the app's
EPA 608 scope. Re-check the "Current state" numbers first; they will drift as the app changes.

---

## Prompt

You are extending HVAC-Sim (this repository: React/TypeScript frontend in `frontend/`, FastAPI backend
in `backend/`) to be a credible **EPA Section 608 certification exam-prep tool**. The app must never
claim to certify anyone: only EPA-approved certifying organizations issue Section 608 cards. Keep the
existing wording that says so.

### Target: what the real exam is
- Four sections: **Core, Type I** (small appliances), **Type II** (high-pressure), **Type III**
  (low-pressure).
- **25 multiple-choice questions per section**, closed book.
- A section passes at **18 of 25 (72%)**. **Universal** = all four sections passed.

### Current state (as assessed, verify before starting)
- Question bank: `backend/app/exam.py`, **48 questions** in total: Core 20, Type I 8, Type II 12,
  Type III 8. Each has a prompt, choices, answer index and explanation. `PASS_FRACTION = 0.7`.
- Exam UI: `frontend/src/ui/Exam.tsx` (the EPA track in `frontend/src/ui/TrainingMenu.tsx`). Each
  section is a fixed quiz of every question in that section: no random draw, no timer, no topic
  breakdown, no Universal run. Best score per section is kept in training progress.
- Hands-on: one EPA practical scenario, `c-608-drier` ("EPA 608 practical: open the system",
  `backend/app/scenarios.py`). It walks through recovery to 0 psig into a recovery cylinder kept
  under 80% full, nitrogen pressure test through a regulator under nameplate test pressure (oxygen and
  shop air are offered as wrong choices), evacuation below 500 microns with a standing test, and
  weighing in the charge. The service cart is `frontend/src/ui/ServiceCart.tsx`, and the model is
  `frontend/src/sim/service.ts`. This is the app's strongest EPA content: keep it and build on it.
- The listing at `backend/app/equipment/registry/training.json` (`epaPracticalScenarioIds`) controls
  which scenarios appear on the EPA track.

### Coverage today, and the gaps

| Section | Covered now | Missing or thin |
|---|---|---|
| Core | Ozone depletion and ODP; recover / recycle / reclaim; 80% cylinder fill; venting prohibition; nitrogen via regulator (never oxygen or air); evacuation and micron gauge; cylinder pressure vs temperature; non-condensables; refrigerant sales; disposal basics | Montreal Protocol and Clean Air Act history; refrigerant classes and oils (mineral, alkylbenzene, POE); **A2L mildly flammable refrigerants (R-454B, R-32)** and their handling; shipping, labeling and DOT cylinder rules; recordkeeping; disposal paperwork; **AIM Act HFC rules** (reclaimed-refrigerant use, technician records, leak repair) |
| Type I | Small-appliance definition; 90% / 80% recovery by equipment date and compressor state; 4 in. Hg alternative; system-dependent recovery; piercing access valves | Hydrocarbon refrigerants (R-600a, R-290) and their safety; identifying the refrigerant; more recovery-procedure depth |
| Type II | Leak-rate triggers (comfort, commercial, industrial); 30-day repair deadline; 15 lb HFC threshold; required recovery vacuum examples; proper repair sequence; standing vacuum interpretation | Leak-detection methods (bubble solution, electronic detector, UV dye, standing pressure test); **full table of required recovery vacuum levels** by charge size and recovery-equipment date; liquid recovery and push-pull; charging blends (zeotropic glide, liquid charging); verification tests and leak records |
| Type III | Low-pressure definition; 25 mm Hg absolute evacuation; rupture disc; 10 psig leak-test limit; water circulation during evacuation; vapor-first charging | Purge units and their emissions; leak testing by heating water or adding nitrogen; recovering liquid first; more depth overall |

### Work to do, in this order

1. **Mock exam mode (small: about a day).**
   - For each section, draw a random **25-question paper** from that section's pool, shuffling
     question order and answer order. Pass at **18/25**: change `PASS_FRACTION` to 0.72, or better,
     grade on a count of 18.
   - Add an optional timer.
   - On the results page, show the score, pass/fail, every missed question with its explanation, and
     a **per-topic breakdown**. This needs a `topic` tag on each question.
   - Add a **Universal** run: all four sections in a row, with an overall verdict.
   - Keep a short "practice" mode (untimed, immediate feedback after each answer) alongside the mock.
   - Save the best mock score per section and Universal status in training progress, per user.
2. **Grow the question bank to about 100 questions per section (about 400 total).**
   - Do Core first (every certification type needs it), then Type II, Type I, Type III.
   - Give every question a topic tag, one correct answer, plausible wrong answers, and an
     explanation that teaches the rule (cite the regulation or the reason, not just the answer).
   - Cover every row of the gaps table above.
   - Move the bank to a data file if `exam.py` gets unwieldy (for example
     `backend/app/exam_bank/*.json`), with schema validation and a test that checks counts, unique ids,
     answer indexes in range and non-empty explanations.
   - **Accuracy matters more than volume:** use current EPA rules, including AIM Act changes effective
     in 2025 and 2026. Flag any question whose rule recently changed. Note in the file that a certified
     technician should review the bank.
3. **Current-regulations pass.** Review the existing 48 questions against the current rules (AIM Act,
   2025 R-410A phase-down for new residential equipment, A2L handling) and fix or replace anything
   outdated.
4. **Hands-on scenarios (optional: the app's edge, not needed to pass).** Add each to
   `epaPracticalScenarioIds` and grade it like `c-608-drier`.
   - **Leak search:** standing nitrogen pressure test, then bubble solution and an electronic detector
     to find a leak; record the leak and repair it.
   - **Small-appliance recovery (Type I):** a window unit or refrigerator with a piercing access valve;
     choose system-dependent vs self-contained recovery; meet 90%/80% or 4 in. Hg.
   - **Recovery-cylinder handling:** gray/yellow cylinder, fill limit by weight, labeling, never
     mixing refrigerants.
   - A Type III chiller scenario is the most expensive to build. Questions alone are enough for
     Type III unless there is time to spare.

### Done means
- Each section offers a randomized 25-question mock graded at 18/25, plus a Universal run, with a
  topic breakdown.
- The bank has about 100 reviewed-for-currency questions per section, with explanations, covering
  every gap above.
- Tests cover exam paper generation (random draw, no duplicates, 25 per paper), grading at 18/25,
  bank validity, and any new scenarios' grading.
- The "does not certify" notice is still shown on the EPA track.

Work in small, reviewable steps (mock mode first, then one section of questions at a time). Run the
backend and frontend test suites after each step, and check the exam UI in the browser.
