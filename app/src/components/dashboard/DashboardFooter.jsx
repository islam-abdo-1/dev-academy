export default function DashboardFooter() {
  return (
    <footer className="text-center py-6 border-t border-border/30">
      <p className="flex items-center justify-center gap-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          Created by
        </span>
        <span
          style={{
            fontSize: "1.15rem",
            background:
              "linear-gradient(135deg, hsl(190,100%,50%), hsl(160,60%,50%))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          𝘌𝘕𝘎. 𝐼𝑠𝑙𝑎𝑚 𝐴𝑏𝑑𝑜
        </span>
      </p>
    </footer>
  );
}
