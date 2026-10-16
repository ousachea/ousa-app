// Everything on the CV page (/cv), kept apart from the layout so it can be updated in one place
import type { CvIconName } from '~/components/CvIcon.vue'

export const PROFILE = {
  name: 'Ousa Chea',
  handle: '@ousachea',
  /** Square, cropped around the face (public/cv) */
  photo: '/cv/ousa.jpg',
  /** The hero's big line; the photo and first name follow it */
  headline: 'Leading digital projects from kickoff to launch, with',
  role: 'Project Manager · Digital Products',
  tagline: 'Full-time project manager leading digital products from discovery to delivery: on time, on scope, and user-centred.',
  location: 'Phnom Penh, Cambodia',
  timezone: 'GMT+7',
  email: 'ousauser@gmail.com',
  phone: '+855 92 850 751',
  availability: 'Available for projects',
  focus: ['Project Management', 'Agile Delivery', 'UX/UI']
}

export const STATS = [
  { value: '8+', label: 'Years experience' },
  { value: '50+', label: 'Projects delivered' },
  { value: '30+', label: 'Happy clients' },
  { value: '12+', label: 'Countries reached' },
  { value: '95%', label: 'On-time delivery' }
]

export const CLIENTS = [
  'UNDP DigitalX', 'Data to Policy', 'UN Innovation', 'CASIC Cambodia', 'Vertical Fitness', 'Eleven Degrees',
  'Fingertip', 'Hotel KVL', 'Bright Consulting', 'Multiple Natures', 'OCIC', 'GIA Tower', 'UNDP Digital Strategy',
  're:edge Architecture', 'Edge & Story', 'Canadia Bank', 'Photo Phnom Penh', 'Residence 110', 'Richreay Group'
]

export const ABOUT = [
  'I’m a full-time project manager for digital products. I take projects from discovery to delivery, keeping teams aligned, scope tight and stakeholders informed, so what ships is on time and right for the people who use it.',
  'Based in Phnom Penh, Cambodia, I’ve spent 8+ years delivering digital products across banking, NGOs and hospitality, owning the full lifecycle from stakeholder alignment and sprint planning to design, development, UAT and go-live. My background in UX/UI design and web development means I speak the language of every team I lead.'
]

export const BUILDING = {
  name: 'Nuxt Tool',
  stack: 'Nuxt 3 · Netlify · Personal project',
  links: ['https://ousanuxt3.netlify.app', 'https://ousanuxt2.netlify.app']
}

export const SERVICES: { icon: CvIconName, title: string, text: string }[] = [
  { icon: 'calendar', title: 'Project Management', text: 'End-to-end delivery of digital products: scope, timelines, budgets and risks managed from kickoff to go-live.' },
  { icon: 'clipboard', title: 'Agile Delivery', text: 'Sprint planning, backlog grooming and stand-ups that keep design, development and QA moving together.' },
  { icon: 'users', title: 'Stakeholder Management', text: 'Clear reporting and steady communication, so clients, leadership and teams always know where things stand.' },
  { icon: 'layout', title: 'UX/UI & Web Design', text: 'Hands-on design know-how, from user research and wireframes to polished, responsive websites.' }
]

export const WORK = [
  {
    title: 'UNDP Digital Strategy',
    tags: 'Web Design · Development',
    text: 'Led the full design and development of UNDP’s Digital Strategy microsite: clean, responsive, and accessible across devices.',
    facts: [{ value: 'Global', label: 'Audience reach' }, { value: 'A11Y', label: 'Accessible' }, { value: '100%', label: 'Brand compliant' }]
  },
  {
    title: 'Hotel KVL',
    tags: 'Web Design · Development',
    text: 'Designed and developed the corporate site for Hotel KVL Group. Delivered a brand-consistent site and ran CMS training for the internal team.',
    facts: [{ value: 'Multi', label: 'Property site' }, { value: 'Self', label: 'Managed CMS' }, { value: '100%', label: 'Brand aligned' }]
  },
  {
    title: 're:edge Architecture',
    tags: 'Web Design · Development',
    text: 'Developed a visually engaging, responsive website for re:edge Architecture, showcasing their architectural projects with sleek animations and fast performance.',
    facts: [{ value: 'Pixel', label: 'Perfect build' }, { value: 'Fast', label: 'Load times' }, { value: 'Award', label: 'Industry praise' }]
  }
]

