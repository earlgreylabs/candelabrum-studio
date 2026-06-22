import { useEffect, useState } from "react";
import type { ProviderCapability } from "@/core/provider-selection";
import type { ProviderOption } from "@/providers/catalog";

export interface ProviderCatalog {
  options: ProviderOption[];
  defaults: Record<ProviderCapability, string>;
}

export function useProviderCatalog(): ProviderCatalog | null {
  const [catalog, setCatalog] = useState<ProviderCatalog | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/providers", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Provider catalog failed (${response.status})`);
        return response.json() as Promise<ProviderCatalog>;
      })
      .then(setCatalog)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error(error);
      });
    return () => controller.abort();
  }, []);

  return catalog;
}
