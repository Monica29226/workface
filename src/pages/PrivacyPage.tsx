import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export default function PrivacyPage() {
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
              <Shield className="h-5 w-5" />
            </div>
            <CardTitle>Politica de Privacidad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              ACL Workforce HUB trata datos personales y laborales para habilitar funciones de acceso, nomina,
              reportes, colillas y administracion de usuarios.
            </p>
            <p>
              La informacion se utiliza unicamente para operar el sistema, atender requerimientos de soporte,
              cumplir obligaciones legales y ejecutar procesos autorizados por la empresa propietaria de los datos.
            </p>
            <p>
              El acceso a la informacion se limita a usuarios con permisos asignados. Las credenciales, enlaces de
              invitacion y procesos de recuperacion de contrasena deben manejarse de forma confidencial.
            </p>
            <p>
              Si tu empresa necesita una version completa de la politica de privacidad o un acuerdo formal de
              tratamiento de datos, ACL puede ponerlo a disposicion por los canales corporativos correspondientes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
