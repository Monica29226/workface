import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";

const Index = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();

  useEffect(() => {
    // Redirect to dashboard if company is selected, otherwise to company selector
    if (selectedCompany) {
      navigate('/dashboard');
    } else {
      navigate('/');
    }
  }, [selectedCompany, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
    </div>
  );
};

export default Index;