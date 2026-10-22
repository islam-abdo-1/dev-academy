import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import AccessRestricted from '@/components/dashboard/AccessRestricted'
import DashboardFooter from '@/components/dashboard/DashboardFooter'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar'
import GlowBackground from '@/components/dashboard/GlowBackground'
import SearchDialog from '@/components/dashboard/SearchDialog'
import { useRole } from '@/components/dashboard/useRole'

export default function DashboardLayout() {
  const { role, user, loading } = useRole()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (role === 'STUDENT') {
    return <AccessRestricted />
  }

  return (
    <div className="min-h-screen bg-background relative">
      <GlowBackground />
      <DashboardSidebar
        role={role}
        user={user}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="md:ml-60 flex flex-col min-h-screen relative">
        <DashboardHeader
          role={role}
          onMenuToggle={() => setMobileOpen(true)}
          onSearchOpen={() => setSearchOpen(true)}
        />
        <main className="relative z-10 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet context={{ role, user }} />
        </main>
        <DashboardFooter />
      </div>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
