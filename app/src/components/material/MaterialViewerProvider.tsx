import { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
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
  const [saveMaterial, setSaveMaterial] = useState<Material | null>(null);
  const [shareMaterial, setShareMaterial] = useState<Material | null>(null);

  const openMaterial = useCallback((material: Material) => {
    if (!material?.url) {
      toast.error("لا يوجد ملف قابل للعرض");
      return;
    }
    setActiveMaterial(material);
  }, []);

  const closeMaterial = useCallback(() => {
    setActiveMaterial(null);
  }, []);

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
