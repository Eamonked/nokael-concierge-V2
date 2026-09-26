import React from 'react';

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    jobs: (
      <>
        <rect x="3" y="4" width="14" height="13" rx="2" />
        <path d="M7 4V2m6 2V2M3 8h14" />
      </>
    ),
    map: (
      <>
        <path d="m3 5 5-2 4 2 5-2v14l-5 2-4-2-5 2V5Z" />
        <path d="M8 3v14m4-12v14" />
      </>
    ),
    quoteRequests: (
      <>
        <path d="M5 3h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M7 7h6M7 11h4" />
      </>
    ),
    agents: (
      <>
        <circle cx="8" cy="7" r="3" />
        <path d="M2.5 17c.4-3 2.2-5 5.5-5s5.1 2 5.5 5M14 6h4m-2-2v4" />
      </>
    ),
    business: (
      <>
        <path d="M3 18V6h14v12M7 6V3h6v3M2 18h16" />
        <path d="M7 10h2m2 0h2m-6 4h2m2 0h2" />
      </>
    ),
    team: (
      <>
        <circle cx="7" cy="7" r="3" />
        <circle cx="15" cy="8" r="2" />
        <path d="M1.5 18c.3-3.5 2-6 5.5-6s5.2 2.5 5.5 6M13 13c3.4-.6 5 1.3 5.5 4" />
      </>
    ),
    alerts: (
      <>
        <path d="M10 2a6 6 0 0 0-6 6v4l-2 3h16l-2-3V8a6 6 0 0 0-6-6Z" />
        <path d="M8 18h4" />
      </>
    ),
    settings: (
      <>
        <circle cx="10" cy="10" r="3" />
        <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4m7.8 7.8 1.4 1.4m0-10.6-1.4 1.4m-7.8 7.8-1.4 1.4" />
        <circle cx="10" cy="10" r="7.5" />
      </>
    ),
    search: (
      <>
        <circle cx="9" cy="9" r="6" />
        <path d="m14 14 4 4" />
      </>
    ),
    plus: <path d="M10 3v14M3 10h14" />,
    chevron: <path d="m8 5 5 5-5 5" />,
    more: (
      <>
        <circle cx="4" cy="10" r=".7" fill="currentColor" />
        <circle cx="10" cy="10" r=".7" fill="currentColor" />
        <circle cx="16" cy="10" r=".7" fill="currentColor" />
      </>
    ),
    close: <path d="m5 5 10 10M15 5 5 15" />,
    phone: (
      <path d="M4 2h4l2 5-2.2 1.4a12 12 0 0 0 4 4L13 10l5 2v4a2 2 0 0 1-2 2C8.3 18 2 11.7 2 4a2 2 0 0 1 2-2Z" />
    ),
    external: (
      <>
        <path d="M11 3h6v6M17 3l-8 8" />
        <path d="M15 12v5H3V5h5" />
      </>
    ),
    check: <path d="m4 10 4 4 8-9" />,
    download: (
      <>
        <path d="M10 2v11m-4-4 4 4 4-4" />
        <path d="M3 17h14" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="14" height="13" rx="2" />
        <path d="M7 2v4m6-4v4M3 8h14M7 11h2m2 0h2m-6 3h2" />
      </>
    ),
    expand: <path d="M12 3h5v5M8 17H3v-5M17 3l-5.5 5.5M3 17l5.5-5.5" />,
    copy: (
      <>
        <rect x="7" y="7" width="10" height="10" rx="2" />
        <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      </>
    ),
    chat: <path d="M10 3a7 7 0 0 0-6 10.6L3 17l3.5-1A7 7 0 1 0 10 3Z" />,
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  )
}
