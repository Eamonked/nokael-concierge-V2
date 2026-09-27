import React from 'react';

export type StatusKind = "danger" | "warning" | "info" | "neutral" | "success"

/** Tone is guessed from the text unless `kind` is given. */
export function Status({ children, kind: explicit }: { children: React.ReactNode; kind?: StatusKind }) {
  const value = String(children).toLowerCase()
  const kind = explicit ?? (
    value.includes("return") ||
    value.includes("critical") ||
    value.includes("lost") ||
    value.includes("overdue") ||
    value.includes("expired")
      ? "danger"
      : value.includes("pending") ||
          value.includes("warning") ||
          value.includes("review") ||
          value.includes("renewal") ||
          value.includes("delay") ||
          value.includes("expiring")
        ? "warning"
        : value.includes("transit") ||
            value.includes("job") ||
            value.includes("info") ||
            value.includes("contact")
          ? "info"
          : value.includes("cancel") || value.includes("offline")
            ? "neutral"
            : "success")
  return (
    <span className={`status ${kind}`}>
      <i />
      {children}
    </span>
  )
}

export function Toggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="toggle">
      {options.map((option) => (
        <button
          key={option}
          className={value === option ? "active" : ""}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
