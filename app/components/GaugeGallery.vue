<script setup lang="ts">
import { toast } from 'vue-sonner'

// Settings → Gauges: a reference for the gauge parts (components/gauge, lib/gauge.ts). One live example of
// each kind the apps use, more the parts can build, and the parts newly brought over from Gauge UI, all
// moved by one slider, with the code to copy and a table of the parts.
const { play } = useSound()
const level = ref(64) // 0–100: the slider, which sets every example
const animate = ref(true)
const p = computed(() => level.value / 100)
// Each example's own value (0–1). The slider moves them all together; a click, Shuffle or Play gives each its own
const vals = reactive<Record<string, number>>({})
watch(p, v => Object.keys(vals).forEach(k => (vals[k] = v)))
const valOf = (id: string) => vals[id] ?? p.value
function shuffle(id: string) {
  vals[id] = Math.round(Math.random() * 100) / 100
}
function shuffleOne(id: string) {
  shuffle(id)
  play('select')
}
function shuffleAll() {
  ;[...EXAMPLES, ...MORE, ...NEW].forEach(e => shuffle(e.id))
  play('select')
}
// Play: shuffle everything every couple of seconds, so you can watch them move
const playing = ref(false)
let playTimer: ReturnType<typeof setInterval> | undefined
function togglePlay() {
  playing.value = !playing.value
  clearInterval(playTimer)
  if (playing.value) {
    animate.value = true
    shuffleAll()
    playTimer = setInterval(() => [...EXAMPLES, ...MORE, ...NEW].forEach(e => shuffle(e.id)), 1800)
  }
  play(playing.value ? 'toggle-on' : 'toggle-off')
}
onBeforeUnmount(() => clearInterval(playTimer))
// What each example shows, in its own units, for the caption under it
const readout = (id: string) => {
  const v = valOf(id)
  if (id === 'zones') return `${Math.round(50 + v * 50)}%`
  if (id === 'centred') return `${(-2 + v * 4) >= 0 ? '+' : '−'}${Math.abs(-2 + v * 4).toFixed(2)}%`
  if (id === 'range') return `$${Math.round(4070 + v * 100).toLocaleString('en-US')}`
  if (id === 'clock') { const h = v * 12; return `${Math.floor(h) || 12}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}` }
  if (id === 'drain') return `${Math.round((1 - v) * 100)}% left`
  if (id === 'stack') return `${Math.round(v * 16 * 10) / 10} of 16 GB`
  if (id === 'inset') return `${Math.round(v * 200)} km/h · ${Math.round((1 - v) * 100)}% fuel`
  if (id === 'control') return `${Math.round(v * 100)} · drag the dial`
  if (id === 'compass') return `${Math.round(v * 360) % 360}° ${compassPoint(v * 360)}`
  if (id === 'span') { const [a, b] = rangeOf(v); return `${Math.round(a)}–${Math.round(b)}` }
  if (id === 'rings') return `${Math.round(v * 100)} · ${Math.round(Math.min(1, v * 1.3) * 100)} · ${Math.round(v * 70)}`
  return `${Math.round(v * 100)}${id === 'speedo' || id === 'band' || id === 'minimal' || id === 'quarter' || id === 'segments' ? '' : '%'}`
}

const ZONES_HEALTH = [
  { to: 70, color: 'var(--red)' },
  { to: 80, color: 'var(--orange)' },
  { to: 90, color: 'var(--green)' },
  { to: 100, color: 'color-mix(in srgb, var(--green) 65%, var(--ink))' }
]
const ZONES_CENTRED = [
  { to: -0.1, color: 'var(--red)' },
  { to: 0.1, color: 'var(--ink-3)' },
  { to: 2, color: 'var(--green)' }
]
// The newly ported examples' own scales
const compassPoint = (deg: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((deg % 360) + 360) % 360) / 45) % 8]
const rangeOf = (v: number): [number, number] => [20 + v * 30, 45 + v * 50]
const stackOf = (v: number) => [
  { value: v * 0.55, color: 'var(--blue)' },
  { value: v * 0.3, color: 'var(--teal)' },
  { value: v * 0.15, color: 'color-mix(in srgb, var(--ink) 35%, transparent)' }
]
const setControl = (n: number | undefined) => n !== undefined && (vals.control = n / 100)
const toneOf = (v: number) => (v >= 1 ? 'var(--red)' : v >= 0.8 ? 'var(--orange)' : 'var(--green)')

