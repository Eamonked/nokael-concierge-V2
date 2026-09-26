import React, { useState } from 'react';
import type { Page } from '../types';
import { Icon } from './Icon';
import { Avatar } from './Avatar';
import { Toggle } from './StatusBadge';

const subtitles: Record<Page, string> = {
  jobs: "Manage every delivery from request to handoff.",
  map: "Track active agents and jobs in real time.",
  quoteRequests: "Review and manage incoming rate and delivery requests.",
  agents: "Manage your agent pool, applications and sessions.",
  business: "Oversee accounts, contracts and decision makers.",
  team: "Manage access and roles across your operations team.",
  alerts: "Review exceptions that need your attention.",
  settings:
    "Configure company defaults, document templates, and system integrations.",
}

export function Header({
  page,
  language,
  setLanguage,
  theme,
  setTheme,
  user,
}: {
  page: Page
  language: "EN" | "AR"
  setLanguage: (v: "EN" | "AR") => void
  theme: "Dark" | "Light"
  setTheme: (v: "Dark" | "Light") => void
  user: { initials: string; name: string; role: string }
}) {
  const [profileOpen, setProfileOpen] = useState(false)
  const title =
    page === "settings"
      ? "Workspace Settings"
      : page === "quoteRequests"
        ? "Quote Requests"
        : page === "agents"
          ? "Agent Fleet"
          : page === "team"
            ? "Team Members"
            : page === "business"
              ? "Business accounts"
              : page === "map"
                ? "Live map"
                : page[0].toUpperCase() + page.slice(1)
  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        <p>{subtitles[page]}</p>
      </div>
      <div className="top-actions">
        <button className="notification">
          <Icon name="alerts" size={17} />
          <i />
        </button>
        <div className="profile-control">
          <button
            className="profile-trigger"
            onClick={() => setProfileOpen((open) => !open)}
            aria-expanded={profileOpen}
          >
            <Avatar initials={user.initials} />
            <span>
              <b>{user.name}</b>
              <small>{user.role}</small>
            </span>
            <Icon name="chevron" size={12} />
          </button>
          {profileOpen && (
            <div className="profile-menu">
              <div className="profile-menu-title">
                <b>Workspace settings</b>
                <small>Personal preferences</small>
              </div>
              <div className="profile-setting">
                <span>Language</span>
                <Toggle
                  options={["EN", "AR"] as const}
                  value={language}
                  onChange={setLanguage}
                />
              </div>
              <div className="profile-setting">
                <span>Appearance</span>
                <Toggle
                  options={["Dark", "Light"] as const}
                  value={theme}
                  onChange={setTheme}
                />
              </div>
              <button className="profile-menu-link">
                Account settings <Icon name="chevron" size={11} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
