import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCompany } from "@/contexts/CompanyContext";
import { EmailLogPanel } from "./EmailLogPanel";
import { FileText } from "lucide-react";

export function EmailBitacoraPage() {
  const { selectedCompany } = useCompany();

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-muted-foreground">Seleccione una empresa para ver la bitácora de correos</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Bitácora de Correos
        </h1>
        <p className="text-muted-foreground">
          Registro completo de todos los envíos: colillas, invitaciones, credenciales y notificaciones — {selectedCompany.name}
        </p>
      </div>

      <EmailLogPanel companyId={selectedCompany.id} companyName={selectedCompany.name} />
    </div>
  );
}

export default EmailBitacoraPage;
