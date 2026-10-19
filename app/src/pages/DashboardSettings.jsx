import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Activity,
  ClipboardList,
  Database,
  Key,
  Megaphone,
  Settings,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import { db } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { formatDate } from "@/lib/formatDate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import BroadcastPanel from "@/components/settings/BroadcastPanel";
import TasksPanel from "@/components/settings/TasksPanel";

export default function DashboardSettings() {
  const { user, profile, isStaff, isSuperAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const email = profile?.email || user?.email || "";
  const accountUser = { email, full_name: profile?.full_name || "" };
  const isStaffRole = isStaff || isSuperAdmin;

  useEffect(() => {
    let active = true;
    db.list("activity_logs", { order: "created_date", asc: false, limit: 50 })
      .then((rows) => {
        if (!active) return;
        setLogs(rows);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!isStaffRole) return <Navigate to="/dashboard" replace />;

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">
        System Settings
      </h1>
      <BroadcastPanel user={accountUser} />
      <TasksPanel user={accountUser} />
      {isSuperAdmin ? (
      <Card className="neon-card bg-card mb-8">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <Shield size={20} className="text-primary" />
            صلاحيات السوبر أدمن
            <Badge className="bg-primary/20 text-primary border border-primary/30 text-xs ml-auto">
              ⚡ SUPER ADMIN
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                icon: Megaphone,
                label: "إرسال إعلانات عامة",
                desc: "إرسال رسائل لجميع المستخدمين أو لشخص محدد",
              },
              {
                icon: Users,
                label: "إدارة الفريق",
                desc: "دعوة الأعضاء وتعديل الأدوار وحذف المستخدمين",
              },
              {
                icon: Key,
                label: "التحكم الكامل",
                desc: "إنشاء وتعديل وحذف أي محتوى على المنصة",
              },
              {
                icon: Database,
                label: "سجل الأنشطة",
                desc: "مراقبة جميع العمليات التي تمت على المنصة",
              },
            ].map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-primary/10"
              >
                <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                  <Icon size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {label}
                  </p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      ) : (
        <Card className="neon-card bg-card mb-8">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Shield size={20} className="text-primary" />
              صلاحياتك كأدمن
              <Badge className="bg-muted text-muted-foreground border border-border text-xs ml-auto">
                🛡️ ADMIN
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  icon: Megaphone,
                  label: "إرسال إعلانات ورسائل",
                  desc: "لجميع المستخدمين أو لشخص محدد أو لمسار",
                },
                {
                  icon: ClipboardList,
                  label: "إضافة مهام",
                  desc: "مهام للطلاب حسب المسار",
                },
                {
                  icon: Trash2,
                  label: "إدارة ما أنشأته",
                  desc: "تعديل وحذف الرسائل والإعلانات والمهام التي أرسلتها أنت فقط",
                },
              ].map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-primary/10"
                >
                  <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                    <Icon size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {label}
                    </p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="neon-card bg-card mb-8">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <Settings size={20} className="text-primary" />
            Platform Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Platform
              </p>
              <p className="text-foreground font-semibold">Dev Academy</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Version
              </p>
              <p className="text-foreground font-semibold">v2.0 — Production</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Owner
              </p>
              <p className="text-foreground font-semibold">ENG. ISLAM ABDO</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Access Level
              </p>
              <Badge
                className={
                  isSuperAdmin
                    ? "bg-primary/20 text-primary border border-primary/30 text-xs"
                    : "bg-muted text-muted-foreground border border-border text-xs"
                }
              >
                {isSuperAdmin ? "⚡ SUPER ADMIN" : "🛡️ ADMIN"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="neon-card bg-card">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <Activity size={20} className="text-primary" />
            System Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((item) => (
                <Skeleton key={item} className="h-12 bg-muted rounded-lg" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No activity recorded yet
            </p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                >
                  <div className="p-1.5 rounded bg-primary/10">
                    <Activity size={14} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{log.action}</span>
                      {log.entity_name && (
                        <span className="text-muted-foreground">
                          {" "}
                          — {log.entity_name}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.performed_by}
                      {log.created_date &&
                        ` · ${formatDate(new Date(log.created_date), "MMM d, yyyy HH:mm")}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {log.entity_type}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
