import React from 'react';

export function Avatar({ initials, tone = 0 }: { initials: string; tone?: number; key?: React.Key }) {
  const colors = ["#34421c", "#25384a", "#463229", "#3c2e48"]
  return (
    <span
      className="avatar"
      style={{ background: colors[tone % colors.length] }}
    >
      {initials}
    </span>
  )
}
