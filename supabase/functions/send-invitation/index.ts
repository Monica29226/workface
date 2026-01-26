import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "npm:resend@2.0.0";

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
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get inviter profile
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const { email, role, company_id, company_name }: InvitationRequest = await req.json();

    if (!email || !role) {
      return new Response(JSON.stringify({ error: "Email and role are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already exists
    const { data: existingProfile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: "El usuario ya existe en el sistema. Use la función de editar permisos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
      return new Response(JSON.stringify({ error: "Ya existe una invitación pendiente para este correo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Error al crear la invitación" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the invitation link - always use the production portal URL
    const appOrigin = "https://workforcehub.calderon.cr";

    const inviteLink = `${appOrigin}/auth?invite=${invitation.token}`;
    const systemName = "ACL Workforce HUB";
    const supportEmail = "soporte@aureoncr.com";

    // Send the invitation email
    const inviterName = inviterProfile?.full_name || inviterProfile?.email || "El administrador del sistema";

    // Using info@calderon.cr - domain calderon.cr must be verified in Resend
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "info@calderon.cr";
    const from = `ACL Workforce HUB <${fromEmail}>`;

    console.log("Using FROM:", from);

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    // List-Unsubscribe headers improve email reputation with Gmail, Outlook, etc.
    const unsubscribeEmail = "unsubscribe@aureoncr.com";

    const emailResponse = await resend.emails.send({
      from,
      to: [email],
      subject: `Bienvenido al ${systemName}${company_name ? ` - ${company_name}` : ""}`,
      headers: {
        "List-Unsubscribe": `<mailto:${unsubscribeEmail}?subject=Unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f6f9;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; margin: 0 auto; padding: 40px 20px;">
            <tr>
              <td>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                  <!-- Header with Logo -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #0F2A44, #1e3a8a); padding: 32px; text-align: center;">
                      <img src="https://aureoncr.com/wp-content/uploads/2024/01/logo-aureon-blanco.png" alt="Aureon" style="max-width: 180px; height: auto; margin-bottom: 16px;" />
                      <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 600;">
                        ${systemName}
                      </h1>
                      <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0 0; font-size: 13px;">
                        Sistema de Gestión de Nómina y Recursos Humanos
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 32px;">
                        <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px;">
                          ¡Ha sido invitado al Sistema de Planillas!
                        </h2>
                      
                      <p style="color: #475569; line-height: 1.7; margin: 0 0 24px 0; font-size: 15px;">
                        <strong>${inviterName}</strong> lo ha invitado a unirse al <strong>${systemName}</strong>${company_name ? ` para gestionar la nómina de <strong>${company_name}</strong>` : ""}.
                      </p>
                      
                      <p style="color: #475569; line-height: 1.7; margin: 0 0 24px 0; font-size: 15px;">
                        <strong>ACL Workforce HUB</strong> es una plataforma integral para la gestión de recursos humanos y nómina que le permite:
                      </p>
                      
                      <ul style="color: #475569; line-height: 1.8; margin: 0 0 24px 0; padding-left: 20px; font-size: 14px;">
                        <li>📋 Consultar sus recibos de pago digitales</li>
                        <li>📅 Gestionar solicitudes de vacaciones</li>
                        <li>📊 Acceder a reportes e historial de pagos</li>
                        <li>👤 Actualizar su información personal</li>
                      </ul>
                      
                      <!-- Details Box -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 0 0 24px 0;">
                        <tr>
                          <td style="padding: 20px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                              <tr>
                                <td style="padding: 0 0 12px 0;">
                                  <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Portal de Acceso</p>
                                  <a href="${appOrigin}/auth" style="color: #1e40af; font-size: 14px; text-decoration: underline; word-break: break-all;">${appOrigin}</a>
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 12px 0; border-top: 1px solid #e2e8f0;">
                                  <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Rol Asignado</p>
                                  <p style="margin: 0; color: #0f172a; font-weight: 600; font-size: 15px;">${role}</p>
                                </td>
                              </tr>
                              ${
                                company_name
                                  ? `
                              <tr>
                                <td style="padding: 12px 0 0 0; border-top: 1px solid #e2e8f0;">
                                  <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Empresa</p>
                                  <p style="margin: 0; color: #0f172a; font-weight: 600; font-size: 15px;">${company_name}</p>
                                </td>
                              </tr>
                              `
                                  : ""
                              }
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #475569; line-height: 1.7; margin: 0 0 24px 0; font-size: 15px;">
                        Haga clic en el siguiente botón para crear su cuenta y acceder al sistema:
                      </p>
                      
                      <!-- CTA Button -->
                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                        <tr>
                          <td style="background: linear-gradient(135deg, #0f172a, #1e3a8a); border-radius: 10px;">
                            <a href="${inviteLink}" style="display: inline-block; padding: 16px 40px; color: white; text-decoration: none; font-weight: 600; font-size: 16px;">
                              Acceder al Sistema de Planillas
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Expiry Notice -->
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0 0 0;">
                        <tr>
                          <td style="text-align: center;">
                            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0;">
                              Este enlace de invitación expirará en <strong>7 días</strong>.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0;">
                      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; line-height: 1.6; text-align: center;">
                        ¿Tiene preguntas o necesita ayuda? Contáctenos:
                      </p>
                      <p style="margin: 0 0 16px 0; text-align: center;">
                        <a href="mailto:${supportEmail}" style="color: #1e40af; font-size: 14px; text-decoration: underline;">${supportEmail}</a>
                      </p>
                        <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                          © ${new Date().getFullYear()} ACL Workforce HUB. Todos los derechos reservados.
                        </p>
                      <p style="margin: 8px 0 0 0; color: #cbd5e1; font-size: 11px; text-align: center;">
                        Si no esperaba esta invitación o cree que la recibió por error, puede ignorar este correo de forma segura.
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(JSON.stringify({ error: error.message || "Error interno del servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