interface Example { id: string, title: string, use: string, code: string }
// The kinds the apps use now
const EXAMPLES: Example[] = [
  {
    id: 'progress',
    title: 'Progress arc',
    use: 'A share of something, with the number in the middle. Wallet, Squeeze, Stash, Scale goal, Renewals limit.',
    code: `<Gauge :value="share" :min="0" :max="1" :start-angle="45" :end-angle="315"
  :radius="200" :padding="22" fit="content" transition :initial-value="0">
  <GaugeTrack :width="34" color="var(--ink)" :opacity="0.08" />
  <GaugeArc :width="34" color="var(--green)" />
  <GaugeValue :font-size="90" weight="bold" :format="v => \`\${Math.round(v * 100)}%\`" />
</Gauge>`
  },
  {
    id: 'zones',
    title: 'Needle on bands',
    use: 'A reading against bands that mean something. Juice health, Keyring strength.',
    code: `<Gauge :value="health" :min="50" :max="100" :start-angle="90" :end-angle="270"
  :radius="200" :padding="34" fit="content" transition :initial-value="50">
  <GaugeZones :zones="[{ to: 70, color: 'var(--red)' }, { to: 80, color: 'var(--orange)' },
    { to: 90, color: 'var(--green)' }, { to: 100, color: 'var(--green)' }]"
    :width="22" :gap="1.2" end-cap="round" />
  <GaugeTickLabels :values="[50, 70, 80, 90, 100]" :offset="-46" :font-size="17" color="var(--ink-3)" />
  <GaugeNeedle variant="pointer" :length="0.56" :width="15" :tail="0" color="var(--ink)" />
  <GaugeHub :radius="11" color="var(--ink)" />
</Gauge>`
  },
  {
    id: 'centred',
    title: 'Centred on zero',
    use: 'Better or worse than a reference, with “about the same” in the middle. Riel Deal.',
    code: `<Gauge :value="percent" :min="-2" :max="2" :start-angle="90" :end-angle="270"
  :radius="200" :padding="64" fit="content" transition :initial-value="0">
  <GaugeZones :zones="[{ to: -0.1, color: 'var(--red)' }, { to: 0.1, color: 'var(--ink-3)' },
    { to: 2, color: 'var(--green)' }]" :width="18" :gap="1.5" end-cap="round" />
  <GaugeTickLabels :values="[-2, 0, 2]" :offset="44" :font-size="28"
    :format="v => v === 0 ? 'market' : \`\${v > 0 ? '+' : '−'}\${Math.abs(v)}%\`" />
  <GaugeNeedle variant="pointer" :length="0.72" :width="16" :tail="0" />
  <GaugeHub :radius="12" />
</Gauge>`
  },
  {
    id: 'speedo',
    title: 'Speedometer',
    use: 'A live reading on a scale with ticks and labels. Speed test.',
    code: `<Gauge :value="speed" :min="0" :max="100" :start-angle="45" :end-angle="315"
  :radius="200" :padding="24" fit="content" transition>
  <GaugeTrack :width="22" color="var(--ink)" :opacity="0.08" />
  <GaugeArc :width="22" color="var(--accent)" />
  <GaugeTicks :count="10" :length="14" :width="3" :offset="-34" color="var(--line)" />
  <GaugeTickLabels :count="5" :offset="-70" :font-size="24" weight="semibold" color="var(--ink-3)" />
  <GaugeNeedle :length="0.62" :width="7" :tail="22" color="var(--ink)" />
  <GaugeHub :radius="13" color="var(--ink)" />
</Gauge>`
  },
  {
    id: 'ring',
    title: 'Full ring',
    use: 'Progress that closes a circle; put words in the middle. Countdown, Payday.',
    code: `<Gauge :value="progress" :min="0" :max="1" :start-angle="180" :end-angle="540"
  :radius="200" :padding="24" transition :initial-value="0">
  <GaugeTrack :width="40" color="var(--ink)" :opacity="0.1" />
  <GaugeArc :width="40" color="var(--accent)" />
  <GaugeValue :font-size="104" weight="bold" :format="v => \`\${Math.floor(v * 100)}%\`" />
</Gauge>`
  },
  {
    id: 'range',
    title: 'Needle in a range',
    use: 'Where a value sits between a low and a high. Chi’s price range.',
    code: `<Gauge :value="price" :min="low" :max="high" :start-angle="90" :end-angle="270"
  :radius="200" :padding="26" fit="content" transition>
  <GaugeTrack :width="22" color="var(--ink)" :opacity="0.08" />
  <GaugeArc :width="22" color="var(--gold)" />
  <GaugeNeedle variant="pointer" :length="0.72" :width="16" :tail="0" color="var(--ink)" />
  <GaugeHub :radius="12" color="var(--ink)" />
</Gauge>`
  }
]

// More that the same parts can build, not used in an app yet
const MORE: Example[] = [
  {
    id: 'rings',
    title: 'Concentric rings',
    use: 'Several shares side by side, one ring each, set in with offset. Good for three goals at once.',
    code: `<Gauge :value="1" :min="0" :max="1" :start-angle="180" :end-angle="540" :radius="200" :padding="24">
  <GaugeTrack :width="34" color="var(--red)" :opacity="0.15" />
  <GaugeArc :to="move" :width="34" color="var(--red)" />
  <GaugeTrack :width="34" :offset="-44" color="var(--green)" :opacity="0.15" />
  <GaugeArc :to="exercise" :width="34" :offset="-44" color="var(--green)" />
  <GaugeTrack :width="34" :offset="-88" color="var(--blue)" :opacity="0.15" />
  <GaugeArc :to="stand" :width="34" :offset="-88" color="var(--blue)" />
</Gauge>`
  },
  {
    id: 'segments',
    title: 'Segmented meter',
    use: 'Ticks that light up to the value, like an LED bar. Give GaugeTicks a colour function.',
    code: `<Gauge :value="level" :min="0" :max="1" :start-angle="60" :end-angle="300"
  :radius="200" :padding="30" fit="content" transition>
  <GaugeTicks :count="24" :length="44" :width="12" cap="round"
    :color="v => v <= level ? 'var(--accent)' : 'color-mix(in srgb, var(--ink) 12%, transparent)'" />
  <GaugeValue :y="10" :font-size="80" weight="bold" :format="v => \`\${Math.round(v * 100)}\`" />
</Gauge>`
  },
  {
    id: 'target',
    title: 'Progress with a target',
    use: 'A goal marked on the arc with GaugeMarks and a label outside it. Savings, steps, reading.',
    code: `<Gauge :value="progress" :min="0" :max="1" :start-angle="90" :end-angle="270"
  :radius="200" :padding="58" fit="content" transition>
  <GaugeTrack :width="30" color="var(--ink)" :opacity="0.08" />
  <GaugeArc :width="30" :color="progress >= 0.75 ? 'var(--green)' : 'var(--accent)'" />
  <GaugeMarks :values="[0.75]" :length="54" :width="6" color="var(--ink)" />
  <GaugeTickLabels :values="[0.75]" :offset="50" :font-size="24" :format="() => 'goal'" />
  <GaugeValue :y="-50" :font-size="72" weight="bold" :format="v => \`\${Math.round(v * 100)}%\`" />
</Gauge>`
  },
  {
    id: 'band',
    title: 'Needle over a healthy band',
    use: 'One good range highlighted with GaugeArc from/to, the rest left quiet. Temperature, humidity, blood pressure.',
    code: `<Gauge :value="reading" :min="0" :max="100" :start-angle="60" :end-angle="300"
  :radius="200" :padding="30" fit="content" transition>
  <GaugeTrack :width="26" color="var(--ink)" :opacity="0.08" />
  <GaugeArc :from="40" :to="65" :width="26" color="var(--green)" :opacity="0.45" />
  <GaugeTickLabels :values="[0, 40, 65, 100]" :offset="-52" :font-size="22" color="var(--ink-3)" />
  <GaugeNeedle :length="0.78" :width="6" :tail="26" color="var(--ink)" />
  <GaugeHub :radius="12" color="var(--ink)" />
</Gauge>`
  },
  {
    id: 'minimal',
    title: 'Minimal',
    use: 'A hairline track, a long line needle and the two ends labelled. Quiet enough for a dashboard row.',
    code: `<Gauge :value="value" :min="0" :max="100" :start-angle="90" :end-angle="270"
  :radius="200" :padding="40" fit="content" transition>
  <GaugeTrack :width="4" color="var(--ink)" :opacity="0.25" />
  <GaugeTicks :count="20" :length="10" :width="2" :offset="-14" color="var(--ink-3)" />
  <GaugeTickLabels :values="[0, 100]" :offset="30" :font-size="22" color="var(--ink-3)" />
  <GaugeNeedle :length="0.92" :width="3" :tail="34" color="var(--red)" />
  <GaugeHub :radius="8" color="var(--ink)" />
</Gauge>`
  },
  {
    id: 'quarter',
    title: 'Quarter dial',
    use: 'Only a quarter turn (180–270), so it fits in a card corner or beside a number.',
    code: `<Gauge :value="value" :min="0" :max="100" :start-angle="180" :end-angle="270"
  :radius="200" :padding="26" fit="content" transition>
  <GaugeTrack :width="30" color="var(--ink)" :opacity="0.08" />
  <GaugeArc :width="30" color="var(--accent)" />
  <GaugeText :x="70" :y="-60" :font-size="64" weight="bold" anchor="start">{{ value }}</GaugeText>
</Gauge>`
  },
  {
    id: 'clock',
    title: 'Clock face',
    use: 'A full turn with hour marks and numbers; the value is the hour. Shifts, sleep, opening hours.',
    code: `<Gauge :value="hour" :min="0" :max="12" :start-angle="180" :end-angle="540" :radius="200" :padding="16" transition>
  <GaugeTicks :count="60" :length="8" :width="2" :offset="-8" color="var(--ink-3)" />
  <GaugeTicks :count="12" :length="20" :width="5" :offset="-14" color="var(--ink)" />
  <GaugeTickLabels :count="12" :offset="-58" :font-size="30" weight="semibold" :format="v => String(v || 12)" />
  <GaugeNeedle :length="0.6" :width="9" :tail="20" color="var(--ink)" />
  <GaugeHub :radius="12" color="var(--accent)" />
</Gauge>`
  },
  {
    id: 'drain',
    title: 'Draining arc',
    use: 'What’s left, shrinking back towards the end with reverse. Time remaining, battery, a timer.',
    code: `<Gauge :value="left" :min="0" :max="1" :start-angle="45" :end-angle="315"
  :radius="200" :padding="22" fit="content" transition>
  <GaugeTrack :width="34" color="var(--ink)" :opacity="0.08" />
  <GaugeArc reverse :width="34" :color="left < 0.2 ? 'var(--red)' : 'var(--blue)'" />
  <GaugeValue :font-size="90" weight="bold" :format="v => \`\${Math.round(v * 100)}%\`" />
  <GaugeText :y="80" :font-size="32" color="var(--ink-2)">left</GaugeText>
</Gauge>`
  }
]

