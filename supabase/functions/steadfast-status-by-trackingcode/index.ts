import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface SteadfastTrackingRequest {
  baseUrl: string;
  apiKey: string;
  secretKey: string;
  trackingCode: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: SteadfastTrackingRequest = await req.json();
    const { baseUrl, apiKey, secretKey, trackingCode } = body;

    if (!baseUrl || !apiKey || !secretKey || !trackingCode) {
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

    const apiUrl = `${baseUrl.replace(/\/$/, "")}/status_by_trackingcode/${encodeURIComponent(trackingCode)}`;
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Api-Key": apiKey,
        "Secret-Key": secretKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
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

    const data = await response.json();
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
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
