import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === AUTH GUARD ===
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only admins can send test emails
    const { data: callerRoles } = await supabase
      .from('user_roles').select('role').eq('user_id', callerUser.id);
    const isAdmin = callerRoles?.some((r: any) =>
      ['admin', 'ACL_SuperAdmin'].includes(r.role)
    );
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'RESEND_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendApiKey);

    let testEmail = callerUser.email || 'eberneiser@gmail.com';
    try {
      const body = await req.json();
      if (body.to) testEmail = body.to;
    } catch { /* use default */ }

    const rawFrom = (fromEmail || 'noreply@aclcostarica.com').trim();
    const cleanedFrom = rawFrom.replace(/^"+|"+$/g, '').trim();
    const m = cleanedFrom.match(/<([^>]+)>/);
    const pureEmailAddr = m ? m[1] : cleanedFrom;
    const from = `ACL Web Planillas <${pureEmailAddr}>`;

    console.log('Sending test email to:', testEmail);

    const { data, error } = await resend.emails.send({
      from,
      to: [testEmail],
      subject: 'Test Email - ACL Web Planillas',
      html: `
        <h1>Email de Prueba - ACL Web Planillas</h1>
        <p>Este es un email de prueba del sistema ACL Web · Planillas.</p>
        <p>Si recibes este email, la configuración está funcionando correctamente.</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
    });

    if (error) {
      console.error('Resend API Error:', error.message);
      return new Response(
        JSON.stringify({ success: false, error: error.message || 'Failed to send email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test email sent successfully',
        email_id: data?.id,
        sent_to: testEmail,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in test-email function:', error?.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
