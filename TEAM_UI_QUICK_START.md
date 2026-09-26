# Team UI Quick Start Guide

## What Changed?

Your Team Panel now looks like a professional enterprise management interface instead of a basic table.

## Before & After

### Before
```
┌────────────────────────────────────┐
│ Team access                         │
│ ─────────────────────────────────  │
│ User          Role      Since       │
│ ─────────────────────────────────  │
│ user@email    Admin    Jan 2026    │
│ user2@email   Operator Mar 2026    │
└────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────────────────────┐
│ 12 members · 4 role groups      [Export] [+ Add]    │
├─────────────────────────────────────────────────────┤
│ [All: 12] [Active: 9] [Owners: 2] [Pending: 2]     │
├─────────────────────────────────────────────────────┤
│ 🔍 Search... ⌘K   [All][Owners][Admins][Operators]  │
├─────────────────────────────────────────────────────┤
│ ☐ TEAM MEMBER    ROLE      STATUS    LAST ACTIVE   │
│ ☐ 👤 user@email   [Admin▼]  ● Active  2m ago       │
│ ☐ 👤 user2@email  [Operator▼] ● Active  5m ago     │
└─────────────────────────────────────────────────────┘
```

## Key Features

### 1. Metric Filters (Top Buttons)
Click to quickly filter by status:
- **All** - Shows everyone
- **Active** - Shows active members
- **Owners** - Shows owners only
- **Pending** - Shows pending invites

### 2. Search
- Type to search by name, email, or ID
- Press `⌘K` or `/` to focus search instantly
- Clear the search to see all again

### 3. Quick Tabs
- All, Owners, Admins, Operators, Viewers
- One-click filtering by role

### 4. Bulk Selection
- Check boxes to select multiple members
- Bulk actions appear when rows are selected
- Select all checkbox in header

### 5. Role Management
- Click role badge to change (if you have permission)
- Dropdown appears for quick role updates
- Changes save immediately

### 6. Status Indicators
- Green dot = Active
- Red dot = Inactive
- Orange dot = At Risk
- Visual at-a-glance status

## For Developers

### If You Need to Customize

#### Add a Custom Column
1. Find `.team-grid` in `/src/index.css`
2. Update grid-template-columns (currently 5 columns)
3. Add your data in the TeamPanel.tsx render

```tsx
// In the enterprise-head
<span>Your Column</span>

// In the enterprise-row
<span>{member.yourData}</span>
```

#### Change the Metric Filters
In TeamPanel.tsx, find the metric filters array:
```tsx
{[
  ["All", "Total Members", stats.total.toString(), "Across all roles"],
  ["Active", "Active / Online", stats.active.toString(), "Recent activity"],
  // Add your own metric
  ["Custom", "Custom Label", "10", "Your description"],
].map((metric) => (
  // ... render logic
))}
```

#### Add Custom Bulk Actions
Find the bulk-actions div:
```tsx
<div className={`bulk-actions ${selected.length ? "visible" : ""}`}>
  <b>{selected.length} selected</b>
  {canManage && (
    <>
      <button>Edit Role</button>
      <button>Revoke Access</button>
      {/* Add your action here */}
      <button onClick={() => yourFunction(selected)}>
        Your Action
      </button>
    </>
  )}
</div>
```

#### Customize Colors
All colors come from CSS variables in `:root`:
```css
--canvas: #f8fafc;
--surface: #ffffff;
--text: #0f172a;
--muted: #475569;
--line: #e2e8f0;
```

Change them in `/src/index.css` or override in your component.

### Common Issues

#### Table columns don't align
- Check that your data rows have the same number of columns as the header
- Ensure you're using the `.team-grid` class on both head and rows

#### Search doesn't work
- Verify the search state is connected to the input
- Check the filter logic includes your searchable fields

#### Bulk actions not showing
- They only show when `selected.length > 0`
- Make sure checkbox onChange calls `toggleRow(id)`

#### Styles look wrong
- Ensure `/src/index.css` was updated with the new Dashboard UI styles
- Check that the root element has the `.app` class
- For enterprise mode, add `.app.enterprise-mode`

### Pro Tips

1. **Keyboard Navigation**: Users can press `/` or `⌘K` to search - no mouse needed
2. **Visual Feedback**: Hover states show which row will be selected
3. **Empty States**: Nice messages when no data or no search results
4. **Loading States**: Spinner shows while fetching data
5. **Responsive**: Works on different screen sizes (min-width: 1120px)

## Testing Your Changes

Quick test checklist:
```bash
# Start your dev server
npm run dev

# Open the dashboard
# Navigate to Team section
# Try these actions:
✓ Click each metric filter
✓ Type in the search box
✓ Press ⌘K to focus search
✓ Click a tab filter
✓ Check a row checkbox
✓ Select all checkboxes
✓ Change a role (if admin)
✓ Click more actions
✓ Add a new member
```

## Need Help?

1. Check `/src/index.css` - all styles are defined there
2. Check `TEAM_UI_UPDATE.md` - detailed technical docs
3. Check `DASHBOARD_UI_UPDATE.md` - CSS class reference
4. Look at `/Volumes/Stash/Nokael_Ops/Dashboard UI/src/App.tsx` line 3425 - original reference

---

**Your Team UI is now enterprise-grade** 🎉
