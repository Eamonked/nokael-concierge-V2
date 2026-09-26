import React from 'react';

export function StatCards({
  items,
}: {
  items: { label: string; value: string; note?: string; hero?: boolean }[]
}) {
  return (
    <div className="stats">
      {items.map((item) => (
        <div
          key={item.label}
          className={`stat-card ${item.hero ? "hero" : ""}`}
        >
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note && <small>{item.note}</small>}
        </div>
      ))}
    </div>
  )
}