export const JOBS = [
  {
    role: 'Digital Product Execution & Implementation Supervisor',
    org: 'Canadia Bank',
    years: '2024 – Present',
    points: [
      'Oversee the deployment and execution of digital products including Mobile Banking, managing inquiries and ensuring seamless operations.',
      'Coordinate project implementation across Design, Development, UAT, and detailed documentation.'
    ]
  },
  {
    role: 'Freelance Web Design & Development',
    org: 'Freelance',
    years: '2021 – Present',
    points: [
      'Built websites for leading regional hotels and food & beverage outlets.',
      'Managed the full project lifecycle from client briefing through design, development, and delivery.'
    ]
  },
  {
    role: 'Webflow Developer & UX/UI Designer',
    org: 'Mäd',
    years: '2020 – 2023',
    points: [
      'Designed and developed websites for UNDP, GIZ, and ILO.',
      'Proficient in the full Adobe Suite, Figma, and Webflow end to end.',
      'Worked across financial, corporate, and hospitality sectors.'
    ]
  },
  {
    role: 'UX/UI Designer',
    org: 'Khalibre',
    years: '2019 – 2020',
    points: [
      'Developed a comprehensive design system including UI components, buttons, and colour schemes.',
      'Performed quality checks to ensure outputs aligned with prototypes.'
    ]
  },
  {
    role: 'UX/UI Designer',
    org: 'SALA Tech',
    years: '2018 – 2019',
    points: [
      'Led the design of a school management platform for teachers, students, and parents.',
      'Designed mobile apps and digital marketing campaigns.'
    ]
  },
  {
    role: 'Front End Designer',
    org: 'System Experts',
    years: '2017 – 2018',
    points: ['Designed and developed the company website, and handled technical support and SEO for improved rankings.']
  },
  {
    role: 'Media & Communication (Volunteer)',
    org: 'Photo Phnom Penh Association',
    years: '2016 – 2017',
    points: ['Liaised with the press and coordinated photographers and videographers for event coverage.']
  },
  {
    role: 'Photographer (Volunteer)',
    org: 'INSPIRED.Cambodia',
    years: '2016 – 2017',
    points: ['Handled photography and creative direction for a Phnom Penh restaurant, coordinating with the magazine team.']
  }
]

export const EDUCATION = [
  { title: 'Bachelor of Computer Science', org: 'Royal University of Phnom Penh (RUPP)', years: '2016 – 2017' },
  { title: 'Diploma in Web Design', org: 'IT Step Academy', years: '2017 – 2018' },
  { title: 'Google UX Design Professional Certificate', org: 'Coursera', years: '2022 – 2023' },
  { title: 'Webflow Experts Certification (95%)', org: 'Webflow', years: '2022' },
  { title: 'UX Design Certification', org: 'Uxcel', years: '2022' },
  { title: 'Social Media Management', org: 'Udemy', years: '2017 – 2018' }
]

export const CERTIFIED = ['PMP®', 'CSM®', 'Google UX Design', 'Webflow Expert (95%)', 'Uxcel UX Design']

export const SKILLS = [
  {
    icon: 'clipboard' as CvIconName,
    name: 'Management',
    items: [['Project Management', 95], ['Agile / Scrum', 90], ['Stakeholder Comms', 85], ['Product Roadmapping', 88], ['Sprint Planning', 87], ['Risk Management', 80], ['Budget Management', 76]]
  },
  {
    icon: 'palette' as CvIconName,
    name: 'Design',
    items: [['Figma', 92], ['UI / UX Design', 88], ['Design Systems', 80], ['Wireframing', 91], ['Prototyping', 89], ['User Research', 84], ['Adobe XD', 75]]
  },
  {
    icon: 'code' as CvIconName,
    name: 'Technical',
    items: [['HTML & CSS', 78], ['Webflow', 74], ['Responsive Design', 82], ['JavaScript', 62], ['Git / Version Control', 68], ['CMS (Contentful / Strapi)', 70]]
  }
] as const

export const TOOLBOX = ['Figma', 'Jira', 'Notion', 'Asana', 'Webflow', 'Adobe XD', 'Slack', 'Miro', 'HTML/CSS', 'Google Suite']

export const LANGUAGES = [
  { name: 'Khmer', level: 'Native' },
  { name: 'English', level: 'Fluent' }
]

