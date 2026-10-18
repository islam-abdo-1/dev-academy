import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { MAJORS } from '@/lib/majors'
import PublicBackground from '@/components/layout/PublicBackground'
import PublicHeader from '@/components/layout/PublicHeader'
import PublicSearchDialog from '@/components/layout/PublicSearchDialog'
import PublicFooter from '@/components/layout/PublicFooter'
import usePublicSearch from '@/components/browse/usePublicSearch'

export default function Explore() {
  const navigate = useNavigate()
  const search = usePublicSearch()

  return (
    <div className="min-h-screen bg-background relative">
      <PublicBackground />
      <PublicHeader onSearchOpen={search.onOpen} />
      <main className="pt-24 pb-16 px-4 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-4 leading-tight">
            Dev{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, hsl(190,100%,50%), hsl(160,60%,50%))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Academy
            </span>
          </h1>
          <p className="text-muted-foreground text-lg sm:text-xl mb-2">
            Premium education for elite learners in AI & Cybersecurity
          </p>
          <p className="text-primary font-mono text-base mt-6 animate-pulse">
            Choose your major to begin ↓
          </p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {MAJORS.map((major, index) => {
            const Icon = major.icon
            return (
              <motion.div
                key={major.id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + index * 0.15 }}
                onClick={() => navigate(`/${major.id}`)}
                className="group cursor-pointer rounded-2xl p-6 relative overflow-hidden"
                style={{
                  background: 'hsl(240, 30%, 7%)',
                  border: `1px solid ${major.border}`,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.transform = 'translateY(-4px)'
                  event.currentTarget.style.boxShadow = `0 0 20px ${major.border}`
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.transform = 'translateY(0)'
                  event.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs font-mono mb-1" style={{ color: major.color }}>
                      {major.label}
                    </p>
                    <h2 className="text-2xl font-bold text-foreground">{major.title}</h2>
                    <p className="text-muted-foreground text-sm mt-1">{major.subtitle}</p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: major.colorMuted }}>
                    <Icon size={28} style={{ color: major.color }} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {major.years.map((year) => (
                    <span
                      key={year}
                      className="text-xs px-3 py-1 rounded-full font-mono"
                      style={{
                        background: major.colorMuted,
                        color: major.color,
                        border: `1px solid ${major.border}`,
                      }}
                    >
                      {year}
                    </span>
                  ))}
                </div>
                <div
                  className="flex items-center gap-1 text-sm font-medium"
                  style={{ color: major.color }}
                >
                  <span>Explore major</span>
                  <ChevronRight
                    size={16}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </div>
                <div
                  className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-5 group-hover:opacity-10 transition-opacity"
                  style={{ background: major.color, filter: 'blur(20px)' }}
                />
              </motion.div>
            )
          })}
        </div>
      </main>
      <PublicFooter />
      <PublicSearchDialog open={search.open} onClose={search.onClose} />
    </div>
  )
}
