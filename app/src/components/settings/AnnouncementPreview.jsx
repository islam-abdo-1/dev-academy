import { useState } from 'react'
import { NOTICE_TYPES } from '@/components/settings/announcementConfig'

export default function AnnouncementPreview({ preview }) {
  const [dismissed, setDismissed] = useState(false)
  if (!preview || dismissed) return null
  const config = NOTICE_TYPES[preview.type] || NOTICE_TYPES.info
  const Icon = config.icon
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-start gap-3 border"
      style={{ background: config.bg, borderColor: config.border }}
    >
      <Icon size={18} style={{ color: config.color, flexShrink: 0, marginTop: 1 }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold" style={{ color: config.color }}>
          {preview.title}
        </p>
        <p className="text-sm text-foreground/80 mt-0.5 whitespace-pre-wrap">{preview.body}</p>
      </div>
      {!preview?.isPreview && (
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground text-lg leading-none flex-shrink-0"
        >
          ×
        </button>
      )}
    </div>
  )
}
