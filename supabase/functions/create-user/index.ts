import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the requester is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user has admin-level role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (roleError || !roleData || !["admin", "ACL_SuperAdmin", "Client_Admin"].includes(roleData.role)) {
      throw new Error("Insufficient permissions");
    }

    const { email, full_name, password, company_id } = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    // SECURITY: If company_id is provided, validate the requester has access
    if (company_id) {
      const { data: companyAccess } = await supabaseAdmin
        .from("company_users")
        .select("id")
        .eq("user_id", user.id)
        .eq("company_id", company_id)
        .maybeSingle();

      if (!companyAccess && roleData.role !== "admin" && roleData.role !== "ACL_SuperAdmin") {
        // Log security attempt
        await supabaseAdmin.from("audit_log").insert({
          log_id: `SEC-${Date.now()}`,
          actor_email: user.email || "unknown",
          action: "create_user_blocked_cross_company",
          target_email: email,
          company_id: company_id,
          details: `Blocked: user ${user.email} attempted to create user for company they don't belong to`,
        });
        throw new Error("No tiene acceso a esta empresa");
      }
    }

    // Generate a temporary password if not provided
    const userPassword = password || `Temp${Math.random().toString(36).slice(-8)}!`;

    // Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || email,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      throw createError;
    }

    // Send credentials email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const rawFromEmail = (Deno.env.get("RESEND_FROM_EMAIL") || "noreply@calderon.cr").trim();
    const cleanedFrom = rawFromEmail.replace(/^\"+|\"+$/g, "").trim();
    const emailMatch = cleanedFrom.match(/<([^>]+)>/);
    const pureEmail = emailMatch ? emailMatch[1] : cleanedFrom;
    const from = `ACL Payroll CR <${pureEmail}>`;

    const portalUrl = "https://workforcehub.calderon.cr";
    const loginLink = `${portalUrl}/auth`;
    const systemName = "ACL Workforce HUB";
    const supportEmail = "soporte@aureoncr.com";
    const logoUrl = "https://aureoncr.com/wp-content/uploads/2024/01/logo-aureon-blanco.png";

    const resend = new Resend(resendApiKey);
    const { error: emailError } = await resend.emails.send({
      from,
      to: [email],
      subject: `Bienvenido al ${systemName}`,
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
                        <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px;">¡Bienvenido, ${full_name || "Usuario"}!</h2>
                        <p style="color: #475569; line-height: 1.7; margin: 0 0 24px 0; font-size: 15px;">
                          Su empresa lo ha registrado en el <strong>${systemName}</strong>, el sistema de gestión de planillas y nómina.
                        </p>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 0 0 24px 0;">
                          <tr>
                            <td style="padding: 20px;">
                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                  <td style="padding: 0 0 12px 0;">
                                    <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Portal de Acceso</p>
                                    <a href="${loginLink}" style="color: #1e40af; font-size: 14px; text-decoration: underline;">${loginLink}</a>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding: 12px 0; border-top: 1px solid #e2e8f0;">
                                    <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Usuario</p>
                                    <p style="margin: 0; color: #0f172a; font-weight: 600; font-size: 15px;">${email}</p>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding: 12px 0 0 0; border-top: 1px solid #e2e8f0;">
                                    <p style="margin: 0 0 4px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Contraseña Temporal</p>
                                    <p style="margin: 0; color: #0f172a; font-weight: 600; font-size: 15px; font-family: monospace; background: #fff; padding: 8px 12px; border-radius: 6px; border: 1px dashed #cbd5e1;">${userPassword}</p>
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
                                <strong>⚠️ Importante:</strong> Cambie su contraseña temporal después de iniciar sesión.
                              </p>
                            </td>
                          </tr>
                        </table>
                        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                          <tr>
                            <td style="background: linear-gradient(135deg, #0f172a, #1e3a8a); border-radius: 10px;">
                              <a href="${loginLink}" style="display: inline-block; padding: 16px 40px; color: white; text-decoration: none; font-weight: 600; font-size: 16px;">
                                Acceder al Sistema
                              </a>
                            </td>
                          </tr>
                        </table>
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
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Error sending credentials email:", emailError);
    }

    // Log to email_logs for traceability
    if (company_id) {
      await supabaseAdmin.from("email_logs").insert({
        company_id: company_id,
        recipient_email: email,
        recipient_name: full_name || email,
        subject: `Bienvenido al ${systemName}`,
        status: emailError ? "failed" : "sent",
        error_message: emailError ? JSON.stringify(emailError) : null,
        sent_at: emailError ? null : new Date().toISOString(),
      });
    }

    // Log to audit
    await supabaseAdmin.from("audit_log").insert({
      log_id: `USR-${Date.now()}`,
      actor_email: user.email || "system",
      action: "user_created",
      target_email: email,
      company_id: company_id || null,
      details: JSON.stringify({
        created_by: user.id,
        email_sent: !emailError,
        full_name: full_name || email,
      }),
    });

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          full_name: full_name || email,
        },
        email_sent: !emailError,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in create-user function:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "An error occurred",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
};

serve(handler);
