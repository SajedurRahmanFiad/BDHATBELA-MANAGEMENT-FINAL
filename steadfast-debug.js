// This is a test script to debug the Steadfast API integration
// Run this in browser console to test the API call

async function testSteadfastAPI() {
  const SUPABASE_URL = 'https://ozjddzasadgffjjeqntc.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96amRkemFzYWRnZmZqamVxbnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzOTMwMzEsImV4cCI6MjA4NTk2OTAzMX0._1fbWup_bHYe0PN5QUcptRMuwZRAEFwQOPEPd7Lk3NY';

  // Replace with your actual credentials
  const baseUrl = 'https://portal.steadfast.com.bd/api/v1'; // Change if needed
  const apiKey = 'YOUR_API_KEY_HERE';
  const secretKey = 'YOUR_SECRET_KEY_HERE';

  console.log('📋 Testing Steadfast API Integration');
  console.log('=====================================');
  console.log('Base URL:', baseUrl);
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 5)}...` : 'MISSING');
  console.log('Secret Key:', secretKey ? `${secretKey.substring(0, 5)}...` : 'MISSING');

  if (!apiKey || !secretKey || apiKey === 'YOUR_API_KEY_HERE') {
    console.error('❌ Credentials not configured. Edit this script with your actual credentials.');
    return;
  }

  // Test 1: Direct API call to Steadfast
  console.log('\n1️⃣ Testing Direct API Call to Steadfast...');
  try {
    const testPayload = {
      invoice: 'TEST-001',
      recipient_name: 'Test User',
      recipient_phone: '01700000000',
      recipient_address: 'Test Address',
      cod_amount: 100,
    };

    console.log('Request payload:', testPayload);
    console.log('Headers:', { 
      'Api-Key': `${apiKey.substring(0, 5)}...`,
      'Secret-Key': `${secretKey.substring(0, 5)}...`,
      'Content-Type': 'application/json'
    });

    const directResponse = await fetch(`${baseUrl}/create_order`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log('Direct API Response Status:', directResponse.status);
    const directData = await directResponse.json();
    console.log('Direct API Response:', directData);

    if (directResponse.ok) {
      console.log('✅ Direct API call successful!');
    } else {
      console.log('❌ Direct API call failed:', directData);
    }
  } catch (err) {
    console.error('❌ Direct API Error:', err.message);
  }

  // Test 2: Via Supabase Edge Function
  console.log('\n2️⃣ Testing via Supabase Edge Function...');
  try {
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/steadfast-submit-order`;
    console.log('Edge Function URL:', edgeFunctionUrl);

    const payload = {
      baseUrl,
      apiKey,
      secretKey,
      invoice: 'TEST-002',
      recipientName: 'Test User',
      recipientPhone: '01700000000',
      recipientAddress: 'Test Address',
      codAmount: 100,
    };

    console.log('Sending payload:', payload);

    const edgeResponse = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('Edge Function Response Status:', edgeResponse.status);
    const edgeData = await edgeResponse.json();
    console.log('Edge Function Response:', edgeData);

    if (edgeData.error) {
      console.log('❌ Edge Function Error:', edgeData.error);
      if (edgeData.details) {
        console.log('Details:', edgeData.details);
      }
    } else {
      console.log('✅ Edge Function call successful!');
    }
  } catch (err) {
    console.error('❌ Edge Function Error:', err.message);
  }

  console.log('\n📊 Debugging Complete');
}

// Run the test
testSteadfastAPI();