// The rest of Gauge UI, newly ported: none of these is in an app yet either
const NEW: Example[] = [
  {
    id: 'stack',
    title: 'Stacked parts',
    use: 'GaugeStack: one arc split into weighted parts that sweep in together. Memory (used, cached, free), a budget by category.',
    code: `<Gauge :value="used + cached + free" :min="0" :max="16" :start-angle="45" :end-angle="315"
  :radius="200" :padding="22" fit="content" transition :initial-value="0">
  <GaugeTrack :width="34" color="var(--ink)" :opacity="0.08" />
  <GaugeStack :width="34" :gap="1.5" :parts="[{ value: used, color: 'var(--blue)' },
    { value: cached, color: 'var(--teal)' }, { value: free, color: 'var(--ink-3)' }]" />
  <GaugeValue :font-size="84" weight="bold" :format="v => \`\${v.toFixed(1)} GB\`" />
</Gauge>`
  },
  {
    id: 'tickfill',
    title: 'Tick fill and tick pointer',
    use: 'GaugeTickFill: ticks that are the fill, lit to the value (outer), or one lit tick as the pointer (inner, mode="pointer").',
    code: `<Gauge :value="level" :min="0" :max="1" :start-angle="60" :end-angle="300"
  :radius="200" :padding="30" fit="content" transition>
  <GaugeTickFill :count="30" :length="34" :width="9" color="var(--accent)" />
  <GaugeTickFill mode="pointer" :count="30" :offset="-62" :length="22" :width="7" color="var(--ink)" />
  <GaugeValue :y="20" :font-size="72" weight="bold" :format="v => \`\${Math.round(v * 100)}\`" />
</Gauge>`
  },
  {
    id: 'inset',
    title: 'Inset dial',
    use: 'GaugeInset: a whole small gauge inside a bigger one, with its own value and scale. A fuel dial in a speedometer.',
    code: `<Gauge :value="speed" :min="0" :max="200" :start-angle="45" :end-angle="315" :radius="200" :padding="24" transition>
  <GaugeTrack :width="16" color="var(--ink)" :opacity="0.08" />
  <GaugeArc :width="16" color="var(--accent)" />
  <GaugeTickLabels :count="4" :offset="-44" :font-size="24" color="var(--ink-3)" />
  <GaugeInset :value="fuel" :min="0" :max="1" :start-angle="90" :end-angle="270" :y="96" :scale="0.32" transition>
    <GaugeZones :zones="[{ to: 0.2, color: 'var(--red)' }, { to: 1, color: 'var(--ink-3)' }]" :width="30" />
    <GaugeNeedle :length="0.8" :width="14" :tail="0" color="var(--ink)" />
  </GaugeInset>
  <GaugeNeedle :length="0.7" :width="7" :tail="24" color="var(--ink)" />
  <GaugeHub :radius="12" color="var(--ink)" />
</Gauge>`
  },
  {
    id: 'dot',
    title: 'Dot on the arc',
    use: 'GaugeDot: a dot riding the arc at the value, instead of a needle. ring in the card\u2019s colour cuts it out of the track.',
    code: `<Gauge :value="value" :min="0" :max="1" :start-angle="90" :end-angle="270"
  :radius="200" :padding="34" fit="content" transition>
  <GaugeTrack :width="20" color="var(--ink)" :opacity="0.08" />
  <GaugeArc :width="20" color="var(--accent)" />
  <GaugeDot :radius="22" color="var(--accent)" ring="var(--surface)" :ring-width="8" />
  <GaugeValue :y="-40" :font-size="70" weight="bold" :format="v => \`\${Math.round(v * 100)}%\`" />
</Gauge>`
  },
  {
    id: 'tooltip',
    title: 'Tooltip on the value',
    use: 'GaugeTooltip: a label on a pill that follows the value round the arc, outside it with a positive offset.',
    code: `<Gauge :value="value" :min="0" :max="100" :start-angle="90" :end-angle="270"
  :radius="200" :padding="76" fit="content" transition>
  <GaugeTrack :width="24" color="var(--ink)" :opacity="0.08" />
  <GaugeArc :width="24" color="var(--accent)" />
  <GaugeDot :radius="10" color="var(--ink)" />
  <GaugeTooltip :offset="58" :font-size="26" background="var(--ink)" color="var(--surface)"
    :format="v => \`\${Math.round(v)}%\`" />
</Gauge>`
  },
  {
    id: 'control',
    title: 'Drag to set',
    use: 'GaugeControl: drag round the arc to set the value, like a volume knob. It\u2019s a slider for the keyboard too: arrows, Page Up / Down, Home, End.',
    code: `<Gauge :value="volume" :min="0" :max="100" :start-angle="45" :end-angle="315"
  :radius="200" :padding="22" fit="content" transition>
  <GaugeTrack :width="30" color="var(--ink)" :opacity="0.08" />
  <GaugeArc :width="30" color="var(--accent)" />
  <GaugeDot :radius="24" color="var(--surface)" ring="var(--accent)" :ring-width="8" />
  <GaugeValue :font-size="90" weight="bold" />
  <GaugeControl v-model="volume" :step="1" label="Volume" />
</Gauge>`
  },
  {
    id: 'compass',
    title: 'Compass: wrap and a turning scale',
    use: 'wrap makes 350° to 10° turn 20° forward, not 340° back; rotate="value" turns the card under a fixed lubber line. The compass needle is a two-tone lozenge.',
    code: `<Gauge :value="heading" :min="0" :max="360" :start-angle="180" :end-angle="540"
  wrap rotate="value" :radius="200" :padding="16" transition>
  <GaugeTicks :count="72" :length="10" :width="2" :offset="-8" color="var(--ink-3)" />
  <GaugeTicks :count="8" :length="22" :width="5" :offset="-14" color="var(--ink)" />
  <GaugeTickLabels :values="[0, 90, 180, 270]" :offset="-56" :font-size="34" weight="bold"
    :format="v => 'NESW'[v / 90]" />
  <GaugeNeedle variant="compass" :length="0.55" :width="34" :tail="110" color="var(--red)" />
  <GaugeHub :radius="10" color="var(--ink)" />
</Gauge>`
  },
  {
    id: 'span',
    title: 'Range between two values',
    use: 'A [from, to] value: the arc runs between them and both ends animate. Today\u2019s low and high, a sleep window, a price band.',
    code: `<Gauge :value="[low, high]" :min="0" :max="100" :start-angle="60" :end-angle="300"
  :radius="200" :padding="30" fit="content" transition>
  <GaugeTrack :width="26" color="var(--ink)" :opacity="0.08" />
  <GaugeArc :width="26" color="var(--accent)" />
  <GaugeDot :at="low" :radius="18" color="var(--surface)" ring="var(--accent)" :ring-width="6" />
  <GaugeDot :radius="18" color="var(--surface)" ring="var(--accent)" :ring-width="6" />
  <GaugeTickLabels :values="[0, 50, 100]" :offset="-54" :font-size="22" color="var(--ink-3)" />
</Gauge>`
  },
  {
    id: 'arrow',
    title: 'Arrow needle round a readout',
    use: 'variant="arrow", a shaft with a head, and gap to split the needle round the number in the middle.',
    code: `<Gauge :value="value" :min="0" :max="100" :start-angle="45" :end-angle="315"
  :radius="200" :padding="24" fit="content" transition>
  <GaugeTicks :count="20" :length="16" :width="3" :offset="-6" color="var(--ink-3)" />
  <GaugeNeedle variant="arrow" :gap="78" :length="0.86" :width="8" :tail="0" color="var(--accent)" />
  <GaugeValue :font-size="72" weight="bold" />
</Gauge>`
  }
]

