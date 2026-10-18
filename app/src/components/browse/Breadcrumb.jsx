import { Link } from 'react-router-dom'
import { ChevronRight, House } from 'lucide-react'

export default function Breadcrumb({ items = [] }) {
  return (
    <nav
      className="flex items-center flex-wrap gap-1 text-sm font-mono mb-6"
      aria-label="Breadcrumb"
    >
      <Link
        to="/"
        className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
      >
        <House size={13} />
        <span>Home</span>
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={index} className="flex items-center gap-1">
            <ChevronRight size={13} className="text-muted-foreground/50 flex-shrink-0" />
            {isLast || !item.href ? (
              <span className="font-semibold text-primary">{item.label}</span>
            ) : (
              <Link
                to={item.href}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
