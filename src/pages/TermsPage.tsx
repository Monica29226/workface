import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText } from "lucide-react";
import { Link } from "react-router-dom";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button asChild variant="ghost" className="pl-0">
          <Link to="/auth">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al acceso
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <CardTitle>Terminos y Condiciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              ACL Web · Planillas es una plataforma para la gestion de planillas y procesos de recursos humanos.
              El acceso al sistema esta destinado unicamente a usuarios autorizados por su empresa o por ACL.
            </p>
            <p>
              Cada usuario es responsable de resguardar sus credenciales, utilizar la plataforma conforme a las
              politicas internas de su organizacion y reportar cualquier acceso no reconocido.
            </p>
            <p>
              La informacion procesada en el sistema puede incluir datos laborales, salariales y administrativos.
              Su uso debe limitarse a fines operativos y de cumplimiento relacionados con la gestion de personal.
            </p>
            <p>
              Si necesitas una version contractual o mas detallada de estos terminos, ACL puede publicarla o
              entregarla a nivel corporativo sin afectar el acceso actual al sistema.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
