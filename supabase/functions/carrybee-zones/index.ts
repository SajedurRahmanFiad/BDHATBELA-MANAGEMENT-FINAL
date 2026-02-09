import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface CarryBeeRequest {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  clientContext: string;
  cityId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: CarryBeeRequest = await req.json();
    const { baseUrl, clientId, clientSecret, clientContext, cityId } = body;

    console.log('[carrybee-zones] Received request with baseUrl:', baseUrl, 'cityId:', cityId);

    if (!baseUrl || !clientId || !clientSecret || !clientContext || !cityId) {
      console.error('[carrybee-zones] Missing required parameters');
      return new Response(
        JSON.stringify({
          error: "Missing required parameters",
          data: { zones: [] },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiUrl = `${baseUrl}/api/v2/cities/${cityId}/zones`;
    console.log('[carrybee-zones] Calling CarryBee API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Client-ID": clientId,
        "Client-Secret": clientSecret,
        "Client-Context": clientContext,
      },
    });

    console.log('[carrybee-zones] CarryBee API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[carrybee-zones] CarryBee API error: ${response.status} ${response.statusText}`,
        errorText
      );
      return new Response(
        JSON.stringify({
          error: `CarryBee API error: ${response.status} ${response.statusText}`,
          details: errorText,
          data: { zones: [] },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    console.log('[carrybee-zones] CarryBee API response:', JSON.stringify(data).substring(0, 200));

    let zones = [];
    
    if (data.data?.zones && Array.isArray(data.data.zones)) {
      zones = data.data.zones;
    } else if (data.zones && Array.isArray(data.zones)) {
      zones = data.zones;
    } else if (Array.isArray(data)) {
      zones = data;
    } else if (data.error) {
      console.error('[carrybee-zones] CarryBee API returned error:', data.message);
      return new Response(
        JSON.stringify({
          error: data.message || "CarryBee API error",
          data: { zones: [] },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const mappedZones = zones.map((zone: any) => ({
      id: zone.id,
      name: zone.name,
    }));

    console.log('[carrybee-zones] Returning zones:', mappedZones.length);
    
    return new Response(JSON.stringify({ data: { zones: mappedZones } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[carrybee-zones] Exception:", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
        data: { zones: [] },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
