import React from 'react';
import { Icon } from './Icon';

export function Search({
  value,
  onChange,
  placeholder = "Search",
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="search">
      <Icon name="search" size={16} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}
