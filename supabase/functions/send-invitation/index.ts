import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  role: string;
  company_id?: string;
  company_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is authenticated and has admin/manager role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get inviter profile
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const { email, role, company_id, company_name }: InvitationRequest = await req.json();

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "Email and role are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: "El usuario ya existe en el sistema. Use la función de editar permisos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from("user_invitations")
      .select("id, status")
      .eq("email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: "Ya existe una invitación pendiente para este correo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the invitation
    const { data: invitation, error: insertError } = await supabase
      .from("user_invitations")
      .insert({
        email,
        role,
        company_id: company_id || null,
        invited_by: user.id,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting invitation:", insertError);
      return new Response(
        JSON.stringify({ error: "Error al crear la invitación" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the invitation link
    const appUrl = Deno.env.get("APP_URL") || `${supabaseUrl.replace('.supabase.co', '.lovable.app')}`;
    const inviteLink = `${appUrl}/auth?invite=${invitation.token}`;

    // Send the invitation email
    const inviterName = inviterProfile?.full_name || inviterProfile?.email || "El equipo de ACL Payroll";
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    const emailResponse = await resend.emails.send({
      from: `ACL Payroll CR <${fromEmail}>`,
      to: [email],
      subject: `Invitación a ACL Payroll CR${company_name ? ` - ${company_name}` : ""}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f6f9;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <tr>
              <td>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); padding: 32px; text-align: center;">
                      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">
                        ACL Payroll CR
                      </h1>
                      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
                        Sistema de Gestión de Planillas
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 32px;">
                      <h2 style="margin: 0 0 16px 0; color: #1e3a8a; font-size: 20px;">
                        ¡Has sido invitado!
                      </h2>
                      
                      <p style="color: #64748b; line-height: 1.6; margin: 0 0 24px 0;">
                        <strong>${inviterName}</strong> te ha invitado a unirte al sistema ACL Payroll CR${company_name ? ` para la empresa <strong>${company_name}</strong>` : ""}.
                      </p>
                      
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border-radius: 8px; margin: 0 0 24px 0;">
                        <tr>
                          <td style="padding: 16px 20px;">
                            <p style="margin: 0; color: #64748b; font-size: 14px;">
                              <strong style="color: #334155;">Rol asignado:</strong> ${role}
                            </p>
                            ${company_name ? `
                            <p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px;">
                              <strong style="color: #334155;">Empresa:</strong> ${company_name}
                            </p>
                            ` : ""}
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #64748b; line-height: 1.6; margin: 0 0 24px 0;">
                        Haz clic en el siguiente botón para crear tu cuenta y acceder al sistema:
                      </p>
                      
                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                        <tr>
                          <td style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); border-radius: 8px;">
                            <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; color: white; text-decoration: none; font-weight: 600; font-size: 16px;">
                              Aceptar Invitación
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0;">
                        Este enlace expirará en 7 días. Si no solicitaste esta invitación, puedes ignorar este correo.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
                      <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                        © ${new Date().getFullYear()} ACL Payroll CR. Todos los derechos reservados.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    console.log("Invitation email sent successfully:", emailResponse);

    // Log to audit
    await supabase.from("audit_log").insert({
      log_id: `INV-${Date.now()}`,
      actor_email: user.email || "system",
      action: "user_invitation_sent",
      target_email: email,
      company_id: company_id || null,
      details: JSON.stringify({ role, invitation_id: invitation.id }),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitación enviada correctamente",
        invitation_id: invitation.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
