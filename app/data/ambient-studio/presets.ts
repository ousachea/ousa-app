import type { AmbientCategory, AmbientLayerDef, AmbientPreset } from '~/types/ambient-studio'

// Ambient Studio's starting scenes. Every YouTube id here was checked as public and embeddable
// (YouTube oEmbed) on 11 October 2026; channels can still remove a video or turn embedding off
// later, and the player says so when that happens.

export const AMBIENT_CATEGORIES: AmbientCategory[] = [
  { id: 'focus', name: 'Focus & Productivity', blurb: 'Steady sound for deep work' },
  { id: 'rain', name: 'Rain & Thunder', blurb: 'Rain on glass, storms far off' },
  { id: 'cozy', name: 'Cozy & Fireplace', blurb: 'Crackling fires and warm rooms' },
  { id: 'nature', name: 'Nature & Forest', blurb: 'Birdsong, leaves and wind' },
  { id: 'ocean', name: 'Ocean & Water', blurb: 'Waves rolling in' },
  { id: 'night', name: 'Night & City', blurb: 'Quiet streets after dark' },
  { id: 'scifi', name: 'Cyberpunk & Sci-Fi', blurb: 'Neon, engines and deep space' },
  { id: 'lofi', name: 'Lo-Fi & Study', blurb: 'Soft beats to work to' },
  { id: 'sleep', name: 'Sleep & Relaxation', blurb: 'Slow and low for winding down' },
  { id: 'noise', name: 'White Noise', blurb: 'Plain noise that masks the room' }
]

export const AMBIENT_LAYERS: AmbientLayerDef[] = [
  { id: 'rain', name: 'Rain', hint: 'Steady rain with drops' },
  { id: 'thunder', name: 'Thunder', hint: 'Distant rolls now and then' },
  { id: 'wind', name: 'Wind', hint: 'Gusts that rise and fall' },
  { id: 'fire', name: 'Fireplace', hint: 'Low roar and crackles' },
  { id: 'ocean', name: 'Ocean waves', hint: 'Slow swells on a beach' },
  { id: 'birds', name: 'Forest birds', hint: 'Chirps from the trees' },
  { id: 'fan', name: 'Fan', hint: 'A desk fan’s soft whirr' },
  { id: 'white', name: 'White noise', hint: 'Bright, even hiss' },
  { id: 'pink', name: 'Pink noise', hint: 'Softer, like steady rain' },
  { id: 'brown', name: 'Brown noise', hint: 'Deep, low rumble' }
]

const scene = (name: string) => `/ambient-studio/scenes/${name}.svg`

