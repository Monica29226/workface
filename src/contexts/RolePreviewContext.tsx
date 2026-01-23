import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AppRole } from '@/hooks/useUserRole';

interface RolePreviewContextType {
  previewRole: AppRole | null;
  setPreviewRole: (role: AppRole | null) => void;
  isPreviewMode: boolean;
}

const RolePreviewContext = createContext<RolePreviewContextType | undefined>(undefined);

export function RolePreviewProvider({ children }: { children: ReactNode }) {
  const [previewRole, setPreviewRole] = useState<AppRole | null>(null);

  return (
    <RolePreviewContext.Provider 
      value={{ 
        previewRole, 
        setPreviewRole,
        isPreviewMode: previewRole !== null
      }}
    >
      {children}
    </RolePreviewContext.Provider>
  );
}

export function useRolePreview() {
  const context = useContext(RolePreviewContext);
  if (context === undefined) {
    throw new Error('useRolePreview must be used within a RolePreviewProvider');
  }
  return context;
}
