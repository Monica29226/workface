import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { date } = await req.json();
    
    if (!date) {
      console.error('Missing date parameter');
      return new Response(
        JSON.stringify({ error: 'Parámetro date es requerido (formato YYYY-MM-DD)' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching BCCR exchange rate for date: ${date}`);

    const token = Deno.env.get('BCCR_TOKEN');
    const email = Deno.env.get('BCCR_EMAIL');
    const nombre = Deno.env.get('BCCR_NOMBRE') || 'Sistema Planillas';

    if (!token || !email) {
      console.error('BCCR configuration incomplete - missing token or email');
      return new Response(
        JSON.stringify({ error: 'Configuración de BCCR incompleta. Configurar BCCR_TOKEN y BCCR_EMAIL.' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert YYYY-MM-DD to DD/MM/YYYY format required by BCCR
    const [year, month, day] = date.split('-');
    const formattedDate = `${day}/${month}/${year}`;

    console.log(`Calling BCCR API with date: ${formattedDate}, nombre: ${nombre}`);

    // BCCR Web Service URL - Indicator 318 is "Tipo de cambio de venta del dólar"
    const url = `https://gee.bccr.fi.cr/Indicadores/Suscripciones/WS/wsindicadoreseconomicos.asmx/ObtenerIndicadoresEconomicosXML?Indicador=318&FechaInicio=${formattedDate}&FechaFinal=${formattedDate}&Nombre=${encodeURIComponent(nombre)}&SubNiveles=N&CorreoElectronico=${encodeURIComponent(email)}&Token=${token}`;

    const response = await fetch(url);
    const xmlText = await response.text();

    console.log(`BCCR API response status: ${response.status}`);
    console.log(`BCCR XML response (first 500 chars): ${xmlText.substring(0, 500)}`);

    // Parse NUM_VALOR from the XML response
    const valueMatch = xmlText.match(/<NUM_VALOR>([\d.]+)<\/NUM_VALOR>/);
    
    if (!valueMatch) {
      console.error('Could not extract NUM_VALOR from BCCR response');
      return new Response(
        JSON.stringify({ 
          error: 'No se pudo obtener el tipo de cambio del BCCR', 
          details: 'NUM_VALOR not found in response',
          xmlPreview: xmlText.substring(0, 500) 
        }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const venta = parseFloat(valueMatch[1]);
    console.log(`Successfully retrieved exchange rate: ${venta} for date: ${date}`);

    return new Response(
      JSON.stringify({ venta, fecha: date }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching BCCR exchange rate:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
