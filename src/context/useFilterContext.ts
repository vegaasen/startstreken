import { useContext } from "react";
import { FilterContext, type FilterContextValue } from "./filterContextTypes";

export function useFilterContext(): FilterContextValue {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilterContext must be used within a FilterProvider");
  return ctx;
}
