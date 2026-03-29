import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";

const Index = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();

  useEffect(() => {
    if (selectedCompany) {
      navigate('/dashboard');
    } else {
      navigate('/company-selector');
    }
  }, [selectedCompany, navigate]);

  return null;
};

export default Index;