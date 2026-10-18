import { Brain, Shield } from 'lucide-react'

export const MAJORS = [
  {
    id: 'ai',
    label: 'MAJOR 01',
    title: 'Artificial Intelligence',
    subtitle: 'Build the Future with Intelligence',
    color: 'hsl(190, 100%, 50%)',
    colorMuted: 'hsla(190, 100%, 50%, 0.1)',
    border: 'hsla(190, 100%, 50%, 0.3)',
    icon: Brain,
    years: ['Year 1', 'Year 2', 'Year 3', 'Year 4'],
  },
  {
    id: 'cybersecurity',
    label: 'MAJOR 02',
    title: 'Cybersecurity',
    subtitle: 'Protect. Detect. Defend.',
    color: 'hsl(160, 60%, 50%)',
    colorMuted: 'hsla(160, 60%, 50%, 0.1)',
    border: 'hsla(160, 60%, 50%, 0.3)',
    icon: Shield,
    years: ['Year 1', 'Year 2', 'Year 3', 'Year 4'],
  },
]
