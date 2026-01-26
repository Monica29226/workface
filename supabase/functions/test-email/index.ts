import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');

    console.log('=== RESEND CONFIGURATION DEBUG ===');
    console.log('RESEND_API_KEY configured:', !!resendApiKey);
    console.log('RESEND_API_KEY length:', resendApiKey?.length || 0);
    console.log('RESEND_FROM_EMAIL:', fromEmail || 'NOT SET');

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'RESEND_API_KEY is not configured',
          debug: {
            api_key_exists: false,
            from_email: fromEmail || 'NOT SET',
          }
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const resend = new Resend(resendApiKey);
    
    // Parse request body for optional test email recipient
    let testEmail = 'eberneiser@gmail.com'; // default test recipient
    try {
      const body = await req.json();
      if (body.to) {
        testEmail = body.to;
      }
    } catch {
      // Use default if no body
    }

    // Using noreply@aureoncr.com - domain aureoncr.com must be verified in Resend
    const rawFrom = (fromEmail || 'noreply@aureoncr.com').trim();
    const cleanedFrom = rawFrom.replace(/^"+|"+$/g, '').trim();
    const from = cleanedFrom.includes('<') && cleanedFrom.includes('>')
      ? cleanedFrom
      : `ACL Workforce HUB <${cleanedFrom}>`;

    console.log('Attempting to send test email to:', testEmail);
    console.log('Using FROM:', from);

    // Test email sending
    const { data, error } = await resend.emails.send({
      from,
      to: [testEmail],
      subject: 'Test Email - ACL Workforce HUB',
      html: `
        <h1>Email de Prueba - ACL Workforce HUB</h1>
        <p>Este es un email de prueba del sistema ACL Workforce HUB.</p>
        <p>Si recibes este email, la configuración de Resend está funcionando correctamente.</p>
        <p><strong>Portal:</strong> <a href="https://workforcehub.calderon.cr">https://workforcehub.calderon.cr</a></p>
        <hr>
        <p><strong>Configuración:</strong></p>
        <ul>
          <li>From: ${fromEmail || 'noreply@aureoncr.com'}</li>
          <li>Timestamp: ${new Date().toISOString()}</li>
        </ul>
      `,
    });

    if (error) {
      console.error('Resend API Error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Failed to send email',
          resend_error: error,
          debug: {
            api_key_exists: true,
            api_key_prefix: resendApiKey.substring(0, 8) + '...',
            from_email: fromEmail || 'onboarding@resend.dev',
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Email sent successfully:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test email sent successfully',
        email_id: data?.id,
        sent_to: testEmail,
        from: fromEmail || 'onboarding@resend.dev',
        debug: {
          api_key_exists: true,
          from_email_configured: !!fromEmail,
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in test-email function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
