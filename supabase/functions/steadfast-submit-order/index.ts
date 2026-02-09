import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface SteadfastOrderRequest {
  baseUrl: string;
  apiKey: string;
  secretKey: string;
  invoice: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  codAmount: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: SteadfastOrderRequest = await req.json();
    const {
      baseUrl,
      apiKey,
      secretKey,
      invoice,
      recipientName,
      recipientPhone,
      recipientAddress,
      codAmount,
    } = body;

    console.log('[steadfast-submit-order] ========== REQUEST RECEIVED ==========');
    console.log('[steadfast-submit-order] Raw body:', JSON.stringify(body));
    console.log('[steadfast-submit-order] BaseUrl:', JSON.stringify(baseUrl));
    console.log('[steadfast-submit-order] ApiKey:', apiKey ? `${String(apiKey).substring(0, 5)}...` : 'UNDEFINED');
    console.log('[steadfast-submit-order] SecretKey:', secretKey ? `${String(secretKey).substring(0, 5)}...` : 'UNDEFINED');
    console.log('[steadfast-submit-order] Invoice:', JSON.stringify(invoice));
    console.log('[steadfast-submit-order] RecipientName:', JSON.stringify(recipientName));
    console.log('[steadfast-submit-order] RecipientPhone:', JSON.stringify(recipientPhone));
    console.log('[steadfast-submit-order] RecipientAddress:', JSON.stringify(recipientAddress));
    console.log('[steadfast-submit-order] CodAmount:', JSON.stringify(codAmount));

    console.log('[steadfast-submit-order] ========== VALIDATION ==========');

    // Validate required parameters
    if (
      !baseUrl ||
      !apiKey ||
      !secretKey ||
      !invoice ||
      !recipientName ||
      !recipientPhone ||
      !recipientAddress ||
      codAmount === undefined
    ) {
      console.error('[steadfast-submit-order] Missing required parameters');
      return new Response(
        JSON.stringify({
          error: "Missing required parameters",
          data: {},
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build order payload with credentials
    const orderPayload = {
      invoice,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      recipient_address: recipientAddress,
      cod_amount: codAmount,
    };

    const apiUrl = `${baseUrl}/create_order`;
    console.log('[steadfast-submit-order] Calling Steadfast API:', apiUrl);
    console.log('[steadfast-submit-order] Request payload keys:', Object.keys(orderPayload).join(', '));
    console.log('[steadfast-submit-order] Request payload:', JSON.stringify(orderPayload));
    console.log('[steadfast-submit-order] Auth headers:');
    console.log('[steadfast-submit-order]   Api-Key:', apiKey ? `LENGTH: ${String(apiKey).length}, First 5: ${String(apiKey).substring(0, 5)}...` : 'UNDEFINED');
    console.log('[steadfast-submit-order]   Secret-Key:', secretKey ? `LENGTH: ${String(secretKey).length}, First 5: ${String(secretKey).substring(0, 5)}...` : 'UNDEFINED');
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Secret-Key": secretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    console.log('[steadfast-submit-order] ========== STEADFAST API RESPONSE ==========');
    console.log('[steadfast-submit-order] Status Code:', response.status);
    console.log('[steadfast-submit-order] Status Text:', response.statusText);

    if (!response.ok) {
      let errorText = '';
      let parsedJSON: any = null;
      try {
        const rawText = await response.text();
        errorText = rawText;
        console.log('[steadfast-submit-order] Raw error response:', rawText);
        
        // Try to parse as JSON in case it's JSON-formatted
        try {
          parsedJSON = JSON.parse(rawText);
          console.log('[steadfast-submit-order] Parsed JSON error:', parsedJSON);
        } catch (jsonErr) {
          console.log('[steadfast-submit-order] Error response is plain text, not JSON');
        }
      } catch (e) {
        errorText = '(unable to read response body)';
        console.error('[steadfast-submit-order] Failed to read error response:', e);
      }
      
      console.error(
        `[steadfast-submit-order] Steadfast API error: ${response.status} ${response.statusText}`
      );
      console.error('[steadfast-submit-order] Response body:', errorText);
      
      return new Response(
        JSON.stringify({
          error: `Steadfast API error: ${response.status} ${response.statusText}`,
          details: errorText,
          data: {},
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let data: any;
    try {
      data = await response.json();
    } catch (jsonErr) {
      console.error('[steadfast-submit-order] Failed to parse response as JSON:', jsonErr);
      const responseText = await response.text();
      console.error('[steadfast-submit-order] Response was:', responseText);
      return new Response(
        JSON.stringify({
          error: 'Invalid response format from Steadfast API',
          details: responseText,
          data: {},
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log('[steadfast-submit-order] Steadfast API response:', JSON.stringify(data).substring(0, 300));

    if (data.error) {
      console.error('[steadfast-submit-order] Steadfast API returned error:', data.message);
      return new Response(
        JSON.stringify({
          error: data.message || "Steadfast API error",
          data: {},
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('[steadfast-submit-order] Order submitted successfully');
    
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[steadfast-submit-order] Exception:", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
        data: {},
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
