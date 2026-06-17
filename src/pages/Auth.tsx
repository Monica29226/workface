import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logoACL from "@/assets/logotipo_acl.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  
  // Invitation flow state
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<any>(null);
  const [isLoadingInvite, setIsLoadingInvite] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Signup state (for invitation)
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupFullName, setSignupFullName] = useState("");
  
  // Reset password state
  const [resetEmail, setResetEmail] = useState("");

  const getAuthErrorMessage = (message?: string) => {
    if (!message) return "No se pudo completar la solicitud.";

    const normalized = message.toLowerCase();

    if (normalized.includes("invalid login credentials")) {
      return "Correo o contrasena incorrectos.";
    }

    if (normalized.includes("email not confirmed")) {
      return "Debes confirmar tu correo antes de iniciar sesion.";
    }

    if (normalized.includes("too many requests")) {
      return "Se detectaron demasiados intentos. Intenta de nuevo en unos minutos.";
    }

    if (normalized.includes("user already registered")) {
      return "Este correo ya tiene una cuenta registrada.";
    }

    if (normalized.includes("signup is disabled")) {
      return "El registro no esta disponible en este momento.";
    }

    return message;
  };

  // Check for invitation token in URL
  useEffect(() => {
    const token = searchParams.get('invite');
    if (token) {
      setInviteToken(token);
      loadInvitationData(token);
    }
  }, [searchParams]);

  const loadInvitationData = async (token: string) => {
    setIsLoadingInvite(true);
    try {
      const { data, error } = await supabase
        .from('user_invitations')
        .select(`
          id,
          email,
          role,
          status,
          expires_at,
          company:companies(display_name)
        `)
        .eq('token', token)
        .single();

      if (error || !data) {
        setError("Invitación no válida o expirada");
        setInviteToken(null);
        return;
      }

      if (data.status !== 'pending') {
        setError("Esta invitación ya ha sido utilizada");
        setInviteToken(null);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError("Esta invitación ha expirado");
        setInviteToken(null);
        return;
      }

      setInviteData(data);
      setShowSignup(true);
    } catch (err) {
      console.error("Error loading invitation:", err);
      setError("Error al cargar la invitación");
    } finally {
      setIsLoadingInvite(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError("Ingresa tu correo y contrasena.");
      return;
    }

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
      const message = getAuthErrorMessage(err.message || "Error al iniciar sesion");
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken) return;

    if (signupPassword !== signupConfirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (signupPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-invitation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: inviteToken,
            password: signupPassword,
            fullName: signupFullName || undefined,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Error al crear la cuenta');
      }

      toast({
        title: "¡Cuenta creada!",
        description: "Ya puede iniciar sesión con su correo y contraseña.",
      });

      // Clear invitation state and show login
      setInviteToken(null);
      setInviteData(null);
      setShowSignup(false);
      setLoginEmail(inviteData?.email || '');
      setSignupPassword("");
      setSignupConfirmPassword("");
    } catch (err: any) {
      const message = getAuthErrorMessage(err.message || "Error al crear la cuenta");
      setError(message);
      toast({
        title: "Error",
        description: message,
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
      const message = getAuthErrorMessage(err.message || "Error al enviar correo de recuperacion");
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Loading invitation state
  if (isLoadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando invitación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Dark Blue with Logo */}
      <div className="hidden lg:flex lg:w-1/2 bg-navy items-center justify-center p-12">
        <div className="text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center mb-6">
              <img 
                src={logoACL} 
                alt="ACL Calderon" 
                className="w-[500px] h-auto max-w-full"
              />
            </div>
          </div>
          <p className="text-white/70 text-sm">Sistema de Planillas Costa Rica</p>
        </div>
      </div>

      {/* Right Side - White with Login/Signup Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Signup form for invited users */}
          {showSignup && inviteData ? (
            <>
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-6 w-6 text-emerald-500" />
                  <span className="text-sm text-emerald-600 font-medium">Invitación válida</span>
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Crear Cuenta</h1>
                <p className="text-muted-foreground">
                  Completa tu registro para acceder a{' '}
                  <strong>{inviteData.company?.display_name || 'ACL Payroll'}</strong>
                </p>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSignup} className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-foreground">Correo Electrónico</Label>
                  <Input
                    type="email"
                    value={inviteData.email}
                    disabled
                    autoComplete="email"
                    className="h-11 bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-foreground">Nombre Completo</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Tu nombre completo"
                    value={signupFullName}
                    onChange={(e) => setSignupFullName(e.target.value)}
                    disabled={loading}
                    autoComplete="name"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-foreground">Contraseña</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                    autoComplete="new-password"
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm" className="text-foreground">Confirmar Contraseña</Label>
                  <Input
                    id="signup-confirm"
                    type="password"
                    placeholder="Repite tu contraseña"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                    autoComplete="new-password"
                    className="h-11"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-navy hover:bg-navy/90 text-white font-medium"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creando cuenta...
                    </>
                  ) : (
                    "Crear Cuenta y Acceder"
                  )}
                </Button>
              </form>
            </>
          ) : showResetPassword ? (
            // Reset Password Form
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">Recuperar Contraseña</h1>
                <p className="text-muted-foreground">Te enviaremos un correo para restablecer tu contraseña</p>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

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
                    autoComplete="email"
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
            </>
          ) : (
            // Login Form
            <>
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
                    autoComplete="email"
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
                    autoComplete="current-password"
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
            </>
          )}

          {/* Footer Links */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex justify-center gap-6 text-sm">
              <Link
                to="/terminos"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Términos y Condiciones
              </Link>
              <Link
                to="/privacidad"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Políticas de Privacidad
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
