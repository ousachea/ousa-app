<script setup lang="ts">
import { LIKED_ID, type MusicTrack, useAmbientMusic } from '~/composables/ambient-studio/useAmbientMusic'
import { youtubeUrl } from '~/utils/ambient-studio/youtube'

// Your YouTube Music library: connect with Google, then your liked songs and playlists.
// Opening one lists its songs; play them all, shuffle, or start from any song.
const music = useAmbientMusic()
const m = music.state
const { play } = useSound()

const openPlaylist = (id: string, title: string) => {
  void music.open(id, title)
  play('open')
}

const playable = computed(() => m.tracks.filter(t => t.playable).length)
const playingId = computed(() => music.current.value?.videoId)

function playAll(shuffled = false) {
  music.playList(m.tracks as MusicTrack[], m.openTitle, { shuffled })
  play('select')
}

function playFrom(t: MusicTrack) {
  if (!t.playable) return
  music.playList(m.tracks as MusicTrack[], m.openTitle, { start: t })
  play('select')
}

const openUrl = computed(() => (m.openId === LIKED_ID ? 'https://music.youtube.com/playlist?list=LM' : youtubeUrl({ playlistId: m.openId }, true)))
</script>

<template>
  <div class="ambient-studio-music">
    <!-- Not connected -->
    <section v-if="!m.connected" class="connect">
      <div class="connect-text">
        <span class="eyebrow">YouTube Music</span>
        <h2>Play your own music here</h2>
        <p>Connect your Google account to see the playlists you made in YouTube Music and the songs you liked, and play them over your scene with the mixer and timer.</p>
        <ul class="facts">
          <li>Read-only: nothing in your account is changed.</li>
          <li>Songs play in the YouTube player on screen; it has to stay visible to play.</li>
          <li>A few songs aren’t allowed outside YouTube. They’re marked and skipped.</li>
        </ul>
      </div>
      <button type="button" class="btn connect-btn" :disabled="m.connecting" @click="music.connect()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M10 8.5v7l6-3.5z" fill="currentColor" stroke="none" /></svg>
        {{ m.connecting ? 'Waiting for Google…' : 'Connect YouTube Music' }}
      </button>
    </section>

    <!-- Problems, with what to do about them -->
    <div v-if="m.error" class="problem" role="alert">
      <p>{{ m.error }}</p>
      <ol v-if="m.setup === 'api-disabled'">
        <li>Open <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener">YouTube Data API v3</a> in Google Cloud, in the same project as this app’s Firebase.</li>
        <li>Press <strong>Enable</strong>, wait a minute, then connect again.</li>
      </ol>
      <ol v-else-if="m.setup === 'no-scope'">
        <li>In Google Cloud, open <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener">OAuth consent screen</a> → Data access, and add the <code>youtube.readonly</code> scope.</li>
        <li>While the app is in Testing, add your Google account under Test users.</li>
        <li>Connect again and tick the YouTube box when Google asks.</li>
      </ol>
      <button v-if="m.connected" type="button" class="btn btn-sm btn-quiet" @click="music.reload()">Try again</button>
    </div>

    <!-- One playlist -->
    <section v-if="m.connected && m.openId" class="playlist">
      <button type="button" class="back" @click="music.close()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        Your music
      </button>
      <header class="pl-head">
        <div>
          <h2>{{ m.openTitle }}</h2>
          <p v-if="!m.loadingTracks">
            {{ m.tracks.length }} {{ m.tracks.length === 1 ? 'song' : 'songs' }}<template v-if="playable < m.tracks.length"> · {{ m.tracks.length - playable }} can’t play here</template>
          </p>
        </div>
        <div class="pl-actions">
          <button type="button" class="btn" :disabled="!playable" @click="playAll()"><AmbientStudioIcon name="play" /> Play</button>
          <button type="button" class="btn btn-quiet" :disabled="playable < 2" @click="playAll(true)">Shuffle</button>
          <a class="btn btn-quiet" :href="openUrl" target="_blank" rel="noopener">YouTube Music <AmbientStudioIcon name="external" /></a>
        </div>
      </header>
      <SkeletonList v-if="m.loadingTracks" :count="6" label="Loading songs" />
      <ol v-else-if="m.tracks.length" class="tracks">
        <li v-for="(t, i) in m.tracks" :key="`${t.videoId}-${i}`">
          <button type="button" class="track" :class="{ on: playingId === t.videoId, off: !t.playable }" :disabled="!t.playable" @click="playFrom(t as MusicTrack)">
            <span class="num" aria-hidden="true">{{ i + 1 }}</span>
            <img v-if="t.thumb" :src="t.thumb" alt="" width="64" height="36" loading="lazy" referrerpolicy="no-referrer">
            <span class="track-text">
              <strong>{{ t.title }}</strong>
              <span>{{ t.artist }}<template v-if="!t.playable"> · can’t play outside YouTube</template></span>
            </span>
            <span v-if="playingId === t.videoId" class="now-tag">Playing</span>
          </button>
        </li>
      </ol>
      <p v-else class="empty-line">This playlist is empty, or all its songs were removed.</p>
    </section>

    <!-- Your library -->
    <section v-else-if="m.connected" class="library">
      <div class="lib-head">
        <div>
          <h2>Your music</h2>
          <p v-if="m.email">{{ m.email }}</p>
        </div>
        <button type="button" class="more" @click="music.disconnect()">Disconnect</button>
      </div>
      <SkeletonList v-if="m.loadingPlaylists" variant="cards" :count="4" label="Loading your playlists" />
      <ul v-else class="lists">
        <li>
          <button type="button" class="list-card liked" @click="openPlaylist(LIKED_ID, 'Liked songs')">
            <span class="cover liked-cover" aria-hidden="true"><AmbientStudioIcon name="heart" /></span>
            <strong>Liked songs</strong>
            <span>Songs and videos you liked</span>
          </button>
        </li>
        <li v-for="p in m.playlists" :key="p.id">
          <button type="button" class="list-card" @click="openPlaylist(p.id, p.title)">
            <span class="cover"><img v-if="p.thumb" :src="p.thumb" alt="" loading="lazy" referrerpolicy="no-referrer"></span>
            <strong>{{ p.title }}</strong>
            <span>{{ p.count }} {{ p.count === 1 ? 'song' : 'songs' }}</span>
          </button>
        </li>
      </ul>
      <p v-if="!m.loadingPlaylists && !m.playlists.length && !m.error" class="empty-line">
        No playlists yet. Make one in YouTube Music and it shows up here.
      </p>
    </section>
  </div>
