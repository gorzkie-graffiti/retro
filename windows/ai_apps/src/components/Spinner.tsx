export function Spinner({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={small ? "spinner spinner--small" : "spinner"}
    />
  );
}

export function ProgressBar({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      className="progress-bar"
      role="progressbar"
    >
      <span className="progress-bar-fill" />
    </div>
  );
}
