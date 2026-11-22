// Ousa Chea's UX, Animation & Craft Audit: the 90 checks, each shown in the Audit app (/audit) as a
// live Before and After of the same element. The examples themselves are in components/audit.

export type AuditSectionId = 'core' | 'visual' | 'mobile' | 'type' | 'polish' | 'motion'

export interface AuditSection {
  id: AuditSectionId
  prefix: string
  title: string
}

/** How the example works: `play` animates (with a Play button to replay it), `try` is something to tap or drag */
export type AuditDemoKind = 'play' | 'try' | 'look'

export interface AuditCheck {
  id: string
  section: AuditSectionId
  title: string
  hint: string
  /** What's wrong in the Before example */
  before: string
  /** What the After example does instead */
  after: string
  kind: AuditDemoKind
  /** Only shows on a phone (keyboards, zoom, tap highlight) */
  phone?: boolean
}

export const AUDIT_SECTIONS: AuditSection[] = [
  { id: 'core', prefix: 'C', title: 'Core principles' },
  { id: 'visual', prefix: 'V', title: 'Visual details' },
  { id: 'mobile', prefix: 'M', title: 'Mobile & input' },
  { id: 'type', prefix: 'T', title: 'Typography' },
  { id: 'polish', prefix: 'P', title: 'Product & landing polish' },
  { id: 'motion', prefix: 'D', title: 'Motion details' }
]

type Row = [title: string, hint: string, before: string, after: string, kind: AuditDemoKind, phone?: 'phone']

