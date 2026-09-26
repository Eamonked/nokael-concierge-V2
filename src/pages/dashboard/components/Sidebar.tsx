import React from 'react';
import type { Page } from '../types';
import { Icon } from './Icon';

export function Sidebar({
  page,
  setPage,
  collapsed,
  setCollapsed,
  onLogout,
}: {
  page: Page
  setPage: (p: Page) => void
  collapsed: boolean
  setCollapsed: (v: boolean) => void
  onLogout: () => void
}) {
  const nav: { id: Page; label: string; badge?: string }[] = [
    { id: "jobs", label: "Jobs" },
    { id: "map", label: "Live Map" },
    { id: "quoteRequests", label: "Quote Requests", badge: "4" },
    { id: "agents", label: "Agents", badge: "1" },
    { id: "business", label: "Business" },
    { id: "team", label: "Team" },
    { id: "alerts", label: "Alerts", badge: "4" },
    { id: "settings", label: "Settings" },
  ]
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="brand">
        <span className="brand-mark">
          <span />
        </span>
        {!collapsed && <b>NOKAEL</b>}
      </div>
      <nav>
        {nav.map((item) => (
          <button
            key={item.id}
            title={collapsed ? item.label : undefined}
            className={page === item.id ? "active" : ""}
            onClick={() => setPage(item.id)}
          >
            <span className="nav-icon">
              <Icon name={item.id} />
            </span>
            {!collapsed && (
              <>
                <span>{item.label}</span>
                {item.badge && <em>{item.badge}</em>}
              </>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        {!collapsed && (
          <div className="support">
            <span>Ops status</span>
            <b>
              <i />
              All systems operational
            </b>
          </div>
        )}
        <button
          className="collapse-button"
          onClick={() => setCollapsed(!collapsed)}
        >
          <Icon name="chevron" />
        </button>
        {!collapsed && (
          <button className="logout" onClick={onLogout}>
            ↪ <span>Log out</span>
          </button>
        )}
      </div>
    </aside>
  )
}