</template>

<style scoped>
.ambient-studio-music {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

h2 {
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-weight: 750;
  letter-spacing: -0.03em;
  color: var(--as-ink);
}

.eyebrow {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ff6b6b;
}

/* ---------- Connect ---------- */
.connect {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.25rem 2rem;
  padding: clamp(1.25rem, 3vw, 2rem);
  background:
    radial-gradient(80% 120% at 100% 0%, rgb(255 60 60 / 0.16), transparent 60%),
    rgb(255 255 255 / 0.03);
  border: 1px solid var(--as-line);
  border-radius: 20px;
}

.connect-text {
  max-width: 36rem;
}

.connect-text h2 {
  margin-top: 0.35rem;
}

.connect-text p {
  margin: 0.6rem 0 0;
  color: var(--as-ink-2);
}

.facts {
  margin: 0.9rem 0 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: var(--as-ink-3);
}

.connect-btn {
  --accent-btn: #e33;
  --on-accent: #fff;
  gap: 0.5rem;
}

.connect-btn svg {
  width: 1.2rem;
  height: 1.2rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}

/* ---------- Problems ---------- */
.problem {
  padding: 1rem 1.15rem;
  color: var(--as-ink);
  background: rgb(255 120 90 / 0.08);
  border: 1px solid rgb(255 120 90 / 0.3);
  border-radius: 14px;
}

.problem p {
  margin: 0;
}

.problem ol {
  margin: 0.6rem 0 0.75rem;
  padding-left: 1.2rem;
  display: grid;
  gap: 0.3rem;
  font-size: 0.875rem;
  color: var(--as-ink-2);
}

.problem a {
  color: var(--tint);
}

.problem code {
  font-size: 0.85em;
}

/* ---------- Library ---------- */
.lib-head,
.pl-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem 1rem;
}

.lib-head p,
.pl-head p {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--as-ink-3);
}

.more {
  padding: 0.25rem 0;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--as-ink-3);
  background: none;
  border: 0;
  cursor: pointer;
}

.more:hover {
  color: var(--as-ink);
}

.lists {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr));
  gap: 1.25rem 1rem;
}

.list-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0;
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

.list-card:focus-visible {
  outline: 2px solid var(--tint);
  outline-offset: 4px;
  border-radius: 12px;
}

.cover {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  margin-bottom: 0.5rem;
  overflow: hidden;
  background: var(--as-raised);
  border-radius: 12px;
  box-shadow: 0 0 0 1px var(--as-line);
  transition: translate var(--dur-fast);
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (hover: hover) {
  .list-card:hover .cover {
    translate: 0 -2px;
  }
}

.liked-cover {
  font-size: 2.5rem;
  color: #fff;
  background: linear-gradient(135deg, #e33 0%, #7a2bd6 100%);
}

.liked-cover :deep(path) {
  fill: currentColor;
}

.list-card strong {
  color: var(--as-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-card > span:last-child {
  font-size: 0.8rem;
  color: var(--as-ink-3);
}

/* ---------- One playlist ---------- */
.playlist {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem 0.25rem 0;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--as-ink-3);
  background: none;
  border: 0;
  cursor: pointer;
}

.back:hover {
  color: var(--as-ink);
}

.back svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.pl-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.pl-actions .btn-quiet {
  color: var(--as-ink);
  background: rgb(255 255 255 / 0.05);
  box-shadow: inset 0 0 0 1px var(--as-line);
}

.tracks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.track {
  width: 100%;
  display: grid;
  grid-template-columns: 2rem auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.5rem;
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color var(--dur-fast);
}

@media (hover: hover) {
  .track:hover:not(:disabled) {
    background: var(--as-hover);
  }
}

.track.on {
  background: color-mix(in srgb, var(--tint) 12%, transparent);
}

.track.off {
  cursor: not-allowed;
  opacity: 0.45;
}

.num {
  text-align: right;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  color: var(--as-ink-3);
}

.track img {
  width: 3.5rem;
  height: 2rem;
  object-fit: cover;
  border-radius: 6px;
}

.track-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.track-text strong {
  font-weight: 600;
  font-size: 0.92rem;
  color: var(--as-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-text span {
  font-size: 0.8rem;
  color: var(--as-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.now-tag {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--tint);
}

.empty-line {
  margin: 0;
  color: var(--as-ink-2);
}

@media (max-width: 520px) {
  .track {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .num {
    display: none;
  }
}
</style>
