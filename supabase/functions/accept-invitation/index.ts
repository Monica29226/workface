import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptInvitationRequest {
  token: string;
  password: string;
  fullName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, password, fullName }: AcceptInvitationRequest = await req.json();

    if (!token || !password) {
      return new Response(
        JSON.stringify({ error: "Token y contraseña son requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing invitation acceptance for token:", token.substring(0, 10) + "...");

    // Find the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("user_invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (inviteError || !invitation) {
      console.error("Invitation not found or invalid:", inviteError);
      return new Response(
        JSON.stringify({ error: "Invitación no válida o ya ha sido utilizada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "La invitación ha expirado. Solicite una nueva invitación." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Invitation found for email:", invitation.email);

    // Create the user in auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: invitation.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || invitation.email.split('@')[0],
      },
    });

    if (authError) {
      console.error("Error creating auth user:", authError);
      
      // Check if user already exists
      if (authError.message.includes("already registered") || authError.message.includes("already exists")) {
        return new Response(
          JSON.stringify({ error: "Este correo ya está registrado. Intente iniciar sesión." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Error al crear el usuario: " + authError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;
    console.log("User created with ID:", userId);

    // Create user role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: userId,
        role: invitation.role,
        company_id: invitation.company_id,
      });

    if (roleError) {
      console.error("Error creating user role:", roleError);
    }

    // Create company access if company_id is specified
    if (invitation.company_id) {
      const { error: companyError } = await supabase
        .from("company_users")
        .insert({
          user_id: userId,
          company_id: invitation.company_id,
          role: invitation.role.startsWith("ACL_") ? "admin" : "company_manager",
        });

      if (companyError) {
        console.error("Error creating company access:", companyError);
      }

      // Create default permissions
      const { error: permError } = await supabase
        .from("user_company_permissions")
        .insert({
          user_id: userId,
          company_id: invitation.company_id,
          permission_level: invitation.role === "Client_Admin" ? "Admin" : "Solo lectura",
          can_manage_employees: ["Client_Admin", "Client_HR"].includes(invitation.role),
          can_manage_projects: ["Client_Admin"].includes(invitation.role),
          can_manage_payroll: ["Client_Admin"].includes(invitation.role),
          can_view_reports: true,
          can_manage_parameters: invitation.role === "Client_Admin",
        });

      if (permError) {
        console.error("Error creating permissions:", permError);
      }
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from("user_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (updateError) {
      console.error("Error updating invitation:", updateError);
    }

    // Log the action
    await supabase.from("audit_log").insert({
      log_id: `ACC-${Date.now()}`,
      actor_email: invitation.email,
      action: "invitation_accepted",
      company_id: invitation.company_id,
      details: JSON.stringify({ 
        role: invitation.role,
        user_id: userId,
      }),
    });

    console.log("Invitation accepted successfully for:", invitation.email);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cuenta creada exitosamente. Ya puede iniciar sesión.",
        email: invitation.email,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in accept-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
