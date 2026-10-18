import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { db } from '@/lib/api'
import { useAuth } from '@/lib/AuthContext'
import UserAvatar from '@/components/UserAvatar'
import RoleBadge from './RoleBadge'

export const NAV_ITEMS = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    label: 'Subjects',
    icon: BookOpen,
    href: '/dashboard/subjects',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    label: 'Resources',
    icon: FileText,
    href: '/dashboard/resources',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
  { label: 'Team', icon: Users, href: '/dashboard/team', roles: ['SUPER_ADMIN'] },
  {
    label: 'Settings',
    icon: Settings,
    href: '/dashboard/settings',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
]

export default function DashboardSidebar({ role, user, mobileOpen, onCloseMobile }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [unreadMessages, setUnreadMessages] = useState([])

  const navItems = NAV_ITEMS.filter((item) => item.roles.includes(role))

  useEffect(() => {
    if (!user?.email) return
    let cancelled = false
    const load = () => {
      db.filter('messages', { to_email: user.email, read: false })
        .then((data) => {
          if (!cancelled) setUnreadMessages(data || [])
        })
        .catch(() => {
          if (!cancelled) setUnreadMessages([])
        })
    }
    load()
    const interval = setInterval(load, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [user?.email])

  const unreadCount = unreadMessages.length || 0


  const isActive = (href) =>
    href === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname.startsWith(href)

  const goToProfile = () => {
    if (onCloseMobile) onCloseMobile()
    navigate('/profile')
  }

  const content = (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" title="Return to Home">
          <img
            src="/logo-mark.png"
            alt="Dev Academy Logo"
            className="w-8 h-8 rounded-lg object-contain border border-primary/30"
          />
          <span
            className="font-semibold text-sm"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              color: 'hsl(190, 100%, 50%)',
              letterSpacing: '0.04em',
            }}
          >
            Dev Academy
          </span>
        </Link>
        {mobileOpen && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1 text-sidebar-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        )}
      </div>
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onCloseMobile}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all min-h-[44px]"
              style={
                active
                  ? {
                      background: 'hsla(190,100%,50%,0.12)',
                      color: 'hsl(190,100%,50%)',
                      borderLeft: '3px solid hsl(190,100%,50%)',
                      boxShadow: 'inset 0 0 12px hsla(190,100%,50%,0.08)',
                    }
                  : {
                      color: 'hsl(var(--sidebar-foreground))',
                      borderLeft: '3px solid transparent',
                    }
              }
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border">
        <button
          onClick={goToProfile}
          className="flex items-center gap-3 mb-3 w-full text-left rounded-lg p-1 hover:bg-sidebar-accent transition-colors group"
          title="View Profile"
        >
          <div className="relative flex-shrink-0">
            <UserAvatar
              src={user?.avatar_url}
              alt="Avatar"
              className="w-9 h-9 rounded-full object-cover border border-primary/30"
            />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate group-hover:text-primary transition-colors">
              {user?.full_name || 'Admin'}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          {unreadCount > 0 && (
            <Bell size={14} className="text-destructive animate-pulse flex-shrink-0" />
          )}
        </button>
        <div className="flex items-center justify-between">
          <RoleBadge role={role} />
          <button
            onClick={() => signOut()}
            className="text-muted-foreground hover:text-destructive p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden md:block w-60 fixed inset-y-0 left-0 z-30">{content}</aside>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={onCloseMobile} />
          <aside className="relative w-72 h-full">{content}</aside>
        </div>
      )}
    </>
  )
}
