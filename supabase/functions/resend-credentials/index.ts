import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendCredentialsRequest {
  user_id: string;
  email: string;
  full_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !callerUser) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if caller has admin role
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    const isAdmin = callerRoles?.some(r => 
      ["admin", "ACL_SuperAdmin", "ACL_PayrollSpecialist"].includes(r.role)
    );

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "No tiene permisos para realizar esta acción" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id, email, full_name }: ResendCredentialsRequest = await req.json();

    if (!user_id || !email) {
      return new Response(
        JSON.stringify({ error: "user_id y email son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Resending credentials to user: ${email}`);

    // Generate a new temporary password
    const tempPassword = `Temp${Math.random().toString(36).slice(-8)}${Math.floor(Math.random() * 100)}!`;

    // Update user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: tempPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: `Error al actualizar contraseña: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get platform URL
    const platformUrl = Deno.env.get("PLATFORM_URL") || "https://planicas-ac.lovable.app";

    // Send email with new credentials
    const emailResponse = await resend.emails.send({
      from: `PlanicasHR <${fromEmail}>`,
      to: [email],
      subject: "Nuevas credenciales de acceso - PlanicasHR",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .card { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 28px; font-weight: bold; color: #0f172a; }
            h1 { color: #0f172a; margin-bottom: 20px; }
            .credentials { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0; }
            .credential-item { margin: 12px 0; }
            .label { color: #64748b; font-size: 14px; }
            .value { color: #0f172a; font-size: 16px; font-weight: 600; word-break: break-all; }
            .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 13px; }
            .warning { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">
                <div class="logo">PlanicasHR</div>
              </div>
              
              <h1>¡Nuevas credenciales de acceso!</h1>
              
              <p>Hola ${full_name || email},</p>
              
              <p>Se han generado nuevas credenciales de acceso para tu cuenta en el sistema de nóminas PlanicasHR.</p>
              
              <div class="credentials">
                <div class="credential-item">
                  <div class="label">Correo electrónico</div>
                  <div class="value">${email}</div>
                </div>
                <div class="credential-item">
                  <div class="label">Nueva contraseña temporal</div>
                  <div class="value">${tempPassword}</div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${platformUrl}" class="button">Iniciar Sesión</a>
              </div>
              
              <div class="warning">
                <strong>⚠️ Importante:</strong> Por seguridad, te recomendamos cambiar tu contraseña después de iniciar sesión.
              </div>
              
              <div class="footer">
                <p>Este correo fue enviado automáticamente por el sistema PlanicasHR.</p>
                <p>Si no solicitaste este acceso, por favor contacta al administrador.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // Log the action
    await supabaseAdmin.from("audit_log").insert({
      log_id: `resend-${Date.now()}`,
      actor_email: callerUser.email || "system",
      action: "resend_credentials",
      target_email: email,
      details: `Credenciales reenviadas al usuario ${email}`,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Credenciales reenviadas exitosamente" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in resend-credentials:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
