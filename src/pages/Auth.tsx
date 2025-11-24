import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Reset password state
  const [resetEmail, setResetEmail] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) throw error;

      if (data.user) {
        toast({
          title: "¡Bienvenido!",
          description: "Has iniciado sesión correctamente.",
        });
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
      toast({
        title: "Error",
        description: err.message || "No se pudo iniciar sesión",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;

      toast({
        title: "¡Correo enviado!",
        description: "Revisa tu correo electrónico para restablecer tu contraseña.",
      });
      setShowResetPassword(false);
      setResetEmail("");
    } catch (err: any) {
      setError(err.message || "Error al enviar correo de recuperación");
      toast({
        title: "Error",
        description: err.message || "No se pudo enviar el correo de recuperación",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Dark Blue with Logo */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy items-center justify-center p-12">
        <div className="text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center mb-6">
              <div className="text-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-6xl font-bold tracking-wider">ACL</div>
                </div>
                <div className="text-2xl font-light tracking-widest text-white/90">HALDERON</div>
              </div>
            </div>
          </div>
          <p className="text-white/70 text-sm">Sistema de Planillas Costa Rica</p>
        </div>
      </div>

      {/* Right Side - White with Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Acceso</h1>
            <p className="text-muted-foreground">¿Ya tienes una cuenta?</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {showResetPassword ? (
            // Reset Password Form
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-foreground">Correo Electrónico</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="tu@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-navy hover:bg-navy/90 text-white font-medium"
                disabled={loading}
              >
                {loading ? "Enviando..." : "Enviar Correo de Recuperación"}
              </Button>

              <Button
                type="button"
                variant="link"
                className="w-full text-navy"
                onClick={() => {
                  setShowResetPassword(false);
                  setError(null);
                  setResetEmail("");
                }}
                disabled={loading}
              >
                Volver al inicio de sesión
              </Button>
            </form>
          ) : (
            // Login Form
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-foreground">Correo</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="tu@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-foreground">Contraseña</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className="h-11"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="link"
                  className="text-navy hover:text-navy/80 p-0 h-auto font-normal"
                  onClick={() => {
                    setShowResetPassword(true);
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Olvidé mi contraseña
                </Button>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-navy hover:bg-navy/90 text-white font-medium"
                disabled={loading}
              >
                {loading ? "Iniciando sesión..." : "Iniciar sesión"}
              </Button>
            </form>
          )}

          {/* Footer Links */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex justify-center gap-6 text-sm">
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                Términos y Condiciones
              </button>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                Políticas de Privacidad
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
