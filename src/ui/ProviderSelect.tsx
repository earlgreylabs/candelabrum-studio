import type { ProviderCapability } from "@/core/provider-selection";
import type { ProviderOption } from "@/providers/catalog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./primitives/select";

interface ProviderSelectProps {
  capability: ProviderCapability;
  label: string;
  options: ProviderOption[];
  value: string;
  disabled?: boolean;
  onChange: (provider: string) => void;
}

export function ProviderSelect({
  capability,
  label,
  options,
  value,
  disabled,
  onChange,
}: ProviderSelectProps) {
  const matching = options.filter((option) => option.capability === capability);
  const selected = matching.find((option) => option.id === value);

  return (
    <div className="block space-y-1 text-sm">
      <span className="text-secondary">{label}</span>
      <Select value={value} disabled={disabled || matching.length === 0} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="Select a provider" />
        </SelectTrigger>
        <SelectContent>
          {matching.map((option) => (
            <SelectItem
              key={`${option.capability}:${option.id}`}
              value={option.id}
              disabled={!option.available}
            >
              <span className="flex items-baseline gap-2">
                <span>{option.label}</span>
                <span className="font-mono text-xs text-faint">{option.model}</span>
                {option.available ? null : (
                  <span className="text-xs text-status-danger">{option.unavailableReason}</span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected ? (
        <span
          className={`block text-xs ${selected.available ? "text-faint" : "text-status-danger"}`}
        >
          {selected.mode}
          {selected.estimatedCostUsd !== undefined
            ? `, estimated $${selected.estimatedCostUsd.toFixed(2)}`
            : ", provider-billed usage"}
          {selected.unavailableReason ? `, ${selected.unavailableReason}` : ""}
        </span>
      ) : null}
    </div>
  );
}
