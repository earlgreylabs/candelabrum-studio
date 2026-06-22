import type { ProviderCapability } from "@/core/provider-selection";
import type { ProviderOption } from "@/providers/catalog";

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
    <label className="block space-y-1 text-sm">
      <span className="text-secondary">{label}</span>
      <select
        value={value}
        disabled={disabled || matching.length === 0}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-border bg-background px-3 py-2 text-primary outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50"
      >
        {matching.map((option) => (
          <option
            key={`${option.capability}:${option.id}`}
            value={option.id}
            disabled={!option.available}
          >
            {option.label} ({option.model})
            {option.available ? "" : ` - ${option.unavailableReason}`}
          </option>
        ))}
      </select>
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
    </label>
  );
}
