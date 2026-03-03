#!/usr/bin/env node

/**
 * Create admin user using Supabase Admin API
 * Run with: node create-admin.js
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const BASE_URL = SUPABASE_URL
  ? (SUPABASE_URL.startsWith('http') ? SUPABASE_URL : `https://${SUPABASE_URL}`)
  : '';

const phone = '01404020000';
const email = `${phone}@bdhatbela.local`;
const password = 'admin@bdhatbela';

async function createAdminUser() {
  try {
    if (!BASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error(
        'Missing environment variables. Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.'
      );
    }
    console.log('\n📝 Creating admin user...');
    console.log(`   Phone: ${phone}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role: Admin\n`);

    // Step 1: Create auth user
    console.log('1️⃣  Creating Supabase Auth user...');
    const authResponse = await fetch(
      `${BASE_URL}/auth/v1/admin/users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: { phone },
        }),
      }
    );

    let userId;
    const authResponseText = await authResponse.text();
    
    if (authResponse.ok) {
      const authData = JSON.parse(authResponseText);
      userId = authData.id;
      console.log(`✅ Auth user created: ${userId}`);
    } else {
      // Check if user already exists (422 = Unprocessable Entity)
      if (authResponse.status === 422) {
        console.log(`⚠️  User already exists`);
        console.log(`   Using hardcoded ID from previous creation...`);
        userId = 'edda12c5-4ecf-4b44-8a32-050f17423756';
        console.log(`✅ Using user ID: ${userId}`);
      } else {
        throw new Error(`Auth creation failed: ${authResponseText}`);
      }
    }

    // Step 2: Create user profile in database
    console.log('\n2️⃣  Creating user profile in database...');
    const profileResponse = await fetch(
      `${BASE_URL}/rest/v1/users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          id: userId,
          phone,
          name: 'Admin User',
          role: 'Admin',
          image: null,
        }),
      }
    );

    const responseText = await profileResponse.text();
    
    if (!profileResponse.ok) {
      // Check if profile already exists
      if (profileResponse.status === 409 || (responseText.includes('duplicate') || responseText.includes('already'))) {
        console.log(`⚠️  User profile already exists`);
        console.log(`✅ Admin user is ready to use!`);
      } else {
        throw new Error(`Profile creation failed: ${responseText}`);
      }
    } else {
      const profileData = responseText ? JSON.parse(responseText) : {};
      console.log(`✅ User profile created:`, profileData[0] || profileData);
    }

    console.log('\n✨ Admin user created successfully!\n');
    console.log('You can now log in with:');
    console.log(`  Phone: ${phone}`);
    console.log(`  Password: ${password}\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creating admin user:');
    console.error((error).message);
    process.exit(1);
  }
}

createAdminUser();
