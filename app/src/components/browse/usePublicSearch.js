import { useEffect, useState } from 'react'

export default function usePublicSearch() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    open,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
  }
}
