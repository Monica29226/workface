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
  company_id?: string; // Optional: validate user belongs to this company
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    const rawFromEmail = (Deno.env.get("RESEND_FROM_EMAIL") || "noreply@calderon.cr").trim();
    const cleanedFrom = rawFromEmail.replace(/^"+|"+$/g, "").trim();
    const emailMatch = cleanedFrom.match(/<([^>]+)>/);
    const pureEmail = emailMatch ? emailMatch[1] : cleanedFrom;
    const from = `ACL Payroll CR <${pureEmail}>`;

    const systemName = "ACL Workforce HUB";
    const supportEmail = "soporte@aureoncr.com";
    const logoUrl = "https://aureoncr.com/wp-content/uploads/2024/01/logo-aureon-blanco.png";

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: callerUser },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller has admin role
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    const isAdmin = callerRoles?.some((r) =>
      ["admin", "ACL_SuperAdmin", "ACL_PayrollSpecialist"].includes(r.role)
    );

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "No tiene permisos para realizar esta acción" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { user_id, email, full_name, company_id }: ResendCredentialsRequest = await req.json();

    if (!user_id || !email) {
      return new Response(
        JSON.stringify({ error: "user_id y email son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate that the target user exists in profiles
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, email")
      .eq("id", user_id)
      .single();

    if (profileError || !targetProfile) {
      console.error("Target user not found:", profileError);
      return new Response(
        JSON.stringify({ error: "El usuario no existe en el sistema" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate email matches
    if (targetProfile.email !== email) {
      console.error("Email mismatch:", targetProfile.email, "vs", email);
      return new Response(
        JSON.stringify({ error: "El correo no coincide con el usuario registrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // If company_id provided, validate user belongs to that company
    if (company_id) {
      const { data: companyAccess } = await supabaseAdmin
        .from("company_users")
        .select("id")
        .eq("user_id", user_id)
        .eq("company_id", company_id)
        .maybeSingle();

      if (!companyAccess) {
        // Log the cross-company attempt
        await supabaseAdmin.from("audit_log").insert({
          log_id: `SEC-${Date.now()}`,
          actor_email: callerUser.email || "system",
          action: "resend_credentials_blocked",
          target_email: email,
          company_id,
          details: "Intento de reenvío de credenciales a usuario de otra empresa",
        });

        return new Response(
          JSON.stringify({ error: "El usuario no pertenece a la empresa seleccionada" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    console.log(`Resending credentials to user: ${email}`);

    // Generate a new temporary password
    const tempPassword = `Temp${Math.random().toString(36).slice(-8)}${Math.floor(Math.random() * 100)}!`;

    // Update user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: tempPassword,
    });

    if (updateError) {
      console.error("Error updating password:", updateError);

      // Log the failure
      await supabaseAdmin.from("email_logs").insert({
        company_id: company_id || "00000000-0000-0000-0000-000000000000",
        recipient_email: email,
        recipient_name: full_name || email,
        subject: `Nuevas credenciales de acceso - ${systemName}`,
        status: "failed",
        error_message: `Error al actualizar contraseña: ${updateError.message}`,
      });

      return new Response(
        JSON.stringify({ error: `Error al actualizar contraseña: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const appOrigin = "https://workforcehub.calderon.cr";
    const platformUrl = `${appOrigin}/auth`;
    const unsubscribeEmail = "unsubscribe@calderon.cr";

    // Create email log entry BEFORE sending
    const { data: logEntry } = await supabaseAdmin
      .from("email_logs")
      .insert({
        company_id: company_id || "00000000-0000-0000-0000-000000000000",
        recipient_email: email,
        recipient_name: full_name || email,
        subject: `Nuevas credenciales de acceso - ${systemName}`,
        status: "sending",
      })
      .select("id")
      .single();

    // Send email with new credentials
    try {
      const emailResponse = await resend.emails.send({
        from,
        to: [email],
        subject: `Nuevas credenciales de acceso - ${systemName}`,
        headers: {
          "List-Unsubscribe": `<mailto:${unsubscribeEmail}?subject=Unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f4f6f9; margin:0; padding:0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; margin:0 auto; padding: 40px 20px;">
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                      <tr>
                        <td style="background: linear-gradient(135deg, #0F2A44, #1e3a8a); padding: 32px; text-align: center;">
                          <img src="${logoUrl}" alt="Aureon" style="max-width: 180px; height: auto; margin-bottom: 16px;" />
                          <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 600;">${systemName}</h1>
                          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0 0; font-size: 13px;">Sistema de Gestión de Nómina y Recursos Humanos</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 40px 32px;">
                          <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px;">Nuevas Credenciales de Acceso</h2>
                          <p style="color: #475569; line-height: 1.7; margin: 0 0 24px 0; font-size: 15px;">
                            Hola <strong>${full_name || "Usuario"}</strong>,
                          </p>
                          <p style="color: #475569; line-height: 1.7; margin: 0 0 24px 0; font-size: 15px;">
                            Se han generado nuevas credenciales de acceso para su cuenta en el <strong>${systemName}</strong>.
                          </p>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 0 0 24px 0;">
                            <tr>
                              <td style="padding: 20px;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                  <tr>
                                    <td style="padding: 0 0 12px 0;">
                                      <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Portal de Acceso</p>
                                      <a href="${platformUrl}" style="color: #1e40af; font-size: 14px; text-decoration: underline; word-break: break-all;">${platformUrl}</a>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 12px 0; border-top: 1px solid #e2e8f0;">
                                      <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Usuario (Correo electrónico)</p>
                                      <p style="margin: 0; color: #0f172a; font-weight: 600; font-size: 15px; word-break: break-all;">${email}</p>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 12px 0 0 0; border-top: 1px solid #e2e8f0;">
                                      <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Nueva Contraseña Temporal</p>
                                      <p style="margin: 0; color: #0f172a; font-weight: 600; font-size: 15px; font-family: monospace; background: #fff; padding: 8px 12px; border-radius: 6px; border: 1px dashed #cbd5e1;">${tempPassword}</p>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; margin: 0 0 24px 0;">
                            <tr>
                              <td style="padding: 14px 16px;">
                                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                                  <strong>⚠️ Importante:</strong> Por seguridad, deberá cambiar su contraseña temporal después de iniciar sesión.
                                </p>
                              </td>
                            </tr>
                          </table>
                          <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                            <tr>
                              <td style="background: linear-gradient(135deg, #0f172a, #1e3a8a); border-radius: 10px;">
                                <a href="${platformUrl}" style="display: inline-block; padding: 16px 40px; color: white; text-decoration: none; font-weight: 600; font-size: 16px;">
                                  Acceder al Sistema de Planillas
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
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
                            Si no solicitó nuevas credenciales, por favor contacte al administrador de su empresa.
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

      console.log("Email sent successfully:", emailResponse);

      // Update log to sent
      if (logEntry) {
        await supabaseAdmin
          .from("email_logs")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", logEntry.id);
      }
    } catch (emailError: any) {
      console.error("Error sending email:", emailError);

      // Update log to failed
      if (logEntry) {
        await supabaseAdmin
          .from("email_logs")
          .update({
            status: "failed",
            error_message: emailError.message || "Error al enviar correo",
          })
          .eq("id", logEntry.id);
      }

      return new Response(
        JSON.stringify({
          error: "La contraseña fue actualizada pero no se pudo enviar el correo. Intente reenviar.",
          password_updated: true,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Log the action
    await supabaseAdmin.from("audit_log").insert({
      log_id: `resend-${Date.now()}`,
      actor_email: callerUser.email || "system",
      action: "resend_credentials",
      target_email: email,
      company_id: company_id || null,
      details: `Credenciales reenviadas al usuario ${email}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Credenciales reenviadas exitosamente",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error in resend-credentials:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
};

serve(handler);
