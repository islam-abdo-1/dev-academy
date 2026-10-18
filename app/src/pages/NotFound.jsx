import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="font-mono text-6xl font-bold text-primary">404</h1>
      <p className="text-muted-foreground">الصفحة غير موجودة</p>
      <Button asChild>
        <Link to="/">العودة للرئيسية</Link>
      </Button>
    </div>
  )
}
