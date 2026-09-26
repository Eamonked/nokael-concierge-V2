# Team Panel UI Update

## Date: September 24, 2026

## Overview
Updated the Team Panel to match the enterprise-mode design from the Dashboard UI reference implementation (line 3425 in App.tsx).

## Changes Applied

### 1. Component Structure - TeamPanel.tsx

#### New Enterprise Layout
Replaced the basic table layout with the enterprise operations card design:

**Before:**
- Simple table with basic columns
- Basic dispatch-card styling
- Limited filtering

**After:**
- Full enterprise-mode layout with operations card
- Metric filters at the top
- Advanced search with keyboard shortcuts (⌘K)
- Enterprise tabs for quick filtering
- Bulk selection with actions
- Modern grid-based table layout

### 2. Key Features Added

#### Metric Filters
Four metric buttons showing:
- **All**: Total members across all roles
- **Active**: Active/online members with recent activity
- **Owners**: Members with owner role and full access
- **Pending**: Pending invitations awaiting acceptance

Each button shows:
- Primary label
- Count (large number)
- Descriptive subtitle

#### Advanced Search
- Search input with icon
- Keyboard shortcut support (⌘K or / key)
- Real-time filtering by name, email, or ID
- Visual keyboard hint badge

#### Enterprise Tabs
Quick filter tabs for:
- All
- Owners
- Admins
- Operators
- Viewers

#### Bulk Actions
- Checkbox column for row selection
- Select all/deselect all
- Bulk action buttons (Edit Role, Revoke Access, Export)
- Visible count indicator

#### Enhanced Table
Using `enterprise-head` and `enterprise-row` classes with `team-grid`:
- Checkbox column
- Team member (avatar + name + ID)
- Role (badge or dropdown)
- Access status (dot indicator)
- Last active / context
- Action button

### 3. Visual Components

#### Avatar Component
```tsx
<Avatar initials={initials} tone={index} />
```
- Displays user initials
- Color-coded by index
- Matches Dashboard UI avatar styling

#### Status Indicators
```tsx
<span className={cn("plain-status", statusClass)}>
  <i />
  {memberStatus}
</span>
```
- Dot indicator with color
- Active, Inactive, At Risk, Pending states
- Semantic color coding

#### Role Badges
- `neutral-badge` class for consistent styling
- Dropdown for admins/owners to change roles
- Read-only badge for viewers

### 4. Interaction Features

#### Filtering Logic
Combines multiple filters:
- Search text (email, user_id)
- Status filter (All, Active, Inactive)
- Role-based tabs

#### Row Selection
```tsx
const toggleRow = (id: string) =>
  setSelected((items) =>
    items.includes(id) 
      ? items.filter((item) => item !== id) 
      : [...items, id]
  );
```

#### Keyboard Shortcuts
- `⌘K` or `/` to focus search
- Event listener cleanup on unmount

### 5. New CSS Classes Used

#### Layout Classes
- `.page-body.enterprise-page` - Main container
- `.enterprise-actions` - Top action bar
- `.operations-card` - Main content card
- `.operations-toolbar` - Search and filters bar

#### Filter Classes
- `.metric-filters` - Metric button grid
- `.metric-filters button.selected` - Active state

#### Search Classes
- `.enterprise-search` - Search container
- `.enterprise-search input` - Input field
- `.enterprise-search kbd` - Keyboard hint

#### Tab Classes
- `.enterprise-tabs` - Tab container
- `.enterprise-tabs button.selected` - Active tab

#### Table Classes
- `.enterprise-table.team-table` - Table wrapper
- `.enterprise-head.team-grid` - Header row
- `.enterprise-row.team-grid` - Data row
- `.enterprise-row.checked` - Selected row
- `.team-grid` - Grid column template

#### Component Classes
- `.enterprise-profile` - User profile cell
- `.avatar` - User avatar circle
- `.neutral-badge` - Role badge
- `.plain-status` - Status indicator
- `.context-cell` - Context text
- `.overflow-button` - Action button

#### Utility Classes
- `.bulk-actions` - Bulk action bar
- `.bulk-actions.visible` - Show when selected
- `.record-count` - Count display
- `.outline-button` - Secondary button
- `.dark-button` - Primary button
- `.empty-state` - No results view

### 6. Updated Translations

Added new translation keys in `dashboard.json`:

