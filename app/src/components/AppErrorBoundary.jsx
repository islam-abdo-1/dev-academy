import { Component } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("App crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <p className="font-mono text-5xl font-bold text-primary">!</p>
          <h1 className="text-xl font-semibold text-foreground">
            حصل خطأ غير متوقع
          </h1>
          <p className="text-muted-foreground text-sm max-w-sm">
            جرّب إعادة تحميل الصفحة — لو الخطأ استمر، من فضلك كلمنا.
          </p>
          <Button onClick={() => window.location.reload()} className="gap-2">
            <RefreshCw size={14} />
            إعادة التحميل
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
