import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface CarryBeeOrderRequest {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  clientContext: string;
  storeId: string;
  deliveryType: number;
  productType: number;
  recipientPhone: string;
  recipientName: string;
  recipientAddress: string;
  cityId: string;
  zoneId: string;
  areaId?: string;
  itemWeight: number;
  collectableAmount: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: CarryBeeOrderRequest = await req.json();
    const {
      baseUrl,
      clientId,
      clientSecret,
      clientContext,
      storeId,
      deliveryType,
      productType,
      recipientPhone,
      recipientName,
      recipientAddress,
      cityId,
      zoneId,
      areaId,
      itemWeight,
      collectableAmount,
    } = body;

    console.log('[carrybee-submit-order] Received request');

    // Validate required parameters
    if (
      !baseUrl ||
      !clientId ||
      !clientSecret ||
      !clientContext ||
      !storeId ||
      !recipientPhone ||
      !recipientName ||
      !recipientAddress ||
      !cityId ||
      !zoneId ||
      itemWeight === undefined ||
      collectableAmount === undefined
    ) {
      console.error('[carrybee-submit-order] Missing required parameters');
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

    // Build order payload
    const orderPayload: any = {
      store_id: storeId,
      delivery_type: deliveryType,
      product_type: productType,
      recipient_phone: recipientPhone,
      recipient_name: recipientName,
      recipient_address: recipientAddress,
      city_id: cityId,
      zone_id: zoneId,
      item_weight: itemWeight,
      collectable_amount: collectableAmount,
    };

    // Include area only if provided
    if (areaId) {
      orderPayload.area_id = areaId;
    }

    const apiUrl = `${baseUrl}/api/v2/orders`;
    console.log('[carrybee-submit-order] Calling CarryBee API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-ID": clientId,
        "Client-Secret": clientSecret,
        "Client-Context": clientContext,
      },
      body: JSON.stringify(orderPayload),
    });

    console.log('[carrybee-submit-order] CarryBee API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[carrybee-submit-order] CarryBee API error: ${response.status} ${response.statusText}`,
        errorText
      );
      return new Response(
        JSON.stringify({
          error: `CarryBee API error: ${response.status} ${response.statusText}`,
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
    console.log('[carrybee-submit-order] CarryBee API response:', JSON.stringify(data).substring(0, 300));

    if (data.error) {
      console.error('[carrybee-submit-order] CarryBee API returned error:', data.message);
      return new Response(
        JSON.stringify({
          error: data.message || "CarryBee API error",
          data: {},
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('[carrybee-submit-order] Order submitted successfully');
    
    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[carrybee-submit-order] Exception:", err instanceof Error ? err.message : err);
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