// Every example starts at the slider's value
for (const e of [...EXAMPLES, ...MORE, ...NEW]) vals[e.id] = p.value

// The parts and what each one's main options do
const PARTS = [
  { name: 'Gauge', props: 'value, min, max, startAngle, endAngle, radius, padding, fit, transition, initialValue, wrap, rotate, rotateTo, viewBox', what: 'The root. Angles are gauge degrees: 0 points down, clockwise, so 90–270 is the top half and 45–315 leaves a gap at the bottom. fit="content" trims the box to the arc. transition: true springs to new values. value can be [from, to] for a range. wrap joins max to min so changes take the short way round; rotate turns the scale, or "value" keeps the value at rotateTo while the scale turns.' },
  { name: 'GaugeTrack', props: 'width, color, opacity, cap, offset', what: 'The whole background arc.' },
  { name: 'GaugeArc', props: 'width, color, opacity, cap, offset, from, to, reverse', what: 'The filled part, from min (or from) to the value (or to).' },
  { name: 'GaugeZones', props: 'zones, width, gap, cap, endCap, offset, opacity', what: 'Coloured bands. Each zone runs to its own to; the last runs to max.' },
  { name: 'GaugeStack', props: 'parts, width, gap, cap, offset, opacity', what: 'Weighted parts end to end from min. Set the Gauge\u2019s value to their total and they sweep in together.' },
  { name: 'GaugeTicks', props: 'count or values, length, width, color, offset', what: 'Tick marks, evenly spaced or at chosen values.' },
  { name: 'GaugeTickFill', props: 'count or values, length, width, color, trackColor, from, to, mode, offset', what: 'Ticks lit between from and to (min and the value), or one lit tick as a pointer with mode="pointer".' },
  { name: 'GaugeMarks', props: 'values, length, width, color, offset', what: 'Marks at chosen values, such as a target or a pace.' },
  { name: 'GaugeTickLabels', props: 'count or values, offset, fontSize, color, weight, format', what: 'Numbers around the arc. A negative offset sits inside, positive outside (give it padding).' },
  { name: 'GaugeNeedle', props: 'variant (line, pointer, compass, arrow), length, width, tail, color, tailColor, gap', what: 'Points at the value. length is a share of the radius; gap leaves the centre clear for a readout.' },
  { name: 'GaugeHub', props: 'radius, color', what: 'The pivot disc at the centre.' },
  { name: 'GaugeDot', props: 'radius, color, ring, ringWidth, offset, at', what: 'A dot on the arc at the value (or at).' },
  { name: 'GaugeTooltip', props: 'offset, fontSize, color, background, weight, format', what: 'A label on a pill that follows the value round the arc.' },
  { name: 'GaugeValue', props: 'x, y, fontSize, weight, color, format', what: 'The value as text; it follows the animation.' },
  { name: 'GaugeText', props: 'x, y, fontSize, weight, color, anchor', what: 'Any label, positioned from the centre (positive y is down).' },
  { name: 'GaugeInset', props: 'value, min, max, startAngle, endAngle, x, y, scale, transition, wrap, rotate', what: 'A small gauge inside a bigger one, with a value and scale of its own; the parts inside it draw against those.' },
  { name: 'GaugeControl', props: 'v-model, step, width, offset, label, valueText', what: 'Drag round the arc to set the value. A slider for the keyboard and screen readers too.' }
]

