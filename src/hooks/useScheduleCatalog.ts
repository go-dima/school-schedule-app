import { useContext } from "react";
import {
  ScheduleCatalogContext,
  type ScheduleCatalogContextValue,
} from "../contexts/ScheduleCatalogContextObject";

export function useScheduleCatalog(): ScheduleCatalogContextValue {
  const context = useContext(ScheduleCatalogContext);
  if (!context) {
    throw new Error(
      "useScheduleCatalog must be used within a ScheduleCatalogProvider"
    );
  }
  return context;
}
