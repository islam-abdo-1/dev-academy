import { useState } from 'react'
import { BookOpen, ChevronRight, Navigation, Timer, User, X } from 'lucide-react'

const GUIDE_PAGES = [
  {
    icon: Navigation,
    title: 'Navigate the Platform',
    color: 'hsl(190, 100%, 50%)',
    steps: [
      'From the landing page, choose your Major (AI or Cybersecurity)',
      'Select your Academic Year (1–4)',
      'Pick your Semester (First or Second)',
      'Browse the Subject List for that semester',
    ],
  },
  {
    icon: BookOpen,
    title: 'Access Subject Resources',
    color: 'hsl(160, 60%, 50%)',
    steps: [
      'On the Subject List page, find your subject card',
      'Click the ▼ arrow on the right to expand the card',
      'View all uploaded files and links for that subject',
      'Click any resource to open or download it',
    ],
  },
  {
    icon: Timer,
    title: 'Use the Focus Timer',
    color: 'hsl(190, 100%, 50%)',
    steps: [
      'Click the ⏱ timer icon in the bottom-right corner',
      'The timer runs 25-minute work sessions',
      'After each session, a 5-minute break starts automatically',
      'Use Start / Pause / Reset to control the timer',
    ],
  },
  {
    icon: User,
    title: 'Edit Your Profile',
    color: 'hsl(160, 60%, 50%)',
    steps: [
      'Click your avatar or go to /profile',
      'Upload a profile photo by clicking the camera icon',
      'Set your Major, Year, and Semester',
      'Click "Save Changes" to update your profile',
    ],
  },
]

export default function GuideDialog({ open, onClose }) {
  const [page, setPage] = useState(0)

  if (!open) return null
  const current = GUIDE_PAGES[page]
  const Icon = current.icon

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl p-6 z-10"
        style={{
          background: 'hsl(240, 30%, 7%)',
          border: '1px solid hsla(190, 100%, 50%, 0.25)',
          boxShadow: '0 0 40px hsla(190, 100%, 50%, 0.15)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>
        <div className="mb-5">
          <p className="text-xs font-mono text-primary mb-1">HOW TO USE</p>
          <h2 className="text-xl font-bold text-foreground">Platform Guide</h2>
        </div>
        <div className="flex gap-2 mb-5 flex-wrap">
          {GUIDE_PAGES.map((guidePage, index) => {
            const PageIcon = guidePage.icon
            return (
              <button
                key={index}
                onClick={() => setPage(index)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: index === page ? guidePage.color : 'hsla(190,50%,15%,0.4)',
                  color: index === page ? 'hsl(240,50%,3%)' : 'hsl(215,20%,55%)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                <PageIcon size={12} />
                {index + 1}
              </button>
            )
          })}
        </div>
        <div
          className="rounded-xl p-5 mb-4"
          style={{
            background: 'hsla(240,50%,3%,0.6)',
            border: `1px solid ${current.color}30`,
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg" style={{ background: `${current.color}20` }}>
              <Icon size={20} style={{ color: current.color }} />
            </div>
            <h3 className="text-foreground font-semibold">{current.title}</h3>
          </div>
          <ol className="space-y-3">
            {current.steps.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ background: `${current.color}20`, color: current.color }}
                >
                  {index + 1}
                </span>
                <span className="text-muted-foreground text-sm leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            disabled={page === 0}
            className="text-sm text-muted-foreground disabled:opacity-30 hover:text-foreground transition-colors"
          >
            ← Prev
          </button>
          <div className="flex gap-1.5">
            {GUIDE_PAGES.map((guidePage, index) => (
              <div
                key={index}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{
                  background: index === page ? 'hsl(190,100%,50%)' : 'hsl(215,20%,30%)',
                }}
              />
            ))}
          </div>
          {page < GUIDE_PAGES.length - 1 ? (
            <button
              onClick={() => setPage((value) => value + 1)}
              className="flex items-center gap-1 text-sm font-medium transition-colors"
              style={{ color: 'hsl(190,100%,50%)' }}
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={onClose} className="text-sm font-medium" style={{ color: 'hsl(160,60%,50%)' }}>
              Got it ✓
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
