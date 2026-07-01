import type { ProviderOption } from "@/providers/catalog";
import { cn } from "./lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./primitives/tooltip";
import { useProviderCatalog } from "./provider-catalog";

/**
 * Curated set of external model providers we surface as a "powered by" cluster in
 * the header. `match` lists the provider option ids that map to each brand (e.g.
 * Google ships both Gemini images and Veo video). Local-only options (manual inbox,
 * draft captions) are intentionally excluded — they are workflow modes, not brands.
 */
const BRAND_PROVIDERS: { label: string; match: string[] }[] = [
  { label: "Claude", match: ["claude"] },
  { label: "Google", match: ["gemini", "veo"] },
  { label: "fal", match: ["fal"] },
  { label: "WaveSpeed", match: ["wavespeed"] },
];

interface BrandState {
  label: string;
  available: boolean;
  models: string[];
}

function deriveBrands(options: ProviderOption[]): BrandState[] {
  return BRAND_PROVIDERS.map(({ label, match }) => {
    const matched = options.filter((option) =>
      match.some((id) => option.id === id || option.id.startsWith(`${id}-`)),
    );
    return {
      label,
      available: matched.some((option) => option.available),
      models: [...new Set(matched.map((option) => option.model))],
    };
  });
}

export function ProviderBadges() {
  const catalog = useProviderCatalog();
  if (!catalog) return null;

  const brands = deriveBrands(catalog.options);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-2">
        <div className="grid grid-rows-1 grid-flow-col gap-2">
          {brands.map((brand) => (
            <Tooltip key={brand.label}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "flex items-center justify-center rounded border px-3 font-mono text-[10px] leading-none transition-colors h-6",
                    brand.available
                      ? "border-border bg-surface text-secondary"
                      : "border-transparent text-faint opacity-50 grayscale",
                  )}
                >
                  {brand.available ? `🟢 ${brand.label}` : `🔴 ${brand.label}`}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <span className="font-medium text-primary">{brand.label}</span>
                <span className="mt-0.5 block">
                  {brand.available ? "Connected" : "API key not configured"}
                </span>
                {brand.models.length > 0 ? (
                  <span className="mt-1 block font-mono text-faint">
                    {brand.models.join(" · ")}
                  </span>
                ) : null}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
