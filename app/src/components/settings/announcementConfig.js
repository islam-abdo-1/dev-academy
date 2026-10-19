import {
  BookOpen,
  CircleCheckBig,
  GraduationCap,
  Info,
  Shield,
  TriangleAlert,
  User,
  Users,
  Zap,
} from 'lucide-react'

export const NOTICE_TYPES = {
  info: {
    icon: Info,
    color: 'hsl(190,100%,50%)',
    bg: 'hsla(190,100%,50%,0.1)',
    label: 'Info',
    border: 'hsla(190,100%,50%,0.3)',
  },
  warning: {
    icon: TriangleAlert,
    color: 'hsl(38,100%,55%)',
    bg: 'hsla(38,100%,55%,0.1)',
    label: 'Warning',
    border: 'hsla(38,100%,55%,0.3)',
  },
  success: {
    icon: CircleCheckBig,
    color: 'hsl(160,60%,50%)',
    bg: 'hsla(160,60%,50%,0.1)',
    label: 'Success',
    border: 'hsla(160,60%,50%,0.3)',
  },
  critical: {
    icon: Zap,
    color: 'hsl(0,84%,60%)',
    bg: 'hsla(0,84%,60%,0.1)',
    label: 'Critical',
    border: 'hsla(0,84%,60%,0.3)',
  },
}

export const TARGETS = [
  {
    id: 'all',
    label: 'الكل',
    icon: Users,
    color: 'hsl(190,100%,50%)',
    border: 'hsla(190,100%,50%,0.4)',
    bg: 'hsla(190,100%,50%,0.1)',
  },
  {
    id: 'students',
    label: 'الطلاب',
    icon: GraduationCap,
    color: 'hsl(160,60%,50%)',
    border: 'hsla(160,60%,50%,0.4)',
    bg: 'hsla(160,60%,50%,0.1)',
  },
  {
    id: 'admins',
    label: 'الأدمن',
    icon: Shield,
    color: 'hsl(38,100%,55%)',
    border: 'hsla(38,100%,55%,0.4)',
    bg: 'hsla(38,100%,55%,0.1)',
  },
  {
    id: 'doctors',
    label: 'الدكاترة',
    icon: BookOpen,
    color: 'hsl(280,60%,65%)',
    border: 'hsla(280,60%,65%,0.4)',
    bg: 'hsla(280,60%,65%,0.1)',
  },
  {
    id: 'assistants',
    label: 'المعيدين',
    icon: User,
    color: 'hsl(20,100%,60%)',
    border: 'hsla(20,100%,60%,0.4)',
    bg: 'hsla(20,100%,60%,0.1)',
  },
  {
    id: 'specific',
    label: 'شخص محدد',
    icon: User,
    color: 'hsl(0,84%,60%)',
    border: 'hsla(0,84%,60%,0.4)',
    bg: 'hsla(0,84%,60%,0.1)',
  },
]

export const ROLE_BY_TARGET = {
  students: ['user'],
  admins: ['admin', 'super_admin'],
  doctors: ['doctor'],
  assistants: ['assistant'],
}
