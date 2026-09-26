import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';

export type DatePreset = "Today" | "Yesterday" | "Last 7 Days" | "Last 30 Days" | "This Month" | "Custom Range"

export function toDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function presetRange(preset: Exclude<DatePreset, "Custom Range">) {
  const end = new Date()
  const start = new Date()
  if (preset === "Yesterday") {
    start.setDate(start.getDate() - 1)
    end.setDate(end.getDate() - 1)
  } else if (preset === "Last 7 Days") {
    start.setDate(start.getDate() - 6)
  } else if (preset === "Last 30 Days") {
    start.setDate(start.getDate() - 29)
  } else if (preset === "This Month") {
    start.setDate(1)
  }
  return { from: toDateInput(start), to: toDateInput(end) }
}

export function useDateRange() {
  const params = new URLSearchParams(window.location.search)
  const initialFrom = params.get("from")
  const initialTo = params.get("to")
  const initialPreset = params.get("range") as DatePreset | null
  const defaultRange = presetRange("Today")
  const [preset, setPreset] = useState<DatePreset>(
    initialPreset ||
      (initialFrom && initialTo ? "Custom Range" : "Today" as DatePreset),
  )
  const [from, setFrom] = useState(initialFrom || defaultRange.from)
  const [to, setTo] = useState(initialTo || defaultRange.to)

  const applyPreset = (nextPreset: DatePreset) => {
    setPreset(nextPreset)
    if (nextPreset !== "Custom Range") {
      const next = presetRange(nextPreset)
      setFrom(next.from)
      setTo(next.to)
    }
  }

  useEffect(() => {
    const nextParams = new URLSearchParams(window.location.search)
    nextParams.set("from", from)
    nextParams.set("to", to)
    nextParams.set("range", preset)
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${nextParams.toString()}`,
    )
  }, [from, to, preset])

  const includes = (...values: string[]) => {
    const start = new Date(`${from}T00:00:00`).getTime()
    const end = new Date(`${to}T23:59:59.999`).getTime()
    return values.some((value) => {
      const timestamp = new Date(value).getTime()
      return timestamp >= start && timestamp <= end
    })
  }

  return { preset, from, to, setFrom, setTo, applyPreset, includes }
}

export function DateRangeSelector({
  range,
}: {
  range: ReturnType<typeof useDateRange>
}) {
  return (
    <div className="date-range-control">
      <Icon name="calendar" size={14} />
      <select
        aria-label="Date range"
        value={range.preset}
        onChange={(event) =>
          range.applyPreset(event.target.value as DatePreset)
        }
      >
        {[
          "Today",
          "Yesterday",
          "Last 7 Days",
          "Last 30 Days",
          "This Month",
          "Custom Range",
        ].map((preset) => (
          <option key={preset}>{preset}</option>
        ))}
      </select>
      {range.preset === "Custom Range" && (
        <div className="custom-date-range">
          <label>
            <span>From</span>
            <input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(event) => range.setFrom(event.target.value)}
            />
          </label>
          <span>→</span>
          <label>
            <span>To</span>
            <input
              type="date"
              value={range.to}
              min={range.from}
              onChange={(event) => range.setTo(event.target.value)}
            />
          </label>
        </div>
      )}
    </div>
  )
}
