#!/usr/bin/env node

/**
 * Create admin user using Supabase Admin API
 * Run with: node create-admin.js
 */

const SUPABASE_URL = 'ozjddzasadgffjjeqntc.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96amRkemFzYWRnZmZqamVxbnRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM5MzAzMSwiZXhwIjoyMDg1OTY5MDMxfQ.aLWHhqL9GsntFPniUb--wsw8NX5XPnU1bdjOFzZJ5CY';

const phone = '01404020000';
const email = `${phone}@bdhatbela.local`;
const password = 'admin@bdhatbela';

async function createAdminUser() {
  try {
    console.log('\n📝 Creating admin user...');
    console.log(`   Phone: ${phone}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role: Admin\n`);

    // Step 1: Create auth user
    console.log('1️⃣  Creating Supabase Auth user...');
    const authResponse = await fetch(
      `https://${SUPABASE_URL}/auth/v1/admin/users`,
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
      `https://${SUPABASE_URL}/rest/v1/users`,
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