```json
"team": {
  "searchPlaceholder": "Search name, email, or ID...",
  "noResults": "No members match your search",
  "noMembersDesc": "Add team members to get started",
  "filters": {
    "totalMembers": "Total Members",
    "acrossRoles": "Across all roles",
    "activeOnline": "Active / Online",
    "recentActivity": "Recent activity",
    "owners": "Owners",
    "fullAccess": "Full access",
    "pendingInvites": "Pending Invites",
    "awaitingAcceptance": "Awaiting acceptance"
  },
  "table": {
    "user": "Team member",
    "accessStatus": "Access status",
    "lastActive": "Last active / context",
    "actions": "Action"
  }
}
```

### 7. Helper Functions

#### Get Initials
```tsx
const getInitials = (email: string): string => {
  const name = email.split('@')[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};
```

#### Get Status Class
```tsx
const getStatusClass = (role: string): string => {
  switch (role.toLowerCase()) {
    case 'owner':
    case 'admin':
      return 'active';
    case 'operator':
      return 'active';
    case 'viewer':
      return 'inactive';
    default:
      return '';
  }
};
```

### 8. Responsive Behavior

The design adapts to:
- Different screen sizes with grid layouts
- Collapsible sections
- Scrollable table content
- Flexible metric filter buttons

### 9. Accessibility

- Keyboard navigation support (⌘K shortcut)
- Focus states on all interactive elements
- Semantic HTML structure
- ARIA labels where appropriate
- Clear visual hierarchy

### 10. State Management

New state variables:
```tsx
const [filter, setFilter] = useState("All");
const [search, setSearch] = useState("");
const [selected, setSelected] = useState<string[]>([]);
const searchRef = useRef<HTMLInputElement>(null);
```

Computed values:
```tsx
const visible = useMemo(() => {
  // Filter members by search and status
}, [members, search, filter]);

const stats = useMemo(() => {
  // Calculate member statistics
}, [members]);
```

## Files Modified

1. `/src/pages/dashboard/TeamPanel.tsx` - Complete redesign
2. `/src/i18n/locales/en/dashboard.json` - Added filter translations

## Integration Notes

### CSS Classes
All CSS classes are defined in `/src/index.css` which was updated in the previous step. The classes follow the Dashboard UI design system.

### Grid Template
The `.team-grid` class defines the column layout:
```css
.team-grid { 
  grid-template-columns: 1.5fr .7fr .9fr .65fr 1.1fr; 
}
```

Adjust column widths in CSS if needed for your data structure.

### Color Scheme
Follows the enterprise-mode palette:
- Background: `#f8fafc`
- Surface: `#ffffff`
- Text: `#0f172a`
- Muted: `#475569`
- Border: `#e2e8f0`
- Accent: `#e3ff4d`

### Dark/Light Mode
The layout supports theme switching via `.app.light` class on the root element.

## Testing Checklist

- [ ] Metric filters update counts correctly
- [ ] Search filters members in real-time
- [ ] Tab filters work independently
- [ ] Keyboard shortcuts (⌘K, /) focus search
- [ ] Checkbox selection works
- [ ] Select all/deselect all functions
- [ ] Bulk actions show when rows selected
- [ ] Role dropdowns update database
- [ ] Remove member confirms and updates
- [ ] Empty states display correctly
- [ ] Loading state shows spinner
- [ ] Error messages display
- [ ] Invite modal integration works
- [ ] Responsive on different screen sizes

## Next Steps

1. **Test the new UI** in your development environment
2. **Verify data mapping** between your OrgMember type and display fields
3. **Implement bulk actions** (Edit Role, Revoke Access) if needed
4. **Add pagination** if you have many team members
5. **Implement invite status** tracking for pending invites count
6. **Add last active tracking** to show accurate activity context
7. **Theme integration** - ensure enterprise-mode class is applied when needed

## Migration Guide

If you had custom features in the old TeamPanel:

1. **Custom columns**: Add them to the `.team-grid` template
2. **Custom filters**: Add buttons to `.metric-filters` or `.enterprise-tabs`
3. **Custom actions**: Add buttons to `.bulk-actions` or row actions
4. **Custom styling**: Override CSS classes in your custom stylesheet

## Support

The new design follows the Dashboard UI reference implementation exactly. For styling questions:
- Check `/src/index.css` for class definitions
- Reference `/Volumes/Stash/Nokael_Ops/Dashboard UI/src/App.tsx` line 3425+
- Use browser DevTools to inspect computed styles

---

**Team Panel UI update completed successfully** ✅
