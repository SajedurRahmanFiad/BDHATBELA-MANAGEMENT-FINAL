// Run this in browser console to test different endpoint combinations
const testApiKey = 'umykntrc68x9pbtktkfeykrmzb32xid5';
const testSecretKey = 'mowhgnt1vavshntsh4ahdfj6';

const endpoints = [
  'https://portal.packzy.com/api/v1/create_order',
  'https://portal.packzy.com/api/v2/create_order',
  'https://portal.packzy.com/api/create_order',
  'https://api.packzy.com/v1/create_order',
  'https://api.packzy.com/api/v1/create_order',
];

const testPayload = {
  invoice: 'TEST-001',
  recipient_name: 'Test',
  recipient_phone: '01700000000',
  recipient_address: 'Test Addr',
  cod_amount: 100
};

console.log('🔍 Testing different endpoint variations...\n');

async function testEndpoint(url) {
  console.log(`\n📍 Testing: ${url}`);
  console.log('=====================================');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Api-Key': testApiKey,
        'Secret-Key': testSecretKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload),
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    const contentType = response.headers.get('content-type');
    console.log(`Content-Type: ${contentType}`);
    
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      console.log('Response (JSON):', JSON.stringify(data, null, 2));
    } else {
      data = await response.text();
      console.log('Response (Text):', data);
    }
    
    return { url, status: response.status, data };
  } catch (err) {
    console.error(`❌ Error:`, err.message);
    return { url, error: err.message };
  }
}

// Test all endpoints sequentially
(async () => {
  const results = [];
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    await new Promise(r => setTimeout(r, 300)); // Small delay between requests
  }
  
  console.log('\n\n📊 SUMMARY:');
  console.log('=====================================');
  results.forEach(r => {
    if (r.error) {
      console.log(`❌ ${r.url}: ${r.error}`);
    } else {
      console.log(`${r.status === 200 ? '✅' : '❌'} ${r.url}: ${r.status}`);
    }
  });
})();
