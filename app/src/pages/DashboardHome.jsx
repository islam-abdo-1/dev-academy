import { useEffect, useState } from 'react'
import { Activity, BookOpen, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { db } from '@/lib/api'

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
  const [subjects, setSubjects] = useState([])
  const [subjectsLoading, setSubjectsLoading] = useState(true)
  const [resources, setResources] = useState([])
  const [resourcesLoading, setResourcesLoading] = useState(true)
  const [activityLogs, setActivityLogs] = useState([])
  const [activityLogsLoading, setActivityLogsLoading] = useState(true)

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
