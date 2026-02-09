import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface CarryBeeRequest {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  clientContext: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: CarryBeeRequest = await req.json();
    const { baseUrl, clientId, clientSecret, clientContext } = body;

    console.log('[carrybee-stores] Received request with baseUrl:', baseUrl);

    // Validate required parameters
    if (!baseUrl || !clientId || !clientSecret || !clientContext) {
      console.error('[carrybee-stores] Missing required parameters');
      return new Response(
        JSON.stringify({
          error: "Missing required parameters",
          data: { stores: [] },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Call CarryBee API
    const apiUrl = `${baseUrl}/api/v2/stores`;
    console.log('[carrybee-stores] Calling CarryBee API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Client-ID": clientId,
        "Client-Secret": clientSecret,
        "Client-Context": clientContext,
      },
    });

    console.log('[carrybee-stores] CarryBee API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[carrybee-stores] CarryBee API error: ${response.status} ${response.statusText}`,
        errorText
      );
      return new Response(
        JSON.stringify({
          error: `CarryBee API error: ${response.status} ${response.statusText}`,
          details: errorText,
          data: { stores: [] },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    console.log('[carrybee-stores] CarryBee API response:', JSON.stringify(data).substring(0, 200));

    // Handle different response structures
    let stores = [];
    
    if (data.data?.stores && Array.isArray(data.data.stores)) {
      stores = data.data.stores;
    } else if (data.stores && Array.isArray(data.stores)) {
      stores = data.stores;
    } else if (Array.isArray(data)) {
      stores = data;
    } else if (data.error) {
      console.error('[carrybee-stores] CarryBee API returned error:', data.message);
      return new Response(
        JSON.stringify({
          error: data.message || "CarryBee API error",
          data: { stores: [] },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Map stores to { id, name } format
    const mappedStores = stores.map((store: any) => ({
      id: store.id,
      name: store.name,
    }));

    console.log('[carrybee-stores] Returning stores:', mappedStores.length);
    
    return new Response(JSON.stringify({ data: { stores: mappedStores } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[carrybee-stores] Exception:", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
        data: { stores: [] },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
