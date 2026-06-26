import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FaceDetectionRequest {
  image_base64: string;
  return_attributes?: string; // comma-separated: gender,age,smiling,headpose,facequality,blur,eyestatus,emotion,beauty,mouthstatus,eyegaze,skinstatus
}

interface FaceRectangle {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface FaceData {
  face_token: string;
  face_rectangle: FaceRectangle;
  attributes?: Record<string, any>;
}

interface FaceDetectionResponse {
  success: boolean;
  faces: FaceData[];
  face_count: number;
  image_id?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === AUTH GUARD ===
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, faces: [], face_count: 0, error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !callerUser) {
      return new Response(
        JSON.stringify({ success: false, faces: [], face_count: 0, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FACEPP_API_KEY');
    const apiSecret = Deno.env.get('FACEPP_API_SECRET');

    if (!apiKey || !apiSecret) {
      console.error('Face++ API credentials not configured');
      return new Response(
        JSON.stringify({
          success: false,
          faces: [],
          face_count: 0,
          error: 'Face++ API credentials not configured. Please add FACEPP_API_KEY and FACEPP_API_SECRET secrets.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { image_base64, return_attributes }: FaceDetectionRequest = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({
          success: false,
          faces: [],
          face_count: 0,
          error: 'image_base64 is required',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Processing facial recognition request...');
    console.log('Image size:', image_base64.length, 'characters');

    // Prepare form data for Face++ API
    const formData = new FormData();
    formData.append('api_key', apiKey);
    formData.append('api_secret', apiSecret);
    formData.append('image_base64', image_base64);
    
    // Add optional attributes
    if (return_attributes) {
      formData.append('return_attributes', return_attributes);
    } else {
      // Default attributes for attendance system
      formData.append('return_attributes', 'gender,age,facequality,blur,headpose');
    }

    // Call Face++ Detect API
    console.log('Calling Face++ Detect API...');
    const faceResponse = await fetch('https://api-us.faceplusplus.com/facepp/v3/detect', {
      method: 'POST',
      body: formData,
    });

    const faceData = await faceResponse.json();
    console.log('Face++ API response status:', faceResponse.status);

    if (!faceResponse.ok) {
      console.error('Face++ API error:', faceData);
      return new Response(
        JSON.stringify({
          success: false,
          faces: [],
          face_count: 0,
          error: faceData.error_message || 'Face++ API error',
        }),
        {
          status: faceResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Process successful response
    const faces: FaceData[] = faceData.faces || [];
    console.log('Detected faces:', faces.length);

    const response: FaceDetectionResponse = {
      success: true,
      faces: faces,
      face_count: faces.length,
      image_id: faceData.image_id,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in facial-recognition function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        faces: [],
        face_count: 0,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
