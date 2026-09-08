export type RunningCategory =
  | "under10km"
  | "10k"
  | "10-20km"
  | "halvmaraton"
  | "halvmaraton-pluss"
  | "maraton"
  | "ultra";

export const RUNNING_CATEGORY_LABEL: Record<RunningCategory, string> = {
  under10km: "<10 km",
  "10k": "10K",
  "10-20km": "10–20 km",
  halvmaraton: "Halvmaraton",
  "halvmaraton-pluss": "Halvmaraton+",
  maraton: "Maraton",
  ultra: "Ultra",
};

export function getRunningCategory(distance: number): RunningCategory {
  if (distance < 10) return "under10km";
  if (distance <= 10) return "10k";
  if (distance <= 20) return "10-20km";
  if (distance <= 22) return "halvmaraton";
  if (distance <= 44) return "halvmaraton-pluss";
  if (distance <= 46) return "maraton";
  return "ultra";
}
