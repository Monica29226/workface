import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkEmailRequest {
  recipients: Array<{
    email: string;
    name?: string;
  }>;
  subject: string;
  htmlTemplate: string;
  companyId: string;
  templateId?: string;
  attachmentUrl?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { recipients, subject, htmlTemplate, companyId, templateId, attachmentUrl }: BulkEmailRequest = await req.json();

    console.log('Processing bulk email send for', recipients.length, 'recipients');

    // Create email log entries in queue
    const emailLogs = [];
    for (const recipient of recipients) {
      const { data: logEntry, error: logError } = await supabase
        .from('email_logs')
        .insert({
          company_id: companyId,
          recipient_email: recipient.email,
          recipient_name: recipient.name || null,
          subject,
          status: 'queued',
          template_id: templateId || null,
          attachment_url: attachmentUrl || null,
        })
        .select()
        .single();

      if (logError) {
        console.error('Error creating email log:', logError);
      } else {
        emailLogs.push(logEntry);
      }
    }

    console.log('Created', emailLogs.length, 'email log entries in queue');

    // Process emails in batches using the send-email function
    const batchSize = 10;
    let processedCount = 0;
    
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      // Call send-email function for each batch
      for (const recipient of batch) {
        try {
          const response = await supabase.functions.invoke('send-email', {
            body: {
              to: recipient.email,
              subject,
              html: htmlTemplate,
              companyId,
              templateId,
              attachmentUrl,
            },
          });

          if (response.error) {
            console.error('Error sending email to', recipient.email, ':', response.error);
          } else {
            processedCount++;
          }
        } catch (error: any) {
          console.error('Error invoking send-email for', recipient.email, ':', error);
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalRecipients: recipients.length,
        processed: processedCount,
        queued: emailLogs.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in send-bulk-emails function:', error);
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
