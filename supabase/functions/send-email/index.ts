// Secret actualizado: RESEND_FROM_EMAIL = noreply@aureoncr.com
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendEmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64 encoded
  }>;
  companyId: string;
  templateId?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const resend = new Resend(resendApiKey);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { to, subject, html, from, attachments, companyId, templateId }: SendEmailRequest = await req.json();

    console.log('Sending email to:', to);
    console.log('Subject:', subject);
    console.log('Company ID:', companyId);

    // Prepare recipients array
    const recipients = Array.isArray(to) ? to : [to];

    // Send email for each recipient
    const emailResults = [];
    for (const recipient of recipients) {
      try {
        // Create email log entry
        const { data: logEntry, error: logError } = await supabase
          .from('email_logs')
          .insert({
            company_id: companyId,
            recipient_email: recipient,
            subject,
            status: 'sending',
            template_id: templateId || null,
          })
          .select()
          .single();

        if (logError) {
          console.error('Error creating email log:', logError);
        }

        // Send email via Resend - parse FROM correctly
        const rawFromEmail = (Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev').trim();
        const cleanedFrom = rawFromEmail.replace(/^"+|"+$/g, '').trim();
        const defaultFrom = cleanedFrom.includes('<') && cleanedFrom.includes('>')
          ? cleanedFrom
          : `Sistema de Planillas <${cleanedFrom}>`;
        
        // List-Unsubscribe headers improve email reputation with Gmail, Outlook, etc.
        const unsubscribeEmail = 'unsubscribe@aureoncr.com';
        const emailData: any = {
          from: from || defaultFrom,
          to: [recipient],
          subject,
          html,
          headers: {
            'List-Unsubscribe': `<mailto:${unsubscribeEmail}?subject=Unsubscribe>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        };

        if (attachments && attachments.length > 0) {
          emailData.attachments = attachments;
        }

        const { data: emailResponse, error: emailError } = await resend.emails.send(emailData);

        if (emailError) {
          console.error('Error sending email:', emailError);
          
          // Update log with error
          if (logEntry) {
            await supabase
              .from('email_logs')
              .update({
                status: 'failed',
                error_message: emailError.message || 'Error sending email',
              })
              .eq('id', logEntry.id);
          }

          emailResults.push({
            recipient,
            success: false,
            error: emailError.message,
          });
        } else {
          console.log('Email sent successfully:', emailResponse);

          // Update log with success
          if (logEntry) {
            await supabase
              .from('email_logs')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
              })
              .eq('id', logEntry.id);
          }

          emailResults.push({
            recipient,
            success: true,
            messageId: emailResponse?.id,
          });
        }
      } catch (error: any) {
        console.error('Error processing email for', recipient, ':', error);
        emailResults.push({
          recipient,
          success: false,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results: emailResults,
        totalSent: emailResults.filter(r => r.success).length,
        totalFailed: emailResults.filter(r => !r.success).length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in send-email function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
