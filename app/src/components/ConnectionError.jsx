import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConnectionError({
  onRetry,
  message = "تعذّر الاتصال بالسيرفر — تأكد من اتصالك بالإنترنت وحاول تاني",
  fullPage = false,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 text-center px-6 ${
        fullPage ? "min-h-screen" : "py-16"
      }`}
    >
      <WifiOff size={36} className="text-muted-foreground" />
      <p className="text-muted-foreground text-sm max-w-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RefreshCw size={14} />
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