// Per section, in order; ids (C1, C2…) come from the position
const ITEMS: Record<AuditSectionId, Row[]> = {
  core: [
    ['Squash & stretch', 'Pressed or landing elements deform slightly, so they feel elastic rather than rigid.', 'Lands like a rock', 'Squashes as it lands, then recovers', 'play'],
    ['Anticipation', 'A small wind-up motion comes before the main action, such as a dip before a jump.', 'Jumps with no warning', 'Dips first, then jumps', 'play'],
    ['Staging the focus', 'Motion pulls attention to the one thing that matters on screen right now.', 'Everything moves, so nothing stands out', 'Only the new item moves', 'play'],
    ['Pose to pose', 'Key states are designed deliberately, and transitions only connect them.', 'Grows, then moves: awkward in-between', 'One move between two designed states', 'play'],
    ['Follow through', 'Elements settle into place instead of stopping dead at the end of a move.', 'Stops dead', 'Settles into place', 'play'],
    ['Slow in & slow out', 'Motion uses easing curves, never linear timing.', 'Linear: robotic', 'Eases in and out', 'play'],
    ['Moving in arcs', 'Objects travel along natural curved paths, not straight diagonal lines.', 'Straight diagonal line', 'A natural curve', 'play'],
    ['Secondary action', 'A small supporting motion enriches the main one without stealing focus.', 'The heart just changes colour', 'A small burst backs it up', 'try'],
    ['Snappy timing', 'UI motion runs fast, roughly 150–300 ms.', '900 ms: feels slow', '200 ms: feels instant', 'play'],
    ['Exaggerated feedback', 'Success, error and press states are clear and hard to miss.', 'Did it save? Hard to tell', 'Clearly saved', 'try'],
    ['Solid drawing in 3D', 'Depth, shadows and layering are consistent across the product.', 'Shadows fall every which way', 'One light source for everything', 'look'],
    ['Overall appeal', 'The product feels polished, has personality and stays visually consistent.', 'Mismatched and cramped', 'Polished and consistent', 'look'],
    ['Fitts’s law', 'Important targets are large and close to the cursor, thumb or current focus.', 'A tiny button, far away', 'Big buttons right under the question', 'look'],
    ['Bigger hit areas', 'Tap and click targets are at least 44×44 pt (48 dp), with space between them.', 'Hit area: 18px (dashed)', 'Hit area: 44px, same icon', 'try'],
    ['Hick’s law', 'Choices are limited or grouped, so decisions are quick.', 'Ten choices at once', 'Three, and the rest under More', 'look'],
    ['Miller’s law', 'Information is chunked, so working memory isn’t overloaded.', 'One long string of digits', 'Chunked into groups', 'look'],
    ['Doherty threshold', 'The UI responds within about 400 ms, or shows feedback while it works.', 'Nothing happens for 1.5 s', 'Responds at once, then loads', 'try'],
    ['Postel’s law', 'Input is accepted liberally (spaces, formats, pastes); output stays strict and clean.', 'Rejects “$1,000.50”', 'Understands it as 1,000.50', 'try'],
    ['Jakob’s law', 'Patterns follow conventions people already know from other products.', 'Cart left, logo right: where is everything?', 'Logo left, search and cart right', 'look'],
    ['Frequency of use', 'The most-used actions are easiest to reach; rare ones are tucked away.', 'Compose is hidden in a menu', 'Compose up front; Settings tucked away', 'look']
  ],
  visual: [
    ['Concentric radius', 'Nested rounded corners share a common centre.', 'Same radius inside and out: corners pinch', 'Inner radius shrinks by the padding', 'look'],
    ['Alpha borders', 'Borders use transparency, so they adapt to any background.', 'Solid grey: dirty on colour', 'See-through: fits every background', 'look'],
    ['OKLCH palettes', 'Colour scales are built in OKLCH, for even perceived lightness.', 'HSL at 50%: yellow glares, blue sinks', 'OKLCH at 65%: even to the eye', 'look'],
    ['OKLCH gradients', 'Gradients interpolate in OKLCH, so midpoints don’t turn muddy.', 'sRGB: grey in the middle', 'OKLCH: stays vivid', 'look'],
    ['Matched icon weight', 'Icon stroke weight matches the weight of the text next to it.', 'Hairline icon beside bold text', 'Stroke matches the text', 'look'],
    ['Masked edges', 'Scroll areas fade at their edges instead of being cut off hard.', 'Cut off hard', 'Fades at the edge', 'try'],
    ['Blurred icon swaps', 'Icon changes crossfade with a slight blur and scale.', 'Snaps from one icon to the next', 'Crossfades with a slight blur', 'try'],
    ['Dark mode depth', 'In dark mode, raised surfaces get lighter, rather than relying on shadows alone.', 'Black shadows vanish on black', 'Raised surfaces get lighter', 'look'],
    ['Dynamic viewport', 'Layouts use dvh or svh, so mobile browser bars don’t break them.', '100vh: the button hides under the bar', '100dvh: the button stays in view', 'look'],
    ['Multiply blending', 'Shadows and images on coloured backgrounds use the multiply blend mode.', 'A white box round the product', 'Multiply drops the white', 'look']
  ],
  mobile: [
    ['16px inputs', 'Input text is 16px or larger, so iOS doesn’t zoom in on focus.', '13px: iPhone zooms in when you tap', '16px: no zoom', 'try', 'phone'],
    ['No tap highlight', 'The default tap flash is removed and replaced by a designed pressed state.', 'A grey flash, no real pressed state', 'No flash; it presses in', 'try', 'phone'],
    ['Numeric inputmode', 'Number-only fields open the numeric keypad.', 'Full keyboard for a code', 'Number pad', 'try', 'phone'],
    ['Hover media query', 'Hover styles sit inside @media (hover: hover), so they don’t stick on touch.', 'Stays highlighted after a tap', 'Goes back to normal', 'try'],
    ['OTP autofill', 'One-time-code fields use autocomplete="one-time-code" to fill from SMS.', 'Type the code by hand', 'iPhone offers the code from Messages', 'try', 'phone'],
    ['Overscroll contain', 'Modals and sheets don’t scroll the page behind them.', 'Scroll past the end: the page moves', 'The page stays put', 'try'],
    ['Email input type', 'Email fields use type="email", which brings up the email keyboard.', 'Plain keyboard, no @', 'Email keyboard with @', 'try', 'phone'],
    ['No double-tap zoom', 'Controls set touch-action: manipulation.', 'Tap twice fast: the page may zoom', 'Every tap counts', 'try', 'phone'],
    ['Enter key hint', 'The return key is labelled for the action: Next, Search, Go.', 'Return key says “return”', 'Return key says “search”', 'try', 'phone'],
    ['Scroll snap', 'Carousels and pickers snap cleanly to each item.', 'Stops halfway through a card', 'Snaps to each card', 'try']
  ],
  type: [
    ['Reserved bold width', 'Bold or active states (tabs, for example) don’t shift the layout.', 'Tabs jump when one turns bold', 'Width is reserved: nothing moves', 'try'],
    ['Text-box trim', 'Extra leading is trimmed, so text aligns to its cap height and baseline.', 'Extra space above: text sits low', 'Trimmed: centred on its letters', 'look'],
    ['Underline offset', 'Underline offset and thickness are tuned so descenders aren’t clipped.', 'Cuts through g, y and p', 'Clear of the descenders', 'look'],
    ['Superscript spacing', 'Superscripts and footnote marks don’t stretch the line height.', 'The mark pushes its line apart', 'Lines stay evenly spaced', 'look'],
    ['Fluid type', 'Type scales smoothly with the viewport, using clamp(), instead of jumping.', 'Jumps at a breakpoint', 'Scales smoothly', 'try'],
    ['Small caps acronyms', 'Long acronyms are set in small caps, so they don’t shout.', 'CAPITALS SHOUT', 'Small caps sit with the text', 'look'],
    ['Curly quotes', 'Text uses typographic quotes and apostrophes, not straight ones.', 'Straight "quotes" and it\'s', 'Curly “quotes” and it’s', 'look'],
    ['Middle truncation', 'Filenames and IDs are cut in the middle, so their endings stay visible.', 'The end, and the version, are lost', 'The ending stays visible', 'look'],
    ['Auto hyphenation', 'Narrow columns hyphenate, so they don’t leave ragged gaps.', 'Big ragged gaps', 'Long words break neatly', 'look'],
    ['Line-clamped titles', 'Long titles are clamped to a set number of lines.', 'A long title takes over the card', 'Clamped to two lines', 'look']
  ],
  polish: [
    ['Delete filler badges', 'Badges and pills that add no information are removed.', 'Five badges, none useful', 'One that tells you something', 'look'],
    ['Drop redundant labels', 'Labels that repeat what’s already obvious are removed.', 'Says “email” four times', 'Says it once', 'look'],
    ['Unitalicize random words', 'There’s no scattered italic emphasis.', 'Italics everywhere', 'Calm, even text', 'look'],
    ['Mono only where needed', 'Monospace is used only for code and data.', 'Everything in mono', 'Mono only for the order number', 'look'],
    ['Use a design system', 'Components, tokens and spacing all come from one system.', 'Three buttons, three styles', 'One button style', 'look'],
    ['Show the actual product', 'Real UI and screenshots, not abstract illustrations.', 'Abstract blobs', 'The real screen', 'look'],
    ['Enlarge the main feature', 'The key feature gets the most visual weight.', 'Everything the same size', 'The main feature is biggest', 'look'],
    ['Group with spacing', 'Related items are grouped by whitespace rather than boxes and dividers.', 'Boxes and lines everywhere', 'Grouped by space', 'look'],
    ['Make headlines specific', 'Headlines state a concrete benefit, not a vague claim.', 'A vague promise', 'A concrete benefit', 'look'],
    ['Emphasize the CTA', 'The primary action is the clearest element on the screen.', 'Three equal buttons', 'One clear primary', 'look'],
    ['Add an accent colour', 'One deliberate accent colour is used for key actions.', 'Four colours fighting', 'One accent', 'look'],
    ['Keep icons consistent', 'Icons share one style, weight, size and corner treatment.', 'Outline, emoji, filled and thin', 'One set, one weight', 'look'],
    ['Remove embellishments', 'Decoration that doesn’t serve the content is cut.', 'Sparkles, glow, gradients', 'Just the content', 'look'],
    ['Inner radius = outer - padding', 'Nested corner radii are calculated, not guessed.', '24 inside 24, with 8 padding', '16 inside 24: 24 − 8', 'look'],
    ['Improve text contrast', 'Text meets WCAG AA: 4.5:1 for body text, 3:1 for large text.', '1.8:1: hard to read', '6.6:1: easy to read', 'look'],
    ['Wrap headlines properly', 'Headlines have balanced line breaks, with no orphans or widows.', 'One word left alone', 'Balanced lines', 'look'],
    ['Align by eye, not pixels', 'Icons, play buttons and text are aligned optically.', 'Centred by the box: looks off to the left', 'Nudged right: looks centred', 'look'],
    ['Use tabular nums', 'Numbers in tables and counters use tabular figures.', 'Digits change width: it jiggles', 'Every digit the same width', 'play'],
    ['Add loading state', 'Every async action and screen has a loading state.', 'Blank, then it pops in', 'A skeleton holds the place', 'try'],
    ['Animate useful feedback', 'Motion confirms an action or a change of state; it isn’t decoration.', 'Bounces for no reason; Add says nothing', 'Still until it matters; Add confirms', 'try']
  ],
  motion: [
    ['Ease-out for entrances', 'Elements that enter use an ease-out curve.', 'Ease-in: slow to start', 'Ease-out: arrives fast, lands soft', 'play'],
    ['Dropdowns at 150-250ms', 'Dropdown and menu transitions stay within 150–250 ms.', '600 ms each way', '200 ms in, 160 ms out', 'play'],
    ['Stagger list rows by 30ms', 'List rows cascade in about 30 ms apart.', 'All rows at once', 'Rows cascade, 30 ms apart', 'play'],
    ['Scale to 0.97 on press', 'Pressable elements scale down slightly, to about 0.97, while pressed.', 'Doesn’t react to a press', 'Presses in to 0.97', 'try'],
    ['Stretch moving knobs 12%', 'Switch and slider knobs stretch about 12% while they move.', 'The knob slides stiffly', 'It stretches as it moves', 'try'],
    ['Stagger as details settle', 'Secondary details arrive after the main element.', 'Everything at once', 'Card first, then its details', 'play'],
    ['Arcs for object movement', 'Objects travel along curves, not straight lines.', 'Flies to the cart in a straight line', 'Arcs into the cart', 'play'],
    ['Pulse to confirm success', 'A brief pulse confirms a completed action.', 'Just appears', 'A brief pulse confirms it', 'play'],
    ['Ease-in-out for moves', 'Movement between two on-screen positions uses ease-in-out.', 'Linear: mechanical', 'Ease-in-out: natural', 'play'],
    ['Start popovers at 0.95', 'Popovers scale in from about 0.95, never from 0.', 'Grows from nothing', 'Starts at 0.95', 'play'],
    ['Enter from the trigger', 'Popovers and menus grow out of the element that opened them.', 'Grows from its own middle', 'Grows from the button', 'play'],
    ['Exit to the trigger', 'They shrink back into their trigger when they close.', 'Shrinks to its own middle', 'Returns to the button', 'play'],
    ['No bounce on everyday UI', 'Bounce and overshoot are kept for playful moments only.', 'A menu that bounces', 'A menu that just opens', 'play'],
    ['Don’t tween while held', 'While dragging or holding, elements follow the finger or cursor directly.', 'Lags behind your finger', 'Sticks to your finger', 'try'],
    ['Make exits 20% shorter', 'Exit animations run about 20% faster than entrances.', 'Leaves as slowly as it came', 'Leaves faster than it came', 'play'],
    ['Overlap old & new states', 'Outgoing and incoming states overlap, rather than waiting for each other.', 'Old fades out, a gap, then new', 'Old and new crossfade', 'play'],
    ['Masks for reveals & colour', 'Reveals and colour changes use masks or clipping, not plain fades.', 'A plain fade', 'Wiped in by a mask', 'play'],
    ['Crossfade icons + blur', 'Icon swaps crossfade with a slight blur.', 'Snaps between sun and moon', 'Crossfades with a blur', 'try'],
    ['Rubber band past bounds', 'Dragging past a limit meets elastic resistance.', 'Hits a wall', 'Stretches, then springs back', 'try'],
    ['Reuse the same layoutId', 'Shared elements keep one layout ID, so they morph between states.', 'Cuts to the big view', 'The same image grows into place', 'try']
  ]
}

export const AUDIT_CHECKS: AuditCheck[] = AUDIT_SECTIONS.flatMap(s =>
  ITEMS[s.id].map(([title, hint, before, after, kind, phone], i) => ({
    id: `${s.prefix}${i + 1}`, section: s.id, title, hint, before, after, kind, ...(phone && { phone: true })
  }))
)
