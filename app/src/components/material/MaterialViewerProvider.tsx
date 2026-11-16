import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { isWorkerFileUrl, normalizeWorkerFileUrl } from "@/lib/workerUrl";
import type { Material } from "@/components/material/types";

const MaterialViewerDialog = lazy(() =>
  import("@/components/material/MaterialViewerDialog").then((module) => ({
    default: module.MaterialViewerDialog,
  })),
);
const QuickSaveDialog = lazy(() =>
  import("@/components/material/QuickSaveDialog").then((module) => ({
    default: module.QuickSaveDialog,
  })),
);
const ShareMaterialDialog = lazy(() =>
  import("@/components/share/ShareMaterialDialog").then((module) => ({
    default: module.ShareMaterialDialog,
  })),
);

interface MaterialViewerContextValue {
  openMaterial: (material: Material) => void;
  closeMaterial: () => void;
  openQuickSave: (material: Material) => void;
  openShare: (material: Material) => void;
}

const MaterialViewerContext = createContext<MaterialViewerContextValue | null>(null);

export function MaterialViewerProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeMaterial, setActiveMaterial] = useState<Material | null>(null);
  const [preparingMaterial, setPreparingMaterial] = useState<Material | null>(null);
  const [saveMaterial, setSaveMaterial] = useState<Material | null>(null);
  const [shareMaterial, setShareMaterial] = useState<Material | null>(null);
  const requestRef = useRef(0);

  const openMaterial = useCallback(
    (material: Material) => {
      if (!material?.url) {
        toast.error("لا يمكن فتح هذا الملف.");
        return;
      }

      const fileUrl = normalizeWorkerFileUrl(material.url);
      if (!isWorkerFileUrl(fileUrl)) {
        requestRef.current += 1;
        setPreparingMaterial(null);
        setActiveMaterial({ ...material, url: fileUrl });
        return;
      }

      const requestId = ++requestRef.current;
      setPreparingMaterial(material);

      import("@/lib/storage/hfWorker")
        .then(({ signedStoredFileUrl }) => signedStoredFileUrl(fileUrl))
        .then((previewUrl) => {
          if (requestId !== requestRef.current) return;
          setActiveMaterial({
            ...material,
            url: fileUrl,
            previewUrl,
          });
          if (!previewUrl) {
            toast.error(
              "تعذر تجهيز معاينة آمنة. يمكنك تحميل الملف بدلًا من المعاينة.",
            );
          }
        })
        .catch(() => {
          if (requestId !== requestRef.current) return;
          setActiveMaterial({ ...material, url: fileUrl, previewUrl: null });
          toast.error(
            "تعذر تجهيز معاينة آمنة. يمكنك تحميل الملف بدلًا من المعاينة.",
          );
        })
        .finally(() => {
          if (requestId === requestRef.current) {
            setPreparingMaterial(null);
          }
        });
    },
    [],
  );

  const closeMaterial = useCallback(() => {
    requestRef.current += 1;
    setPreparingMaterial(null);
    setActiveMaterial(null);
  }, []);

  useEffect(
    () => () => {
      requestRef.current += 1;
    },
    [],
  );

  const openQuickSave = useCallback(
    (material: Material) => {
      if (!user) {
        toast.error("سجّل الدخول أولًا لحفظ المواد في الخزنة");
        return;
      }
      setSaveMaterial(material);
    },
    [user],
  );

  const openShare = useCallback(
    (material: Material) => {
      if (!user) {
        toast.error("سجّل الدخول أولًا لإنشاء رابط مشاركة");
        return;
      }
      setShareMaterial(material);
    },
    [user],
  );

  const value = useMemo(
    () => ({ openMaterial, closeMaterial, openQuickSave, openShare }),
    [openMaterial, closeMaterial, openQuickSave, openShare],
  );

  return (
    <MaterialViewerContext.Provider value={value}>
      {children}
      {preparingMaterial && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[10005] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex max-w-sm items-center gap-3 rounded-2xl border border-border bg-background px-5 py-4 shadow-2xl">
            <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">جارٍ تجهيز الملف...</p>
              <p className="truncate text-xs text-muted-foreground">
                {preparingMaterial.title}
              </p>
            </div>
          </div>
        </div>
      )}
      <Suspense fallback={null}>
        {activeMaterial && (
          <MaterialViewerDialog
            material={activeMaterial}
            onClose={closeMaterial}
            onShare={openShare}
            onSave={openQuickSave}
            inactive={Boolean(saveMaterial || shareMaterial)}
          />
        )}
        {saveMaterial && (
          <QuickSaveDialog
            open
            material={saveMaterial}
            onClose={() => setSaveMaterial(null)}
          />
        )}
        {shareMaterial && (
          <ShareMaterialDialog
            open
            material={shareMaterial}
            onClose={() => setShareMaterial(null)}
          />
        )}
      </Suspense>
    </MaterialViewerContext.Provider>
  );
}

export function useMaterialViewer(): MaterialViewerContextValue {
  const context = useContext(MaterialViewerContext);
  if (!context) {
    throw new Error("useMaterialViewer must be used within MaterialViewerProvider");
  }
  return context;
}
