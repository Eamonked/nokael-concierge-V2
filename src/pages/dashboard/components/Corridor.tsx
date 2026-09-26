import React from 'react';

export function Corridor({
  from,
  to,
  compact = false,
}: {
  from: string
  to: string
  compact?: boolean
}) {
  return (
    <div className={`corridor ${compact ? "compact" : ""}`}>
      <div>
        <small>Pickup</small>
        <b>{from}</b>
      </div>
      <span>→</span>
      <div>
        <small>Delivery</small>
        <b>{to}</b>
      </div>
    </div>
  )
}
