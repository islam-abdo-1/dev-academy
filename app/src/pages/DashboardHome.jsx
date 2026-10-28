import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  BookOpen,
  FileText,
  GraduationCap,
  Star,
  UserPlus,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MAJOR_LABELS,
  SEMESTER_LABELS,
  YEAR_LABELS,
} from '@/components/subjects/labels'
import { db } from '@/lib/api'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

function StatCard({ title, value, icon: Icon, loading }) {
  return (
    <Card className="neon-card bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon size={18} className="text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16 bg-muted" />
        ) : (
          <p className="text-3xl font-bold text-foreground">{value}</p>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardHome() {
  const { profile } = useAuth()
  const [trackPeers, setTrackPeers] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [subjectsLoading, setSubjectsLoading] = useState(true)
  const [resources, setResources] = useState([])
  const [resourcesLoading, setResourcesLoading] = useState(true)
  const [activityLogs, setActivityLogs] = useState([])
  const [activityLogsLoading, setActivityLogsLoading] = useState(true)
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_admin_analytics')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) throw error
        setAnalytics(data || null)
      })
      .catch(() => {
        if (!cancelled) setAnalytics(null)
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!profile?.major || !profile?.year) {
      setTrackPeers(null)
      return
    }
    let cancelled = false
    db.filter('profiles', { role: ['admin', 'super_admin'] })
      .then((rows) => {
        if (cancelled) return
        setTrackPeers(
          (rows || []).filter(
            (row) =>
              !row.disabled &&
              row.major === profile.major &&
              row.year === profile.year,
          ).length,
        )
      })
      .catch(() => {
        if (!cancelled) setTrackPeers(null)
      })
    return () => {
      cancelled = true
    }
  }, [profile?.major, profile?.year])

  useEffect(() => {
    let cancelled = false
    db.list('subjects')
      .then((data) => {
        if (!cancelled) setSubjects(data || [])
      })
      .catch(() => {
        if (!cancelled) setSubjects([])
      })
      .finally(() => {
        if (!cancelled) setSubjectsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    db.list('resources')
      .then((data) => {
        if (!cancelled) setResources(data || [])
      })
      .catch(() => {
        if (!cancelled) setResources([])
      })
      .finally(() => {
        if (!cancelled) setResourcesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    db.list('activity_logs', { order: 'created_date', asc: false, limit: 10 })
      .then((data) => {
        if (!cancelled) setActivityLogs(data || [])
      })
      .catch(() => {
        if (!cancelled) setActivityLogs([])
      })
      .finally(() => {
        if (!cancelled) setActivityLogsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">Dashboard</h1>

      <Card className="neon-card bg-card mb-6">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="rounded-lg bg-primary/10 p-3 text-primary">
            <GraduationCap size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">مساري</p>
            <p className="text-lg font-semibold text-foreground">
              {MAJOR_LABELS[profile?.major] || 'بدون تخصص'} ·{' '}
              {YEAR_LABELS[profile?.year] || 'بدون سنة'} ·{' '}
              {SEMESTER_LABELS[profile?.semester] || 'بدون ترم'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {trackPeers === null ? (
                <>
                  حدّد مسارك من{' '}
                  <Link to="/profile" className="text-primary underline">
                    الملف الشخصي
                  </Link>{' '}
                  عشان تظهر في مجموعة الفريق.
                </>
              ) : (
                `${trackPeers} أدمن في نفس التخصص والسنة.`
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/dashboard/tracks">
                فريق المسار
                <ArrowLeft size={15} className="mr-2" />
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/dashboard/ratings">
                <Star size={15} className="ml-1.5" />
                التقييمات
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Subjects" value={subjects.length} icon={BookOpen} loading={subjectsLoading} />
        <StatCard title="Total Resources" value={resources.length} icon={FileText} loading={resourcesLoading} />
        <StatCard
          title="PDF Resources"
          value={resources.filter((resource) => resource.type === 'pdf').length}
          icon={FileText}
          loading={resourcesLoading}
        />
        <StatCard title="Recent Actions" value={activityLogs.length} icon={Activity} loading={activityLogsLoading} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Registered Users" value={analytics?.total_users ?? 0} icon={Users} loading={analyticsLoading} />
        <StatCard title="New Users Today" value={analytics?.new_users_today ?? 0} icon={UserPlus} loading={analyticsLoading} />
        <StatCard title="New Users (7 days)" value={analytics?.new_users_7d ?? 0} icon={UserPlus} loading={analyticsLoading} />
        <StatCard title="Uploads Today" value={analytics?.uploads_today ?? 0} icon={FileText} loading={analyticsLoading} />
      </div>
      <Card className="neon-card bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityLogsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((key) => (
                <Skeleton key={key} className="h-10 w-full bg-muted" />
              ))}
            </div>
          ) : activityLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {activityLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30">
                  <Activity size={14} className="text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{log.action}</span>
                      {log.entity_name && (
                        <span className="text-muted-foreground"> — {log.entity_name}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{log.performed_by}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
