<script setup lang="ts">
import type { Folder } from '~/utils/folders'
import type { NoteSort, NoteView } from '~/utils/notes'

// Notes → Settings (#49), in the app's settings popup (ToolPage). The same rows as every other app's
// settings (SettingChoice, SettingRow), in three groups: writing (with a live preview of the text),
// the list of notes, and where new notes go. Remembered on this device (useNotePrefs); sort and view
// belong to the page, so they come in as models.
const props = defineProps<{ folders: readonly Folder[], sorts: readonly { value: NoteSort, label: string }[] }>()
const sort = defineModel<NoteSort>('sort', { required: true })
const view = defineModel<NoteView>('view', { required: true })
const { prefs, editorStyle, reset } = useNotePrefs()
const { play } = useSound()

const FONTS = [{ value: 'sans', label: 'Sans' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Mono' }] as const
const SIZES = [{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }] as const
const LEADING = [{ value: 'tight', label: 'Tight' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Relaxed' }] as const
const WIDTHS = [{ value: 'center', label: 'Centred' }, { value: 'full', label: 'Full width' }] as const
const VIEWS = [{ value: 'list', label: 'List' }, { value: 'grid', label: 'Cards' }, { value: 'compact', label: 'Compact' }] as const
const PREVIEW = [{ value: 0, label: 'None' }, { value: 80, label: 'Short' }, { value: 140, label: 'Medium' }, { value: 240, label: 'Long' }] as const
// Sub-folders indented under their parent, as in the folder list
const folderOptions = computed(() => [
  { value: '', label: 'No folder' },
  ...flatTree(props.folders).map(o => ({ value: o.folder.id, label: `${'— '.repeat(o.depth)}${o.folder.name}` }))
])

function resetAll() {
  reset()
  play('toggle-off')
}
</script>

<template>
  <h3 class="settings-head">Writing</h3>
  <!-- What a note looks like with these choices, as they change -->
  <div class="sample" :style="editorStyle" aria-hidden="true">
    <p class="sample-title">Weekend plans</p>
    <p class="sample-text">Pick up the bike from the shop, then coffee with Dara at ten. Remember the charger, and book a table for Sunday.</p>
  </div>
  <SettingChoice v-model="prefs.font" title="Font" :options="FONTS" />
  <SettingChoice v-model="prefs.size" title="Text size" :options="SIZES" />
  <SettingChoice v-model="prefs.leading" title="Line spacing" :options="LEADING" />
  <SettingChoice v-model="prefs.width" title="Note width" description="Centred keeps lines short and easy to read" :options="WIDTHS" />
  <SettingRow v-model="prefs.spellcheck" title="Spellcheck" description="Underline words that look misspelled" />

  <h3 class="settings-head">Notes list</h3>
  <SettingChoice v-model="sort" title="Sort by" :options="sorts" />
  <SettingChoice v-model="view" title="Show notes as" :options="VIEWS" />
  <SettingChoice v-model="prefs.previewLength" title="Preview" description="How much of each note shows under its title" :options="PREVIEW" />
  <SettingRow v-model="prefs.showDetails" title="Details under a note" description="Created and edited dates, words and folder, at the foot of the open note" />

  <h3 class="settings-head">New notes</h3>
  <SettingChoice v-model="prefs.defaultFolder" title="New notes go in" description="With a folder open, new notes go there instead" :options="folderOptions" />

  <p class="foot">
    <span>Notes save by themselves as you type. Markdown shortcuts always work: # heading, - list, [ ] checklist, &gt; quote.</span>
    <button type="button" class="link" @click="resetAll">Reset Notes settings</button>
  </p>
</template>

<style scoped>
/* The preview: a slice of a note in the chosen font, size and spacing */
.sample {
  margin: 0.4rem 0 0.6rem;
  padding: 1rem 1.15rem;
  background: var(--surface-2);
  border-radius: var(--radius-lg);
  box-shadow: inset 0 0 0 1px var(--line);
}

/* No hairline above or below the card: it belongs to the heading */
.settings-head + .sample,
.sample + * {
  border-top: 0 !important;
}

.sample p {
  margin: 0;
  font-family: var(--note-font, inherit);
}

.sample-title {
  font-size: calc(var(--note-size) * 1.3);
  font-weight: 750;
  line-height: 1.25;
  letter-spacing: -0.015em;
}

.sample-text {
  margin-top: 0.35rem !important;
  font-size: var(--note-size);
  line-height: var(--note-leading);
  color: var(--ink);
  text-wrap: pretty;
}

.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
  margin: 0;
  padding-top: 1rem;
  font-size: var(--text-sm);
  color: var(--ink-3);
}

.foot span {
  flex: 1 1 18rem;
}
</style>
