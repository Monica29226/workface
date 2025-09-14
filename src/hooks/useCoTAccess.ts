import { useCompany } from "@/contexts/CompanyContext";
import { isCoT, requiresCoT } from "@/lib/utils";

export function useCoTAccess() {
  const { selectedCompany } = useCompany();
  
  const isCoTCompany = isCoT(selectedCompany);
  const hasCoTAccess = requiresCoT(selectedCompany);
  
  return {
    isCoTCompany,
    hasCoTAccess,
    selectedCompany,
    // Security guards
    canEdit: isCoTCompany,
    canCreate: isCoTCompany,
    canDelete: isCoTCompany,
    shouldHideFeature: !isCoTCompany,
    shouldShowReadOnly: !isCoTCompany
  };
}