import type { Material } from "@/components/material/types";
import { supabase } from "@/lib/supabase";

export type MaterialRatingType = "lecture_item" | "section_item" | "resource";

export interface MaterialRatingSummary {
  likes: number;
  dislikes: number;
  /** -1 = dislike, 0 = no vote, 1 = like */
  my_vote: number;
}

export interface MaterialRatingTarget {
  materialType: MaterialRatingType;
  materialId: string;
}

export const MATERIAL_RATING_EVENT = "dev-academy:material-rating-changed";

const summaryCache = new Map<string, MaterialRatingSummary>();
const inflight = new Map<string, Promise<MaterialRatingSummary>>();

function cacheKey(
  viewerId: string,
  type: MaterialRatingType,
  id: string,
) {
  return `${viewerId}:${type}:${id}`;
}

function normalizeSummary(row: unknown): MaterialRatingSummary {
  const value = Array.isArray(row) ? row[0] : row;
  const record = (value || {}) as Record<string, unknown>;
  return {
    likes: Number(record.likes ?? 0),
    dislikes: Number(record.dislikes ?? 0),
    my_vote: Number(record.my_vote ?? 0),
  };
}

/**
 * Map a viewer material to the rating row it belongs to.
 * Personal, shared, external and archive materials are not rateable.
 */
export function getMaterialRatingTarget(
  material: Material | null | undefined,
): MaterialRatingTarget | null {
  if (!material) return null;

  if (material.source === "official") {
    return {
      materialType:
        material.kind === "section" ? "section_item" : "lecture_item",
      materialId: material.id,
    };
  }

  if (material.source === "resource") {
    return { materialType: "resource", materialId: material.id };
  }

  return null;
}

export async function fetchMaterialRatingSummary(
  materialType: MaterialRatingType,
  materialId: string,
  viewerId: string,
): Promise<MaterialRatingSummary> {
  const key = cacheKey(viewerId, materialType, materialId);
  const cached = summaryCache.get(key);
  if (cached) return cached;

  const pending = inflight.get(key);
  if (pending) return pending;

  const request = Promise.resolve(
    supabase
      .rpc("get_material_rating_summary", {
        p_material_type: materialType,
        p_material_id: materialId,
      })
      .then(({ data, error }) => {
        if (error) throw error;
        const summary = normalizeSummary(data);
        summaryCache.set(key, summary);
        return summary;
      }),
  ).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, request);
  return request;
}

export async function rateMaterial(
  materialType: MaterialRatingType,
  materialId: string,
  value: 1 | -1,
  viewerId: string,
): Promise<MaterialRatingSummary> {
  const { data, error } = await supabase.rpc("rate_material", {
    p_material_type: materialType,
    p_material_id: materialId,
    p_value: value,
  });
  if (error) throw error;

  const summary = normalizeSummary(data);
  summaryCache.set(cacheKey(viewerId, materialType, materialId), summary);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(MATERIAL_RATING_EVENT, {
        detail: { materialType, materialId, summary },
      }),
    );
  }

  return summary;
}
