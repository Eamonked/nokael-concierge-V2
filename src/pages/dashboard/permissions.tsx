import React from 'react';
import type { OrgRole } from '../../lib/team';

// ==========================================
// Dashboard permissions
// ==========================================
// The database is the real enforcement (RLS: viewers can SELECT but not
// INSERT/UPDATE/DELETE — see supabase-viewer-readonly.sql). This context only
// keeps the UI honest, so a viewer never sees a button that would fail.

export const canWriteRole = (role: OrgRole | null | undefined) =>
  role === 'owner' || role === 'admin' || role === 'operator';

const PermissionsContext = React.createContext<{ role: OrgRole | null; canWrite: boolean }>({
  role: null,
  canWrite: false,
});

export const PermissionsProvider = ({ role, children }: { role: OrgRole | null; children: React.ReactNode }) => (
  <PermissionsContext.Provider value={{ role, canWrite: canWriteRole(role) }}>
    {children}
  </PermissionsContext.Provider>
);

export const usePermissions = () => React.useContext(PermissionsContext);
export const useCanWrite = () => React.useContext(PermissionsContext).canWrite;

export const READ_ONLY_MESSAGE = 'You have view-only access. Ask an admin if you need to make changes.';

/**
 * Disables every input, select, textarea and button inside it for viewers
 * (native <fieldset disabled> behaviour) without changing layout.
 */
export const WriteGuard = ({ children }: { children: React.ReactNode }) => {
  const canWrite = useCanWrite();
  return (
    <fieldset disabled={!canWrite} style={{ display: 'contents', border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      {children}
    </fieldset>
  );
};
