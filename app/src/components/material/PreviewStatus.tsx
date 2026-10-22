import { AlertTriangle, LoaderCircle } from "lucide-react";

export function PreviewStatus({
  loading,
  error,
}: {
  loading?: boolean;
  error?: string | null;
}) {
  if (loading) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 px-6 text-center">
      <AlertTriangle className="h-9 w-9 text-amber-400" />
      <p className="text-sm text-muted-foreground">
        {error || "تعذر عرض هذا الملف."}
      </p>
    </div>
  );
}