const open = ref(new Set<string>())
function toggleCode(id: string) {
  const next = new Set(open.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  open.value = next
  play('select')
}
async function copy(e: Example) {
  try {
    await navigator.clipboard.writeText(e.code)
    toast.success('Code copied', { description: e.title })
    play('success')
  } catch {
    toast.error('Couldn’t copy')
  }
}
</script>

<template>
  <div class="gallery">
    <section class="panel controls">
      <label class="slider">
        <span class="slider-head"><span>Try a value</span><output>{{ level }}%</output></span>
        <input v-model.number="level" type="range" min="0" max="100" step="1" aria-label="Value for every example">
      </label>
      <label class="anim"><input v-model="animate" type="checkbox"> Animate</label>
      <div class="buttons">
        <button type="button" class="btn btn-quiet btn-sm" @click="shuffleAll">Shuffle all</button>
        <button type="button" class="btn btn-sm" :aria-pressed="playing" @click="togglePlay">{{ playing ? 'Stop' : 'Play' }}</button>
      </div>
      <p class="note">The slider sets every dial, mapped onto its own scale. Click any dial for a random value, or Play to watch them all move. The parts live in <code>components/gauge</code>; the maths and animation in <code>lib/gauge.ts</code>.</p>
    </section>

    <template v-for="group in [{ title: 'Used in the apps', list: EXAMPLES }, { title: 'More you can build', note: 'The same parts, put together other ways. None of these is in an app yet.', list: MORE }, { title: 'Newly ported', note: 'The rest of Gauge UI, brought over: stacks, tick fills, insets, dots, tooltips, dragging, ranges, wrapping, a turning scale and two more needles.', list: NEW }]" :key="group.title">
    <header class="group-head">
      <h3>{{ group.title }}</h3>
      <p v-if="group.note">{{ group.note }}</p>
    </header>
    <div class="grid">
      <article v-for="e in group.list" :key="e.id" class="panel card">
        <!-- The drag control is the dial itself, so its card isn't one big shuffle button -->
        <div v-if="e.id === 'control'" class="demo still">
          <Gauge :value="Math.round(valOf(e.id) * 100)" :min="0" :max="100" :start-angle="45" :end-angle="315" :radius="200" :padding="22" fit="content" :transition="animate">
            <GaugeTrack :width="30" color="var(--ink)" :opacity="0.08" />
            <GaugeArc :width="30" color="var(--dial)" />
            <GaugeDot :radius="24" color="var(--surface)" ring="var(--dial)" :ring-width="8" />
            <GaugeValue :font-size="90" weight="bold" color="var(--ink)" />
            <GaugeControl :model-value="Math.round(valOf(e.id) * 100)" :step="1" label="Example volume" @update:model-value="setControl" />
          </Gauge>
        </div>
        <button v-else type="button" class="demo" :title="`Click for a random value`" :aria-label="`${e.title}: showing ${readout(e.id)}. Click for a random value`" @click="shuffleOne(e.id)">
          <Gauge v-if="e.id === 'progress'" :value="valOf(e.id)" :min="0" :max="1" :start-angle="45" :end-angle="315" :radius="200" :padding="22" fit="content" :transition="animate">
            <GaugeTrack :width="34" color="var(--ink)" :opacity="0.08" />
            <GaugeArc :width="34" :color="toneOf(valOf(e.id))" />
            <GaugeValue :font-size="90" weight="bold" color="var(--ink)" :format="v => `${Math.round(v * 100)}%`" />
          </Gauge>
          <Gauge v-else-if="e.id === 'zones'" :value="50 + valOf(e.id) * 50" :min="50" :max="100" :start-angle="90" :end-angle="270" :radius="200" :padding="34" fit="content" :transition="animate">
            <GaugeZones :zones="ZONES_HEALTH" :width="22" :gap="1.2" end-cap="round" />
            <GaugeTickLabels :values="[50, 70, 80, 90, 100]" :offset="-46" :font-size="17" color="var(--ink-3)" weight="semibold" />
            <GaugeNeedle variant="pointer" :length="0.56" :width="15" :tail="0" color="var(--ink)" />
            <GaugeHub :radius="11" color="var(--ink)" />
          </Gauge>
          <Gauge v-else-if="e.id === 'centred'" :value="-2 + valOf(e.id) * 4" :min="-2" :max="2" :start-angle="90" :end-angle="270" :radius="200" :padding="64" fit="content" :transition="animate">
            <GaugeZones :zones="ZONES_CENTRED" :width="18" :gap="1.5" end-cap="round" />
            <GaugeTickLabels :values="[-2, 0, 2]" :offset="44" :font-size="28" color="var(--ink-3)" weight="semibold" :format="v => v === 0 ? 'market' : `${v > 0 ? '+' : '−'}${Math.abs(v)}%`" />
            <GaugeNeedle variant="pointer" :length="0.72" :width="16" :tail="0" color="var(--ink)" />
            <GaugeHub :radius="12" color="var(--ink)" />
          </Gauge>
          <Gauge v-else-if="e.id === 'speedo'" :value="valOf(e.id) * 100" :min="0" :max="100" :start-angle="45" :end-angle="315" :radius="200" :padding="24" fit="content" :transition="animate">
            <GaugeTrack :width="22" color="var(--ink)" :opacity="0.08" />
            <GaugeArc :width="22" color="var(--dial)" />
            <GaugeTicks :count="10" :length="14" :width="3" :offset="-34" color="var(--line)" />
            <GaugeTickLabels :count="5" :offset="-70" :font-size="24" weight="semibold" color="var(--ink-3)" />
            <GaugeNeedle :length="0.62" :width="7" :tail="22" color="var(--ink)" />
            <GaugeHub :radius="13" color="var(--ink)" />
          </Gauge>
          <Gauge v-else-if="e.id === 'ring'" :value="valOf(e.id)" :min="0" :max="1" :start-angle="180" :end-angle="540" :radius="200" :padding="24" :transition="animate">
            <GaugeTrack :width="40" color="var(--ink)" :opacity="0.1" />
            <GaugeArc :width="40" color="var(--dial)" />
            <GaugeValue :font-size="104" weight="bold" color="var(--ink)" :format="v => `${Math.floor(v * 100)}%`" />
          </Gauge>
          <Gauge v-else-if="e.id === 'range'" :value="4070 + valOf(e.id) * 100" :min="4070" :max="4170" :start-angle="90" :end-angle="270" :radius="200" :padding="26" fit="content" :transition="animate">
            <GaugeTrack :width="22" color="var(--ink)" :opacity="0.08" />
            <GaugeArc :width="22" color="var(--gold)" />
            <GaugeNeedle variant="pointer" :length="0.72" :width="16" :tail="0" color="var(--ink)" />
            <GaugeHub :radius="12" color="var(--ink)" />
          </Gauge>
          <!-- More you can build -->
          <Gauge v-else-if="e.id === 'rings'" :value="valOf(e.id)" :min="0" :max="1" :start-angle="180" :end-angle="540" :radius="200" :padding="24" :transition="animate">
            <GaugeTrack :width="34" color="var(--red)" :opacity="0.15" />
            <GaugeArc :width="34" color="var(--red)" />
            <GaugeTrack :width="34" :offset="-44" color="var(--green)" :opacity="0.15" />
            <GaugeArc :to="Math.min(1, valOf(e.id) * 1.3)" :width="34" :offset="-44" color="var(--green)" />
            <GaugeTrack :width="34" :offset="-88" color="var(--blue)" :opacity="0.15" />
            <GaugeArc :to="valOf(e.id) * 0.7" :width="34" :offset="-88" color="var(--blue)" />
          </Gauge>
          <Gauge v-else-if="e.id === 'segments'" :value="valOf(e.id)" :min="0" :max="1" :start-angle="60" :end-angle="300" :radius="200" :padding="30" fit="content" :transition="animate">
            <GaugeTicks :count="24" :length="44" :width="12" cap="round" :color="v => v <= valOf(e.id) + 1e-6 && valOf(e.id) > 0 ? 'var(--dial)' : 'color-mix(in srgb, var(--ink) 12%, transparent)'" />
            <GaugeValue :y="10" :font-size="80" weight="bold" color="var(--ink)" :format="v => `${Math.round(v * 100)}`" />
          </Gauge>
          <Gauge v-else-if="e.id === 'target'" :value="valOf(e.id)" :min="0" :max="1" :start-angle="90" :end-angle="270" :radius="200" :padding="58" fit="content" :transition="animate">
            <GaugeTrack :width="30" color="var(--ink)" :opacity="0.08" />
            <GaugeArc :width="30" :color="valOf(e.id) >= 0.75 ? 'var(--green)' : 'var(--dial)'" />
            <GaugeMarks :values="[0.75]" :length="54" :width="6" color="var(--ink)" />
            <GaugeTickLabels :values="[0.75]" :offset="50" :font-size="24" color="var(--ink-2)" weight="semibold" :format="() => 'goal'" />
            <GaugeValue :y="-50" :font-size="72" weight="bold" color="var(--ink)" :format="v => `${Math.round(v * 100)}%`" />
          </Gauge>
          <Gauge v-else-if="e.id === 'band'" :value="valOf(e.id) * 100" :min="0" :max="100" :start-angle="60" :end-angle="300" :radius="200" :padding="30" fit="content" :transition="animate">
            <GaugeTrack :width="26" color="var(--ink)" :opacity="0.08" />
            <GaugeArc :from="40" :to="65" :width="26" color="var(--green)" :opacity="0.45" />
            <GaugeTickLabels :values="[0, 40, 65, 100]" :offset="-52" :font-size="22" color="var(--ink-3)" weight="semibold" />
            <GaugeNeedle :length="0.78" :width="6" :tail="26" color="var(--ink)" />
            <GaugeHub :radius="12" color="var(--ink)" />
          </Gauge>
          <Gauge v-else-if="e.id === 'minimal'" :value="valOf(e.id) * 100" :min="0" :max="100" :start-angle="90" :end-angle="270" :radius="200" :padding="40" fit="content" :transition="animate">
            <GaugeTrack :width="4" color="var(--ink)" :opacity="0.25" />
            <GaugeTicks :count="20" :length="10" :width="2" :offset="-14" color="var(--ink-3)" />
            <GaugeTickLabels :values="[0, 100]" :offset="30" :font-size="22" color="var(--ink-3)" weight="semibold" />
            <GaugeNeedle :length="0.92" :width="3" :tail="34" color="var(--red)" />
            <GaugeHub :radius="8" color="var(--ink)" />
          </Gauge>
          <Gauge v-else-if="e.id === 'quarter'" :value="valOf(e.id) * 100" :min="0" :max="100" :start-angle="180" :end-angle="270" :radius="200" :padding="26" fit="content" :transition="animate">
            <GaugeTrack :width="30" color="var(--ink)" :opacity="0.08" />
            <GaugeArc :width="30" color="var(--dial)" />
            <GaugeText :x="70" :y="-60" :font-size="64" weight="bold" anchor="start" color="var(--ink)">{{ Math.round(valOf(e.id) * 100) }}</GaugeText>
          </Gauge>
          <Gauge v-else-if="e.id === 'clock'" :value="valOf(e.id) * 12" :min="0" :max="12" :start-angle="180" :end-angle="540" :radius="200" :padding="16" :transition="animate">
            <GaugeTicks :count="60" :length="8" :width="2" :offset="-8" color="var(--ink-3)" />
            <GaugeTicks :count="12" :length="20" :width="5" :offset="-14" color="var(--ink)" />
            <GaugeTickLabels :count="12" :offset="-58" :font-size="30" weight="semibold" color="var(--ink)" :format="v => String(v || 12)" />
            <GaugeNeedle :length="0.6" :width="9" :tail="20" color="var(--ink)" />
            <GaugeHub :radius="12" color="var(--dial)" />
          </Gauge>
          <Gauge v-else-if="e.id === 'drain'" :value="1 - valOf(e.id)" :min="0" :max="1" :start-angle="45" :end-angle="315" :radius="200" :padding="22" fit="content" :transition="animate">
            <GaugeTrack :width="34" color="var(--ink)" :opacity="0.08" />
            <GaugeArc reverse :width="34" :color="1 - valOf(e.id) < 0.2 ? 'var(--red)' : 'var(--blue)'" />
            <GaugeValue :font-size="90" weight="bold" color="var(--ink)" :format="v => `${Math.round(v * 100)}%`" />
            <GaugeText :y="80" :font-size="32" color="var(--ink-2)">left</GaugeText>
          </Gauge>
          <!-- Newly ported -->
          <Gauge v-else-if="e.id === 'stack'" :value="valOf(e.id) * 16" :min="0" :max="16" :start-angle="45" :end-angle="315" :radius="200" :padding="22" fit="content" :transition="animate">
            <GaugeTrack :width="34" color="var(--ink)" :opacity="0.08" />
            <GaugeStack :width="34" :gap="1.5" :parts="stackOf(valOf(e.id)).map(s => ({ ...s, value: s.value * 16 }))" />
            <GaugeValue :font-size="76" weight="bold" color="var(--ink)" :format="v => `${v.toFixed(1)} GB`" />
          </Gauge>
          <Gauge v-else-if="e.id === 'tickfill'" :value="valOf(e.id)" :min="0" :max="1" :start-angle="60" :end-angle="300" :radius="200" :padding="30" fit="content" :transition="animate">
            <GaugeTickFill :count="30" :length="34" :width="9" color="var(--dial)" track-color="color-mix(in srgb, var(--ink) 12%, transparent)" />
            <GaugeTickFill mode="pointer" :count="30" :offset="-62" :length="22" :width="7" color="var(--ink)" track-color="color-mix(in srgb, var(--ink) 12%, transparent)" />
            <GaugeValue :y="20" :font-size="72" weight="bold" color="var(--ink)" :format="v => `${Math.round(v * 100)}`" />
          </Gauge>
          <Gauge v-else-if="e.id === 'inset'" :value="valOf(e.id) * 200" :min="0" :max="200" :start-angle="45" :end-angle="315" :radius="200" :padding="24" :transition="animate">
            <GaugeTrack :width="16" color="var(--ink)" :opacity="0.08" />
            <GaugeArc :width="16" color="var(--dial)" />
            <GaugeTickLabels :count="4" :offset="-44" :font-size="24" color="var(--ink-3)" weight="semibold" />
            <GaugeInset :value="1 - valOf(e.id)" :min="0" :max="1" :start-angle="90" :end-angle="270" :y="96" :scale="0.32" :transition="animate">
              <GaugeZones :zones="[{ to: 0.2, color: 'var(--red)' }, { to: 1, color: 'var(--ink-3)' }]" :width="30" />
              <GaugeNeedle :length="0.8" :width="14" :tail="0" color="var(--ink)" />
              <GaugeHub :radius="16" color="var(--ink)" />
            </GaugeInset>
            <GaugeNeedle :length="0.7" :width="7" :tail="24" color="var(--ink)" />
            <GaugeHub :radius="12" color="var(--ink)" />
          </Gauge>
          <Gauge v-else-if="e.id === 'dot'" :value="valOf(e.id)" :min="0" :max="1" :start-angle="90" :end-angle="270" :radius="200" :padding="34" fit="content" :transition="animate">
            <GaugeTrack :width="20" color="var(--ink)" :opacity="0.08" />
            <GaugeArc :width="20" color="var(--dial)" />
            <GaugeDot :radius="22" color="var(--dial)" ring="var(--surface)" :ring-width="8" />
            <GaugeValue :y="-40" :font-size="70" weight="bold" color="var(--ink)" :format="v => `${Math.round(v * 100)}%`" />
          </Gauge>
          <Gauge v-else-if="e.id === 'tooltip'" :value="valOf(e.id) * 100" :min="0" :max="100" :start-angle="90" :end-angle="270" :radius="200" :padding="76" fit="content" :transition="animate">
            <GaugeTrack :width="24" color="var(--ink)" :opacity="0.08" />
            <GaugeArc :width="24" color="var(--dial)" />
            <GaugeDot :radius="10" color="var(--ink)" />
            <GaugeTooltip :offset="58" :font-size="26" background="var(--ink)" color="var(--surface)" :format="v => `${Math.round(v)}%`" />
          </Gauge>
          <Gauge v-else-if="e.id === 'compass'" :value="valOf(e.id) * 360" :min="0" :max="360" :start-angle="180" :end-angle="540" wrap rotate="value" :radius="200" :padding="16" :transition="animate">
            <GaugeTicks :count="72" :length="10" :width="2" :offset="-8" color="var(--ink-3)" />
            <GaugeTicks :count="8" :length="22" :width="5" :offset="-14" color="var(--ink)" />
            <GaugeTickLabels :values="[0, 90, 180, 270]" :offset="-56" :font-size="34" weight="bold" :color="v => v === 0 ? 'var(--red)' : 'var(--ink)'" :format="v => 'NESW'[v / 90] ?? ''" />
            <GaugeNeedle variant="compass" :length="0.55" :width="34" :tail="110" color="var(--red)" tail-color="color-mix(in srgb, var(--ink) 30%, transparent)" />
            <GaugeHub :radius="10" color="var(--ink)" />
          </Gauge>
          <Gauge v-else-if="e.id === 'span'" :value="rangeOf(valOf(e.id))" :min="0" :max="100" :start-angle="60" :end-angle="300" :radius="200" :padding="30" fit="content" :transition="animate">
            <GaugeTrack :width="26" color="var(--ink)" :opacity="0.08" />
            <GaugeArc :width="26" color="var(--dial)" />
            <GaugeDot :at="rangeOf(valOf(e.id))[0]" :radius="18" color="var(--surface)" ring="var(--dial)" :ring-width="6" />
            <GaugeDot :radius="18" color="var(--surface)" ring="var(--dial)" :ring-width="6" />
            <GaugeTickLabels :values="[0, 50, 100]" :offset="-54" :font-size="22" color="var(--ink-3)" weight="semibold" />
          </Gauge>
          <Gauge v-else-if="e.id === 'arrow'" :value="valOf(e.id) * 100" :min="0" :max="100" :start-angle="45" :end-angle="315" :radius="200" :padding="24" fit="content" :transition="animate">
            <GaugeTicks :count="20" :length="16" :width="3" :offset="-6" color="var(--ink-3)" />
            <GaugeNeedle variant="arrow" :gap="78" :length="0.86" :width="8" :tail="0" color="var(--dial)" />
            <GaugeValue :font-size="72" weight="bold" color="var(--ink)" />
          </Gauge>
        </button>
        <p class="readout" aria-live="polite">{{ readout(e.id) }} <span v-if="e.id !== 'control'">· click the dial to shuffle</span></p>
        <h3>{{ e.title }}</h3>
        <p class="use">{{ e.use }}</p>
        <div class="code-actions">
          <button type="button" class="btn btn-quiet btn-sm" :aria-expanded="open.has(e.id)" @click="toggleCode(e.id)">{{ open.has(e.id) ? 'Hide code' : 'Code' }}</button>
          <button type="button" class="btn btn-quiet btn-sm" @click="copy(e)">Copy</button>
        </div>
        <pre v-if="open.has(e.id)" class="code"><code>{{ e.code }}</code></pre>
      </article>
    </div>
    </template>

    <section class="panel parts">
      <h3>Parts</h3>
      <p class="note">Put any of these inside a <code>&lt;Gauge&gt;</code>; each one draws itself from the root's value and angles. Sizes are in the gauge's own units, against a radius of 200 unless you set another.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th scope="col">Part</th><th scope="col">Main options</th><th scope="col">What it does</th></tr></thead>
          <tbody>
            <tr v-for="part in PARTS" :key="part.name">
              <th scope="row"><code>&lt;{{ part.name }}&gt;</code></th>
              <td class="props">{{ part.props }}</td>
              <td>{{ part.what }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.gallery {
  /* The dials' colour: the app's own, lifted towards the text colour in the dark, where the Settings
     colour is a dark grey that would vanish into the cards */
  --dial: var(--accent);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.5rem;
  padding: 1.1rem 1.25rem;
}

.slider {
  flex: 1 1 16rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.slider-head {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
}

.slider output {
  font-variant-numeric: tabular-nums;
}

.anim {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.note {
  flex-basis: 100%;
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.group-head h3 {
  margin: 0.5rem 0 0;
  font-size: var(--text-sm);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.group-head p {
  margin: 0.2rem 0 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: 1rem;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1.1rem 1.2rem;
  min-width: 0;
}

.demo {
  display: grid;
  place-items: center;
  width: 100%;
  height: 9.5rem;
  margin-bottom: 0.2rem;
  padding: 0;
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background-color var(--dur-fast), scale var(--dur-fast);
}

.demo:not(.still):hover {
  background: color-mix(in srgb, var(--ink) 4%, transparent);
}

.demo.still {
  cursor: default;
}

.demo:not(.still):active {
  scale: 0.97;
}

.demo:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.readout {
  margin: 0 0 0.3rem;
  font-size: var(--text-xs);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--ink);
}

.readout span {
  font-weight: 500;
  color: var(--ink-3);
}

.buttons {
  display: flex;
  gap: 0.4rem;
}

.demo :deep(.gauge) {
  width: auto;
  max-width: 100%;
  height: 100%;
  max-height: 9.5rem;
}

.card h3 {
  margin: 0;
  font-size: var(--text-md);
}

.use {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--ink-2);
}

.code-actions {
  display: flex;
  gap: 0.4rem;
  margin-top: auto;
  padding-top: 0.5rem;
}

.code {
  margin: 0.4rem 0 0;
  padding: 0.75rem 0.85rem;
  overflow-x: auto;
  font-size: var(--text-xs);
  line-height: 1.5;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--line);
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.note code,
.props,
.parts th code {
  font-size: 0.85em;
}

.parts {
  padding: 1.1rem 1.25rem;
}

.parts h3 {
  margin: 0 0 0.3rem;
  font-size: var(--text-md);
}

.table-wrap {
  margin-top: 0.75rem;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

th,
td {
  padding: 0.55rem 0.6rem;
  text-align: left;
  vertical-align: top;
  border-top: 1px solid var(--line);
}

thead th {
  border-top: 0;
  font-size: var(--text-xs);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-3);
}

tbody th {
  white-space: nowrap;
}

.props {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--ink-2);
}

:root[data-theme='dark'] .gallery {
  --dial: color-mix(in srgb, var(--accent), var(--ink) 55%);
}

/* Phones: each part stacks (name, options, what it does) instead of three squeezed columns */
@media (max-width: 640px) {
  table,
  tbody,
  tr,
  th,
  td {
    display: block;
  }

  thead {
    display: none;
  }

  tr {
    padding: 0.65rem 0;
    border-top: 1px solid var(--line);
  }

  tbody th,
  td {
    padding: 0.1rem 0;
    border-top: 0;
  }

  .props {
    margin: 0.15rem 0 0.25rem;
  }
}
</style>
