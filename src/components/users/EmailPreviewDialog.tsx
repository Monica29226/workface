import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Eye, Send, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmailPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSend: () => void;
  isSending: boolean;
  emailType: 'invitation' | 'credentials';
  recipientEmail: string;
  recipientName?: string;
  role?: string;
  companyName?: string;
  portalUrl?: string;
}

export function EmailPreviewDialog({
  isOpen,
  onClose,
  onConfirmSend,
  isSending,
  emailType,
  recipientEmail,
  recipientName,
  role,
  companyName,
  portalUrl = window.location.origin,
}: EmailPreviewDialogProps) {
  const systemName = "Sistema de Planillas Aureon";
  const supportEmail = "soporte@aureoncr.com";
  const loginLink = `${portalUrl}/auth`;
  const currentYear = new Date().getFullYear();

  const getSubject = () => {
    if (emailType === 'invitation') {
      return `Bienvenido al ${systemName}${companyName ? ` - ${companyName}` : ""}`;
    }
    return `Bienvenido al ${systemName}`;
  };

  const renderInvitationPreview = () => (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", margin: 0, padding: 0, backgroundColor: "#f4f6f9" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
        <div style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #0f172a, #1e3a8a)", padding: 32, textAlign: "center" as const }}>
            <h1 style={{ color: "white", margin: 0, fontSize: 24, fontWeight: 600 }}>
              {systemName}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.85)", margin: "8px 0 0 0", fontSize: 14 }}>
              Gestión de Nómina y Recursos Humanos
            </p>
          </div>
          
          {/* Content */}
          <div style={{ padding: "40px 32px" }}>
            <h2 style={{ margin: "0 0 16px 0", color: "#0f172a", fontSize: 20 }}>
              ¡Ha sido invitado al Sistema de Planillas!
            </h2>
            
            <p style={{ color: "#475569", lineHeight: 1.7, margin: "0 0 24px 0", fontSize: 15 }}>
              <strong>El administrador del sistema</strong> lo ha invitado a unirse al <strong>{systemName}</strong>
              {companyName && <> para gestionar la nómina de <strong>{companyName}</strong></>}.
            </p>
            
            <p style={{ color: "#475569", lineHeight: 1.7, margin: "0 0 24px 0", fontSize: 15 }}>
              Este sistema le permitirá gestionar información de nómina, generar reportes, administrar empleados y mucho más.
            </p>
            
            {/* Details Box */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, marginBottom: 24 }}>
              <div style={{ paddingBottom: 12 }}>
                <p style={{ margin: "0 0 4px 0", color: "#64748b", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Portal de Acceso</p>
                <a href={loginLink} style={{ color: "#1e40af", fontSize: 14, textDecoration: "underline", wordBreak: "break-all" as const }}>{portalUrl}</a>
              </div>
              <div style={{ padding: "12px 0", borderTop: "1px solid #e2e8f0" }}>
                <p style={{ margin: "0 0 4px 0", color: "#64748b", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Rol Asignado</p>
                <p style={{ margin: 0, color: "#0f172a", fontWeight: 600, fontSize: 15 }}>{role || "Por asignar"}</p>
              </div>
              {companyName && (
                <div style={{ paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
                  <p style={{ margin: "0 0 4px 0", color: "#64748b", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Empresa</p>
                  <p style={{ margin: 0, color: "#0f172a", fontWeight: 600, fontSize: 15 }}>{companyName}</p>
                </div>
              )}
            </div>
            
            <p style={{ color: "#475569", lineHeight: 1.7, margin: "0 0 24px 0", fontSize: 15 }}>
              Haga clic en el siguiente botón para crear su cuenta y acceder al sistema:
            </p>
            
            {/* CTA Button */}
            <div style={{ textAlign: "center" as const }}>
              <span style={{ display: "inline-block", background: "linear-gradient(135deg, #0f172a, #1e3a8a)", borderRadius: 10, padding: "16px 40px", color: "white", fontWeight: 600, fontSize: 16 }}>
                Acceder al Sistema de Planillas
              </span>
            </div>
            
            {/* Expiry Notice */}
            <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.5, margin: "24px 0 0 0", textAlign: "center" as const }}>
              Este enlace de invitación expirará en <strong>7 días</strong>.
            </p>
          </div>
          
          {/* Footer */}
          <div style={{ background: "#f8fafc", padding: "24px 32px", borderTop: "1px solid #e2e8f0", textAlign: "center" as const }}>
            <p style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
              ¿Tiene preguntas o necesita ayuda? Contáctenos:
            </p>
            <p style={{ margin: "0 0 16px 0" }}>
              <a href={`mailto:${supportEmail}`} style={{ color: "#1e40af", fontSize: 14, textDecoration: "underline" }}>{supportEmail}</a>
            </p>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>
              © {currentYear} Aureon. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCredentialsPreview = () => (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", margin: 0, padding: 0, backgroundColor: "#f4f6f9" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px" }}>
        <div style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #0f172a, #1e3a8a)", padding: 32, textAlign: "center" as const }}>
            <h1 style={{ color: "white", margin: 0, fontSize: 24, fontWeight: 600 }}>
              {systemName}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.85)", margin: "8px 0 0 0", fontSize: 14 }}>
              Gestión de Nómina y Recursos Humanos
            </p>
          </div>
          
          {/* Content */}
          <div style={{ padding: "40px 32px" }}>
            <h2 style={{ margin: "0 0 16px 0", color: "#0f172a", fontSize: 20 }}>
              ¡Bienvenido, {recipientName || "Usuario"}!
            </h2>
            
            <p style={{ color: "#475569", lineHeight: 1.7, margin: "0 0 24px 0", fontSize: 15 }}>
              Su empresa lo ha registrado en el <strong>{systemName}</strong> para gestionar su información de nómina, recibos de pago y más.
            </p>
            
            <p style={{ color: "#475569", lineHeight: 1.7, margin: "0 0 24px 0", fontSize: 15 }}>
              A continuación encontrará sus credenciales de acceso:
            </p>
            
            {/* Credentials Box */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, marginBottom: 24 }}>
              <div style={{ paddingBottom: 12 }}>
                <p style={{ margin: "0 0 4px 0", color: "#64748b", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Portal de Acceso</p>
                <a href={loginLink} style={{ color: "#1e40af", fontSize: 14, textDecoration: "underline", wordBreak: "break-all" as const }}>{loginLink}</a>
              </div>
              <div style={{ padding: "12px 0", borderTop: "1px solid #e2e8f0" }}>
                <p style={{ margin: "0 0 4px 0", color: "#64748b", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Usuario (Correo electrónico)</p>
                <p style={{ margin: 0, color: "#0f172a", fontWeight: 600, fontSize: 15, wordBreak: "break-all" as const }}>{recipientEmail}</p>
              </div>
              <div style={{ paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
                <p style={{ margin: "0 0 4px 0", color: "#64748b", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Contraseña Temporal</p>
                <p style={{ margin: 0, color: "#0f172a", fontWeight: 600, fontSize: 15, fontFamily: "monospace", background: "#fff", padding: "8px 12px", borderRadius: 6, border: "1px dashed #cbd5e1" }}>••••••••••</p>
              </div>
            </div>
            
            {/* Security Notice */}
            <div style={{ background: "#fef3c7", borderLeft: "4px solid #f59e0b", borderRadius: "0 8px 8px 0", padding: "14px 16px", marginBottom: 24 }}>
              <p style={{ margin: 0, color: "#92400e", fontSize: 14, lineHeight: 1.5 }}>
                <strong>⚠️ Importante:</strong> Por seguridad, deberá cambiar su contraseña temporal después de iniciar sesión por primera vez.
              </p>
            </div>
            
            {/* CTA Button */}
            <div style={{ textAlign: "center" as const }}>
              <span style={{ display: "inline-block", background: "linear-gradient(135deg, #0f172a, #1e3a8a)", borderRadius: 10, padding: "16px 40px", color: "white", fontWeight: 600, fontSize: 16 }}>
                Acceder al Sistema de Planillas
              </span>
            </div>
          </div>
          
          {/* Footer */}
          <div style={{ background: "#f8fafc", padding: "24px 32px", borderTop: "1px solid #e2e8f0", textAlign: "center" as const }}>
            <p style={{ margin: "0 0 8px 0", color: "#64748b", fontSize: 13, lineHeight: 1.6 }}>
              ¿Tiene preguntas o necesita ayuda? Contáctenos:
            </p>
            <p style={{ margin: "0 0 16px 0" }}>
              <a href={`mailto:${supportEmail}`} style={{ color: "#1e40af", fontSize: 14, textDecoration: "underline" }}>{supportEmail}</a>
            </p>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>
              © {currentYear} Aureon. Todos los derechos reservados.
            </p>
            <p style={{ margin: "8px 0 0 0", color: "#cbd5e1", fontSize: 11 }}>
              Este correo fue enviado porque su empresa lo registró en nuestro sistema. Si cree que recibió este mensaje por error, por favor contáctenos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Vista Previa del Correo
          </DialogTitle>
          <DialogDescription>
            Revise cómo se verá el correo antes de enviarlo
          </DialogDescription>
        </DialogHeader>

        {/* Email metadata */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex">
            <span className="font-medium w-20">Para:</span>
            <span className="text-muted-foreground">{recipientEmail}</span>
          </div>
          <div className="flex">
            <span className="font-medium w-20">Asunto:</span>
            <span className="text-muted-foreground">{getSubject()}</span>
          </div>
        </div>

        {/* Email preview */}
        <ScrollArea className="flex-1 border rounded-lg bg-white">
          <div className="p-2">
            {emailType === 'invitation' ? renderInvitationPreview() : renderCredentialsPreview()}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Cancelar
          </Button>
          <Button onClick={onConfirmSend} disabled={isSending} className="gap-2">
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Confirmar y Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