export const TESTIMONIALS = [
  { quote: 'Ousa brought clarity and calm to a chaotic project. We launched on time and the design exceeded every expectation. I’d work with him again without hesitation.', name: 'Sarah K.', role: 'CEO · RetailBrand' },
  { quote: 'Rare to find someone who can straddle PM rigour and design sensibility. Ousa kept our team aligned, the scope tight, and the UI beautiful.', name: 'James T.', role: 'CTO · SaaS Startup' },
  { quote: 'The new website Ousa designed tripled our inbound leads within 3 months. His Webflow skills are exceptional and he communicated every step of the way.', name: 'Mei L.', role: 'Marketing Director · FinTech Co.' },
  { quote: 'Ousa managed our Mobile Banking rollout end to end. His ability to coordinate between design, dev, and UAT teams while keeping stakeholders informed was outstanding.', name: 'David R.', role: 'Head of Product · Regional Bank' },
  { quote: 'We needed a website that matched our brand’s elegance. Ousa delivered beyond what we imagined: on time, on budget, and stunning on every device.', name: 'Nita S.', role: 'GM · Boutique Hotel Group' }
]

export const ARTICLES = [
  { kind: 'Case study', minutes: 8, title: 'Canadia Bank Mobile Banking v3 vs v5', text: 'From strong roots to smarter experiences: a UX/UI and product execution perspective.' },
  { kind: 'Project management', minutes: 5, title: 'Waterfall vs Agile', text: 'Which project management methodology is right for your team?' },
  { kind: 'UX design', minutes: 6, title: 'Gestalt Principles for UX Designers', text: 'How psychological laws shape effective, user-friendly digital interfaces.' }
]

// ---------- The editable CV ----------
// The constants above are the built-in content. Once edited on the page, the CV lives in Firestore at
// public/cv (anyone can read it, only the owner can change it) and this is just the starting point.

export interface CvPair { value: string, label: string }
export interface CvService { icon: CvIconName, title: string, text: string }
export interface CvWork { title: string, tags: string, text: string, url?: string, facts: CvPair[] }
export interface CvJob { role: string, org: string, years: string, points: string[] }
export interface CvEducation { title: string, org: string, years: string }
export interface CvSkillGroup { icon: CvIconName, name: string, items: { name: string, level: number }[] }
export interface CvLanguage { name: string, level: string }
export interface CvTestimonial { quote: string, name: string, role: string }
export interface CvArticle { kind: string, minutes: number, title: string, text: string, url?: string }

export interface CvContent {
  profile: typeof PROFILE
  /** Five numbers, in this order: years, projects, clients, countries, on-time delivery */
  stats: CvPair[]
  clients: string[]
  about: string[]
  building: { name: string, stack: string, links: string[] }
  services: CvService[]
  work: CvWork[]
  jobs: CvJob[]
  education: CvEducation[]
  certified: string[]
  skills: CvSkillGroup[]
  toolbox: string[]
  languages: CvLanguage[]
  testimonials: CvTestimonial[]
  articles: CvArticle[]
}

export const CV_DEFAULT: CvContent = {
  profile: { ...PROFILE, focus: [...PROFILE.focus] },
  stats: STATS.map(s => ({ ...s })),
  clients: [...CLIENTS],
  about: [...ABOUT],
  building: { ...BUILDING, links: [...BUILDING.links] },
  services: SERVICES.map(s => ({ ...s })),
  work: WORK.map(w => ({ ...w, facts: w.facts.map(f => ({ ...f })) })),
  jobs: JOBS.map(j => ({ ...j, points: [...j.points] })),
  education: EDUCATION.map(e => ({ ...e })),
  certified: [...CERTIFIED],
  skills: SKILLS.map(g => ({ icon: g.icon, name: g.name, items: g.items.map(([name, level]) => ({ name, level })) })),
  toolbox: [...TOOLBOX],
  languages: LANGUAGES.map(l => ({ ...l })),
  testimonials: TESTIMONIALS.map(t => ({ ...t })),
  articles: ARTICLES.map(a => ({ ...a }))
}

/** Fills anything missing from a saved CV (a section added after it was saved) from the defaults */
export function withDefaults(saved: Partial<CvContent> | null | undefined): CvContent {
  const base = structuredClone(CV_DEFAULT)
  if (!saved || typeof saved !== 'object') return base
  const out = { ...base, ...saved } as CvContent
  out.profile = { ...base.profile, ...(saved.profile ?? {}) }
  out.building = { ...base.building, ...(saved.building ?? {}) }
  return out
}
