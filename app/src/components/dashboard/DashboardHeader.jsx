import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CircleHelp, House, Menu, Search } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import GuideDialog from './GuideDialog'
import NotificationBell from './NotificationBell'
import RoleBadge from './RoleBadge'

function HistoryNav() {
  const navigate = useNavigate()
  const isHome = useLocation().pathname === '/'

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => navigate(-1)}
        title="Go Back"
        className="group relative w-8 h-8 rounded-lg flex items-center justify-center transition-all"
        style={{
          background: 'hsla(190, 100%, 50%, 0.05)',
          border: '1px solid hsla(190, 100%, 50%, 0.2)',
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = 'hsla(190, 100%, 50%, 0.15)'
          event.currentTarget.style.borderColor = 'hsla(190, 100%, 50%, 0.5)'
          event.currentTarget.style.boxShadow = '0 0 10px hsla(190, 100%, 50%, 0.2)'
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = 'hsla(190, 100%, 50%, 0.05)'
          event.currentTarget.style.borderColor = 'hsla(190, 100%, 50%, 0.2)'
          event.currentTarget.style.boxShadow = 'none'
        }}
      >
        <ChevronLeft size={15} className="text-primary" />
        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs bg-card border border-border px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          Go Back
        </span>
      </button>
      <button
        onClick={() => navigate('/')}
        title="Go Home"
        disabled={isHome}
        className="group relative w-8 h-8 rounded-lg flex items-center justify-center transition-all"
        style={{
          background: isHome ? 'hsla(190, 100%, 50%, 0.15)' : 'hsla(190, 100%, 50%, 0.05)',
          border: `1px solid ${isHome ? 'hsla(190, 100%, 50%, 0.5)' : 'hsla(190, 100%, 50%, 0.2)'}`,
        }}
        onMouseEnter={(event) => {
          if (isHome) return
          event.currentTarget.style.background = 'hsla(190, 100%, 50%, 0.15)'
          event.currentTarget.style.borderColor = 'hsla(190, 100%, 50%, 0.5)'
          event.currentTarget.style.boxShadow = '0 0 10px hsla(190, 100%, 50%, 0.2)'
        }}
        onMouseLeave={(event) => {
          if (isHome) return
          event.currentTarget.style.background = 'hsla(190, 100%, 50%, 0.05)'
          event.currentTarget.style.borderColor = 'hsla(190, 100%, 50%, 0.2)'
          event.currentTarget.style.boxShadow = 'none'
        }}
      >
        <House size={13} className="text-primary" />
        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs bg-card border border-border px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          Go Home
        </span>
      </button>
      <button
        onClick={() => navigate(1)}
        title="Go Forward"
        className="group relative w-8 h-8 rounded-lg flex items-center justify-center transition-all"
        style={{
          background: 'hsla(190, 100%, 50%, 0.05)',
          border: '1px solid hsla(190, 100%, 50%, 0.2)',
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = 'hsla(190, 100%, 50%, 0.15)'
          event.currentTarget.style.borderColor = 'hsla(190, 100%, 50%, 0.5)'
          event.currentTarget.style.boxShadow = '0 0 10px hsla(190, 100%, 50%, 0.2)'
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = 'hsla(190, 100%, 50%, 0.05)'
          event.currentTarget.style.borderColor = 'hsla(190, 100%, 50%, 0.2)'
          event.currentTarget.style.boxShadow = 'none'
        }}
      >
        <ChevronRight size={15} className="text-primary" />
        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs bg-card border border-border px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
          Go Forward
        </span>
      </button>
    </div>
  )
}

export default function DashboardHeader({ role, onMenuToggle, onSearchOpen }) {
  const [guideOpen, setGuideOpen] = useState(false)
  const { profile } = useAuth()

  return (
    <header
      className="sticky top-0 z-20 border-b border-border/30 h-14 flex items-center px-4 gap-3"
      style={{
        backdropFilter: 'blur(12px)',
        background: 'hsla(240, 50%, 3%, 0.6)',
      }}
    >
      <button
        className="md:hidden p-2 text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
        onClick={onMenuToggle}
      >
        <Menu size={20} />
      </button>
      <div className="md:hidden flex items-center gap-2">
        <img
          src="/logo-mark.png"
          alt="Dev Academy"
          className="w-7 h-7 rounded object-cover"
        />
      </div>
      <HistoryNav />
      <button
        onClick={onSearchOpen}
        className="flex-1 max-w-md mx-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-input/50 border border-border/50 text-muted-foreground text-sm hover:border-primary/30 transition-colors cursor-pointer min-h-[40px]"
      >
        <Search size={16} />
        <span className="hidden sm:inline">Search subjects & resources...</span>
        <span className="sm:hidden">Search...</span>
        <kbd className="hidden sm:inline-flex ml-auto px-2 py-0.5 rounded bg-muted/50 border border-border/50 text-xs text-muted-foreground">
          ⌘K
        </kbd>
      </button>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setGuideOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all border border-border/50 hover:border-primary/30 min-h-[36px]"
          title="Platform Guide"
        >
          <CircleHelp size={14} />
          <span className="hidden sm:inline">Guide</span>
        </button>
        <NotificationBell userEmail={profile?.email} />
        <RoleBadge role={role} />
      </div>
      <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
    </header>
  )
}
