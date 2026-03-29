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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, role, company_id, company_name }: InvitationRequest = await req.json();

    if (!email || !role) {
      return new Response(JSON.stringify({ error: "Email and role are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: Validate requester has access to the target company
    if (company_id) {
      const { data: requesterRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      const isGlobalAdmin = requesterRole?.role === "admin" || requesterRole?.role === "ACL_SuperAdmin";

      if (!isGlobalAdmin) {
        const { data: companyAccess } = await supabase
          .from("company_users")
          .select("id")
          .eq("user_id", user.id)
          .eq("company_id", company_id)
          .maybeSingle();

        if (!companyAccess) {
          await supabase.from("audit_log").insert({
            log_id: `SEC-${Date.now()}`,
            actor_email: user.email || "unknown",
            action: "invitation_blocked_cross_company",
            target_email: email,
            company_id,
            details: `Blocked: user ${user.email} tried to invite to company they don't belong to`,
          });
          return new Response(JSON.stringify({ error: "No tiene acceso a esta empresa" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Get inviter profile
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

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

    // Build the invitation link
    const appOrigin = "https://workforcehub.calderon.cr";
    const inviteLink = `${appOrigin}/auth?invite=${invitation.token}`;
    const systemName = "ACL Workforce HUB";
    const supportEmail = "soporte@aureoncr.com";
    const inviterName = inviterProfile?.full_name || inviterProfile?.email || "El administrador";

    const rawFromEmail = (Deno.env.get("RESEND_FROM_EMAIL") || "noreply@calderon.cr").trim();
    const cleanedFromEmail = rawFromEmail.replace(/^"+|"+$/g, "").trim();
    const emailMatchInv = cleanedFromEmail.match(/<([^>]+)>/);
    const pureFromEmail = emailMatchInv ? emailMatchInv[1] : cleanedFromEmail;
    const from = `ACL Payroll CR <${pureFromEmail}>`;

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    const emailResponse = await resend.emails.send({
      from,
      to: [email],
      subject: `Bienvenido al ${systemName}${company_name ? ` - ${company_name}` : ""}`,
      headers: {
        "List-Unsubscribe": `<mailto:unsubscribe@aureoncr.com?subject=Unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f6f9;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; margin: 0 auto; padding: 40px 20px;">
            <tr><td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background: linear-gradient(135deg, #0F2A44, #1e3a8a); padding: 32px; text-align: center;">
                    <img src="https://aureoncr.com/wp-content/uploads/2024/01/logo-aureon-blanco.png" alt="Aureon" style="max-width: 180px; height: auto; margin-bottom: 16px;" />
                    <h1 style="color: white; margin: 0; font-size: 22px;">${systemName}</h1>
                    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0 0; font-size: 13px;">Sistema de Gestión de Nómina y Recursos Humanos</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 32px;">
                    <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px;">¡Ha sido invitado al Sistema!</h2>
                    <p style="color: #475569; line-height: 1.7; margin: 0 0 24px 0; font-size: 15px;">
                      <strong>${inviterName}</strong> lo ha invitado a unirse al <strong>${systemName}</strong>${company_name ? ` para <strong>${company_name}</strong>` : ""}.
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 0 0 24px 0;">
                      <tr><td style="padding: 20px;">
                        <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Rol Asignado</p>
                        <p style="margin: 0; color: #0f172a; font-weight: 600; font-size: 15px;">${role}</p>
                        ${company_name ? `
                        <p style="margin: 12px 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase; border-top: 1px solid #e2e8f0; padding-top: 12px;">Empresa</p>
                        <p style="margin: 0; color: #0f172a; font-weight: 600; font-size: 15px;">${company_name}</p>
                        ` : ""}
                      </td></tr>
                    </table>
                    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                      <tr>
                        <td style="background: linear-gradient(135deg, #0f172a, #1e3a8a); border-radius: 10px;">
                          <a href="${inviteLink}" style="display: inline-block; padding: 16px 40px; color: white; text-decoration: none; font-weight: 600; font-size: 16px;">
                            Aceptar Invitación
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 24px 0 0 0;">
                      Este enlace expirará en <strong>7 días</strong>.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; text-align: center;">
                      ¿Necesita ayuda? <a href="mailto:${supportEmail}" style="color: #1e40af;">${supportEmail}</a>
                    </p>
                    <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                      © ${new Date().getFullYear()} ACL Workforce HUB
                    </p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });

    const emailFailed = !emailResponse || (emailResponse as any).error;

    // Log to email_logs
    if (company_id) {
      await supabase.from("email_logs").insert({
        company_id,
        recipient_email: email,
        recipient_name: email,
        subject: `Invitación al ${systemName}`,
        status: emailFailed ? "failed" : "sent",
        error_message: emailFailed ? JSON.stringify((emailResponse as any)?.error) : null,
        sent_at: emailFailed ? null : new Date().toISOString(),
      });
    }

    // Log to audit
    await supabase.from("audit_log").insert({
      log_id: `INV-${Date.now()}`,
      actor_email: user.email || "system",
      action: "user_invitation_sent",
      target_email: email,
      company_id: company_id || null,
      details: JSON.stringify({ role, invitation_id: invitation.id, email_sent: !emailFailed }),
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