export const AMBIENT_PRESETS: AmbientPreset[] = [
  {
    id: 'rainy-window',
    name: 'Rainy Window',
    description: 'Rain running down the glass of a dim room, with thunder far away.',
    category: 'rain',
    tags: ['rain', 'window', 'study', 'calm'],
    artwork: scene('rainy-window'),
    tint: '#a9bfd9',
    youtube: { videoId: 'mPZkdNFkNps', title: 'Rain on window with thunder', channel: 'Relaxing Ambience ASMR' },
    layers: [{ id: 'rain', volume: 0.55 }, { id: 'thunder', volume: 0.25 }],
    videoVolume: 45,
    effect: 'droplets'
  },
  {
    id: 'tokyo-after-dark',
    name: 'Tokyo After Dark',
    description: 'Lo-fi beats in a rainy Japanese side street after the shops have closed.',
    category: 'night',
    tags: ['city', 'night', 'japan', 'lofi', 'rain'],
    artwork: scene('tokyo-after-dark'),
    tint: '#e7a7c8',
    youtube: { videoId: 'sF80I-TQiW0', title: '90’s chill lofi with rain', channel: 'The Japanese Town' },
    layers: [{ id: 'rain', volume: 0.25 }],
    videoVolume: 60,
    effect: 'city'
  },
  {
    id: 'cozy-fireplace',
    name: 'Cozy Fireplace',
    description: 'A log fire crackling in a warm room while the wind picks up outside.',
    category: 'cozy',
    tags: ['fire', 'warm', 'winter', 'reading'],
    artwork: scene('cozy-fireplace'),
    tint: '#f0b783',
    youtube: { videoId: 'L_LUpnjgPso', title: 'Fireplace ambience', channel: 'Fireplace Atmosphere' },
    layers: [{ id: 'fire', volume: 0.6 }, { id: 'wind', volume: 0.15 }],
    videoVolume: 50,
    effect: 'embers'
  },
  {
    id: 'deep-focus',
    name: 'Deep Focus',
    description: 'Slow ambient music over soft brown noise. Nothing to catch your ear.',
    category: 'focus',
    tags: ['focus', 'work', 'ambient', 'concentration'],
    artwork: scene('deep-focus'),
    tint: '#9fd3c7',
    youtube: { videoId: 'sjkrrmBnpGE', title: 'Ambient study music to concentrate', channel: 'Quiet Quest' },
    layers: [{ id: 'brown', volume: 0.3 }],
    videoVolume: 40,
    effect: 'dust'
  },
  {
    id: 'ocean-at-midnight',
    name: 'Ocean at Midnight',
    description: 'Waves rolling onto an empty beach under a sky full of stars.',
    category: 'ocean',
    tags: ['ocean', 'waves', 'beach', 'night', 'sleep'],
    artwork: scene('ocean-at-midnight'),
    tint: '#8fb8e8',
    youtube: { videoId: 'bn9F19Hi1Lk', title: 'Ocean sounds of rolling waves', channel: 'Naturaleza Viva' },
    layers: [{ id: 'ocean', volume: 0.5 }, { id: 'wind', volume: 0.1 }],
    videoVolume: 45,
    effect: 'stars'
  },
  {
    id: 'forest-after-rain',
    name: 'Forest After Rain',
    description: 'Birds come back out in a wet forest as the last drops fall.',
    category: 'nature',
    tags: ['forest', 'birds', 'nature', 'morning'],
    artwork: scene('forest-after-rain'),
    tint: '#a8d5a2',
    youtube: { videoId: 'xNN7iTA57jM', title: 'Forest sounds: woodland ambience', channel: 'The Guild of Ambience' },
    layers: [{ id: 'birds', volume: 0.45 }, { id: 'rain', volume: 0.15 }, { id: 'wind', volume: 0.12 }],
    videoVolume: 50,
    effect: 'dust'
  },
  {
    id: 'spaceship-cabin',
    name: 'Spaceship Cabin',
    description: 'The steady hum of a ship’s engines on a long trip between stars.',
    category: 'scifi',
    tags: ['space', 'sci-fi', 'hum', 'engine', 'gaming'],
    artwork: scene('spaceship-cabin'),
    tint: '#b4b2f2',
    youtube: { videoId: 'tNkZsRW7h2c', title: 'Space ambient music', channel: 'Relaxation Ambient Music' },
    layers: [{ id: 'brown', volume: 0.45 }, { id: 'fan', volume: 0.2 }],
    videoVolume: 45,
    effect: 'stars'
  },
  {
    id: 'quiet-library',
    name: 'Quiet Library',
    description: 'Gentle piano in a hushed reading room, with a fan turning overhead.',
    category: 'focus',
    tags: ['library', 'piano', 'study', 'reading'],
    artwork: scene('quiet-library'),
    tint: '#d9c39a',
    youtube: { videoId: '4oStw0r33so', title: 'Peaceful piano radio', channel: 'Lofi Girl' },
    layers: [{ id: 'fan', volume: 0.2 }, { id: 'pink', volume: 0.1 }],
    videoVolume: 40,
    effect: 'dust'
  },
  {
    id: 'thunderstorm',
    name: 'Thunderstorm',
    description: 'Heavy rain and rolling thunder. Loud enough to drown out the room.',
    category: 'rain',
    tags: ['storm', 'thunder', 'rain', 'heavy', 'sleep'],
    artwork: scene('thunderstorm'),
    tint: '#b7c0d6',
    youtube: { videoId: 'nDq6TstdEi8', title: 'Epic thunder and rain', channel: 'Relaxing White Noise' },
    layers: [{ id: 'rain', volume: 0.7 }, { id: 'thunder', volume: 0.55 }, { id: 'wind', volume: 0.25 }],
    videoVolume: 50,
    effect: 'rain'
  },
  {
    id: 'peaceful-night',
    name: 'Peaceful Night',
    description: 'Soft night rain on a dark screen. Made for falling asleep to.',
    category: 'sleep',
    tags: ['sleep', 'night', 'rain', 'dark'],
    artwork: scene('peaceful-night'),
    tint: '#a7b4e0',
    youtube: { videoId: 'q76bMs-NwRk', title: 'Gentle night rain for sleeping', channel: 'The Relaxed Guy' },
    layers: [{ id: 'rain', volume: 0.3 }, { id: 'brown', volume: 0.2 }],
    videoVolume: 35,
    effect: 'stars'
  },
  {
    id: 'corner-cafe',
    name: 'Corner Café',
    description: 'Jazzy lo-fi in a small café on a slow afternoon, rain on the awning.',
    category: 'cozy',
    tags: ['cafe', 'coffee', 'jazz', 'lofi'],
    artwork: scene('corner-cafe'),
    tint: '#e3bf9d',
    youtube: { videoId: '2gliGzb2_1I', title: 'Coffee to go: jazzy lofi beats', channel: 'The Jazz Hop Café' },
    layers: [{ id: 'rain', volume: 0.15 }],
    videoVolume: 55,
    effect: 'dust'
  },
  {
    id: 'lofi-desk',
    name: 'Lo-fi Desk',
    description: 'A whole playlist of lo-fi mixes to study to. Skip between them.',
    category: 'lofi',
    tags: ['lofi', 'study', 'beats', 'playlist'],
    artwork: scene('lofi-desk'),
    tint: '#f2c49b',
    youtube: { playlistId: 'PL6NdkXsPL07KN01gH2vucrHCEyyNmVEx4', title: 'Lofi Girl compilations and mixes', channel: 'Lofi Girl' },
    layers: [{ id: 'rain', volume: 0.12 }],
    videoVolume: 55,
    effect: 'dust'
  },
  {
    id: 'neon-drive',
    name: 'Neon Drive',
    description: 'Synthwave for a night drive through a city of neon. Good for games, too.',
    category: 'scifi',
    tags: ['synthwave', 'cyberpunk', 'neon', 'gaming', 'retro'],
    artwork: scene('neon-drive'),
    tint: '#f0a1d8',
    youtube: { videoId: '4xDzrJKXOOY', title: 'Synthwave radio', channel: 'Lofi Girl' },
    layers: [{ id: 'rain', volume: 0.2 }],
    videoVolume: 55,
    effect: 'city'
  },
  {
    id: 'brown-noise-room',
    name: 'Brown Noise Room',
    description: 'No video, just deep brown noise with a little fan. Blocks out the room.',
    category: 'noise',
    tags: ['noise', 'brown', 'focus', 'sleep', 'offline'],
    artwork: scene('brown-noise-room'),
    tint: '#c9b8a6',
    layers: [{ id: 'brown', volume: 0.6 }, { id: 'fan', volume: 0.15 }],
    videoVolume: 0,
    effect: 'none'
  }
]

export const categoryName = (id: string) => AMBIENT_CATEGORIES.find(c => c.id === id)?.name ?? 'Your mixes'
