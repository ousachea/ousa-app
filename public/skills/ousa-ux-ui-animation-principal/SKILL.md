---
name: "ousa-ux-ui-animation-principal"
description: "Audit a product, screen, or prototype against 90 UX, animation, mobile, typography, and polish checks and track which are applied, partial, or missing. Use for design reviews, handoff checks, or project status."
---

# Ousa Chea's UX, Animation & Craft Audit

**Author:** Ousa Chea | **Framework:** UX-UI Animation Principles

Include the author and framework line in the header of every audit report.

Check a project against the six checklists below and report which items are **applied** and which are **not**, so progress can be tracked across projects.

## Inputs
Ask for (or infer from what's shared): the project name, the screens/flows in scope, the platform (web, iOS/Android, desktop), and the source (Figma link, screenshots, live URL, prototype, or code). If a prior audit exists for the same project, load it and show what changed.

The user can run all six sections or only some (e.g. skip Section 3 for a desktop-only product). Sections that don't apply are marked N/A as a whole.

## Section 1: Core UX & animation principles (C1-C20)
### Animation (motion feel)
- C1 **Squash & stretch**: elements deform slightly to feel elastic (e.g. button press).
- C2 **Anticipation (wind-up)**: a small preparatory motion before the main action.
- C3 **Staging (the focus)**: motion directs attention to the one thing that matters.
- C4 **Pose to pose**: key states are defined deliberately; transitions connect them.
- C5 **Follow through**: elements overshoot/settle instead of stopping dead.
- C6 **Slow in & slow out**: easing curves, not linear motion.
- C7 **Moving in arcs**: natural curved paths rather than straight lines.
- C8 **Secondary action**: small supporting motion that enriches the main one.
- C9 **Snappy timing**: fast UI motion, roughly 150-300 ms.
- C10 **Exaggerated feedback**: clear, noticeable response to input (success, error, press).
- C11 **Solid drawing in 3D**: consistent depth, shadows, layering, perspective.
- C12 **Overall appeal**: polish, personality, visual consistency.
### UX laws (usability)
- C13 **Fitts's law**: important targets are large and close to the user's attention/cursor/thumb.
- C14 **Bigger hit areas**: tap/click targets meet minimum size (about 44x44 pt / 48 dp) with spacing.
- C15 **Hick's law**: choices are limited or grouped to speed decisions.
- C16 **Miller's law**: information is chunked; working memory isn't overloaded.
- C17 **Doherty threshold**: responds within ~400 ms, or shows feedback/loading states.
- C18 **Postel's law**: liberal in accepted input, strict in output.
- C19 **Jakob's law**: follows conventions users know from other products.
- C20 **Frequency of use**: most-used actions are easiest to reach; rare ones are tucked away. (A heuristic, not a formal law.)

## Section 2: Visual details (V1-V10)
- V1 **Concentric radius**: nested rounded corners share a common center.
- V2 **Alpha borders**: borders use transparency so they adapt to any background.
- V3 **OKLCH palettes**: colour scales built in OKLCH for even perceived lightness.
- V4 **OKLCH gradients**: gradients interpolated in OKLCH to avoid muddy midpoints.
- V5 **Matched icon weight**: icon stroke weight matches adjacent text weight.
- V6 **Masked edges**: scroll areas fade at the edges instead of hard-clipping.
- V7 **Blurred icon swaps**: icon changes crossfade with a slight blur/scale.
- V8 **Dark mode depth**: elevation shown with lighter surfaces, not shadows alone.
- V9 **Dynamic viewport**: uses dvh/svh rather than vh so mobile browser bars don't break layout.
- V10 **Multiply blending**: multiply blend used for shadows/images sitting on coloured backgrounds.

## Section 3: Mobile & input craft (M1-M10)
- M1 **16px inputs**: input font size is at least 16px so iOS doesn't zoom on focus.
- M2 **No tap highlight**: default tap highlight removed and replaced with a designed pressed state.
- M3 **Numeric inputmode**: number-only fields open the numeric keypad.
- M4 **Hover media query**: hover styles wrapped so they don't stick on touch devices.
- M5 **OTP autofill**: one-time-code fields support autofill from SMS.
- M6 **Overscroll contain**: modals/sheets don't scroll the page behind them.
- M7 **Email input type**: email fields use the email type/keyboard.
- M8 **No double-tap zoom**: double-tap zoom disabled on controls (touch-action: manipulation).
- M9 **Enter key hint**: keyboard return key labelled for the action (Next, Search, Go).
- M10 **Scroll snap**: carousels and pickers snap to items.

## Section 4: Typography (T1-T10)
- T1 **Reserved bold width**: bold/active states don't cause layout shift (e.g. tabs).
- T2 **Text-box trim**: extra leading space trimmed so text aligns to cap height/baseline.
- T3 **Underline offset**: underline offset and thickness tuned so descenders aren't clipped.
- T4 **Superscript spacing**: superscripts/footnote marks don't disturb line height.
- T5 **Fluid type**: type scales smoothly with viewport (clamp) instead of jumping.
- T6 **Small caps acronyms**: long acronyms set in small caps to reduce shouting.
- T7 **Curly quotes**: typographic quotes and apostrophes, not straight ones.
- T8 **Middle truncation**: filenames/IDs truncate in the middle so endings stay visible.
- T9 **Auto hyphenation**: hyphenation enabled for narrow columns.
- T10 **Line-clamped titles**: long titles clamp to a set number of lines.

## Section 5: Product & landing polish (P1-P20)
- P1 **Delete filler badges**: remove badges/pills that add no information.
- P2 **Drop redundant labels**: remove labels that repeat what's already obvious.
- P3 **Unitalicize random words**: no scattered italics for emphasis.
- P4 **Mono only where needed**: monospace limited to code/data.
- P5 **Use a design system**: components, tokens, and spacing come from one system.
- P6 **Show the actual product**: real UI/screenshots instead of abstract illustrations.
- P7 **Enlarge the main feature**: the key feature gets the most visual weight.
- P8 **Group with spacing**: related items grouped by whitespace rather than boxes/dividers.
- P9 **Make headlines specific**: headlines state a concrete benefit, not vague claims.
- P10 **Emphasize the CTA**: the primary action is the clearest element on the screen.
- P11 **Add an accent colour**: one deliberate accent used for key actions.
- P12 **Keep icons consistent**: same style, weight, size, and corner treatment.
- P13 **Remove embellishments**: decoration that doesn't serve the content is cut.
- P14 **Inner radius = outer - padding**: nested corner radii calculated, not guessed.
- P15 **Improve text contrast**: text meets WCAG contrast (4.5:1 body, 3:1 large).
- P16 **Wrap headlines properly**: balanced line breaks, no orphans/widows.
- P17 **Align by eye, not pixels**: optical alignment for icons, play buttons, and text.
- P18 **Use tabular nums**: numbers in tables/counters use tabular figures.
- P19 **Add loading state**: every async action/screen has a loading state.
- P20 **Animate useful feedback**: motion confirms an action or state change, not decoration.

## Section 6: Motion details (D1-D20)
- D1 **Ease-out for entrances**: elements entering use ease-out.
- D2 **Dropdowns at 150-250 ms**: dropdown/menu transitions stay in this range.
- D3 **Stagger list rows by 30 ms**: list items cascade with about 30 ms offsets.
- D4 **Scale to 0.97 on press**: pressable elements scale down slightly on press.
- D5 **Stretch moving knobs 12%**: switch/slider knobs stretch about 12% while moving.
- D6 **Stagger as details settle**: secondary details arrive after the main element.
- D7 **Arcs for object movement**: objects travel along curves, not straight lines.
- D8 **Pulse to confirm success**: a brief pulse confirms a completed action.
- D9 **Ease-in-out for moves**: on-screen movement between positions uses ease-in-out.
- D10 **Start popovers at 0.95**: popovers scale in from about 0.95, not from 0.
- D11 **Enter from the trigger**: popovers/menus originate at the element that opened them.
- D12 **Exit to the trigger**: they return to the trigger when closing.
- D13 **No bounce on everyday UI**: bounce/overshoot reserved for playful moments.
- D14 **Don't tween while held**: elements follow the finger/cursor directly during drag or hold.
- D15 **Make exits 20% shorter**: exit animations run about 20% faster than entrances.
- D16 **Overlap old & new states**: outgoing and incoming states overlap instead of waiting.
- D17 **Masks for reveals & colour**: reveals and colour changes use masks/clip rather than fades.
- D18 **Crossfade icons + blur**: icon swaps crossfade with a slight blur.
- D19 **Rubber band past bounds**: dragging past limits resists elastically.
- D20 **Reuse the same layoutId**: shared elements keep one layout ID so they morph between states.

Note: some items overlap across sections (e.g. C7/D7 arcs, V1/P14 radius, V7/D18 icon swaps). Score each ID on its own, but flag the overlap when reporting.

## Process
1. Confirm scope (screens/flows, platform, which sections).
2. For each item in scope, assign a status with a one-line piece of evidence (what you saw, where):
   - ✅ Applied
   - 🟡 Partial
   - ❌ Not applied
   - ➖ N/A (say why; e.g. no animation in a static spec)
3. Don't guess. If something can't be judged from the material (e.g. timing in a static mockup), mark it **Unknown** and say what's needed to verify.
4. Summarize per section and overall.

## Output format

**Project:** <name> | **Date:** <date> | **Platform:** <platform> | **Scope:** <screens/flows>

One table per section in scope:

| ID | Item | Status | Evidence / note |
|----|------|--------|-----------------|
| C1 | Squash & stretch | ❌ | Buttons have no press state |
| ... | ... | ... | ... |

**Scorecard:**

| Section | Applied | Partial | Not applied | Unknown | N/A |
|---------|---------|---------|-------------|---------|-----|
| 1 Core (20) | | | | | |
| 2 Visual (10) | | | | | |
| 3 Mobile (10) | | | | | |
| 4 Type (10) | | | | | |
| 5 Polish (20) | | | | | |
| 6 Motion (20) | | | | | |
| **Total (90)** | | | | | |

**Top gaps (prioritized):** the 5 missing or partial items with the highest user impact, each with a concrete fix. Prioritize anything that causes functional problems (e.g. M1 input zoom, C17 no loading feedback, P15 contrast) over cosmetic polish.

**Changes since last audit:** (only if a prior audit exists)

## Tracking across projects
When asked to compare projects, output one matrix: rows = IDs, columns = projects, cells = ✅/🟡/❌/➖. Add a totals row. Offer to put it in a Sheet so it can be updated over time.

## Tone
Be specific and practical. Point to the exact screen or element. Don't pad; the tables are the deliverable.