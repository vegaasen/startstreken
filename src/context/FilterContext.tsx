import { useState, type ReactNode } from "react";
import { FilterContext, type FilterDiscipline } from "./filterContextTypes";

export function FilterProvider({ children }: { children: ReactNode }) {
  const [discipline, setDiscipline] = useState<FilterDiscipline>("alle");
  return (
    <FilterContext.Provider value={{ discipline, setDiscipline }}>
      {children}
    </FilterContext.Provider>
  );
}
