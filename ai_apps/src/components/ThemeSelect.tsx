import { useId } from "react";
import { isAppTheme, THEMES } from "../lib/theme";
import type { AppTheme } from "../types";

interface ThemeSelectProps {
  value: AppTheme;
  onChange: (theme: AppTheme) => void;
  className?: string;
  compact?: boolean;
}

/**
 * The one shared theme control used by every skin. It sits in each theme's
 * existing toolbar rather than in a separate settings screen.
 */
export function ThemeSelect({
  value,
  onChange,
  className = "",
  compact = false,
}: ThemeSelectProps) {
  const id = useId();

  return (
    <label
      className={`theme-select${compact ? " theme-select--compact" : ""}${
        className ? ` ${className}` : ""
      }`}
      htmlFor={id}
    >
      <span className="theme-select-label">Theme</span>
      <select
        aria-label="Choose application theme"
        id={id}
        onChange={(event) => {
          if (isAppTheme(event.target.value)) {
            onChange(event.target.value);
          }
        }}
        value={value}
      >
        {THEMES.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.label}
          </option>
        ))}
      </select>
    </label>
  );
}
