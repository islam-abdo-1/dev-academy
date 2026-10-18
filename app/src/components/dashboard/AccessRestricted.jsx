import { Link } from 'react-router-dom'
import { ArrowLeft, Lock, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import GlowBackground from './GlowBackground'

export default function AccessRestricted() {
  return (
    <div className="min-h-screen bg-background relative flex flex-col items-center justify-center text-center px-4">
      <GlowBackground />
      <div className="relative z-10 max-w-md w-full">
        <div className="relative flex items-center justify-center mb-8">
          <div
            className="w-28 h-28 rounded-full flex items-center justify-center"
            style={{
              background: 'hsla(0,84%,60%,0.08)',
              border: '1px solid hsla(0,84%,60%,0.25)',
              boxShadow: '0 0 40px hsla(0,84%,60%,0.15)',
            }}
          >
            <Lock
              size={48}
              className="text-destructive"
              style={{ filter: 'drop-shadow(0 0 8px hsla(0,84%,60%,0.5))' }}
            />
          </div>
          <div
            className="absolute -top-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: 'hsla(190,100%,50%,0.15)',
              border: '1px solid hsla(190,100%,50%,0.4)',
            }}
          >
            <ShieldAlert size={18} className="text-primary" />
          </div>
        </div>
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono mb-4"
          style={{
            background: 'hsla(190,100%,50%,0.08)',
            border: '1px solid hsla(190,100%,50%,0.25)',
            color: 'hsl(190,100%,50%)',
          }}
        >
          <ShieldAlert size={12} />
          ADMIN / SUPER ADMIN ONLY
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">Access Restricted</h1>
        <p className="text-muted-foreground mb-2">هذه الصفحة مخصصة للمسؤولين فقط.</p>
        <p className="text-muted-foreground text-sm mb-8">
          This dashboard is restricted to <span className="text-primary font-medium">Admin</span>{' '}
          and <span className="text-primary font-medium">Super Admin</span> accounts only. If you
          believe this is a mistake, please contact your administrator.
        </p>
        <Link to="/">
          <Button className="bg-primary text-primary-foreground hover:brightness-110 gap-2">
            <ArrowLeft size={16} />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  )
}
