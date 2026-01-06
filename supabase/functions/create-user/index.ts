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

    // Verify the requester is an admin
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

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (roleError || !roleData || !["admin", "ACL_SuperAdmin"].includes(roleData.role)) {
      throw new Error("Insufficient permissions");
    }

    const { email, full_name, password } = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    // Generate a temporary password if not provided
    const userPassword = password || `Temp${Math.random().toString(36).slice(-8)}!`;

    // Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true, // Auto-confirm email
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

    const rawFromEmail = (Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev").trim();
    const cleanedFrom = rawFromEmail.replace(/^\"+|\"+$/g, "").trim();
    const from = cleanedFrom.includes("<") && cleanedFrom.includes(">")
      ? cleanedFrom
      : `Aureon <${cleanedFrom}>`;

    const appOrigin = (
      req.headers.get("origin") ||
      Deno.env.get("APP_URL") ||
      Deno.env.get("PLATFORM_URL") ||
      "https://aureoncr.com"
    ).replace(/\/$/, "");

    const loginLink = `${appOrigin}/auth`;

    const resend = new Resend(resendApiKey);
    const { error: emailError } = await resend.emails.send({
      from,
      to: [email],
      subject: "Credenciales de acceso",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f6f7fb; margin:0; padding:24px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; margin:0 auto;">
              <tr>
                <td style="background:#ffffff; border-radius:12px; padding:28px; box-shadow:0 8px 24px rgba(15,23,42,0.08);">
                  <h1 style="margin:0 0 12px 0; font-size:20px; color:#0f172a;">Tu cuenta fue creada</h1>
                  <p style="margin:0 0 18px 0; color:#475569; line-height:1.6;">
                    Hola ${full_name || email}, aquí tienes tus credenciales de acceso:
                  </p>

                  <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
                    <p style="margin:0 0 8px 0; color:#64748b; font-size:13px;">Usuario</p>
                    <p style="margin:0 0 12px 0; color:#0f172a; font-weight:600; word-break:break-all;">${email}</p>
                    <p style="margin:0 0 8px 0; color:#64748b; font-size:13px;">Contraseña temporal</p>
                    <p style="margin:0; color:#0f172a; font-weight:600; word-break:break-all;">${userPassword}</p>
                  </div>

                  <div style="margin-top:18px;">
                    <a href="${loginLink}" style="display:inline-block; background:#0f172a; color:#ffffff; text-decoration:none; padding:12px 16px; border-radius:10px; font-weight:600;">
                      Iniciar sesión
                    </a>
                  </div>

                  <p style="margin:18px 0 0 0; color:#64748b; font-size:13px; line-height:1.6;">
                    Por seguridad, cambia tu contraseña después de iniciar sesión.
                  </p>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Error sending credentials email:", emailError);
      throw new Error(emailError.message || "Error sending credentials email");
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          full_name: full_name || email,
        },
        email_sent: true,
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

