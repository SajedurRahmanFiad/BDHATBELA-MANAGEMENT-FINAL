
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { fetchCustomers } from './src/services/supabaseQueries';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Expose test functions to window for debugging
(window as any).__testSupabase = {
  async testCustomers() {
    console.log('🧪 Testing customer fetch...');
    try {
      const customers = await fetchCustomers();
      console.log('✅ Success! Customers:', customers);
      return customers;
    } catch (err) {
      console.error('❌ Error:', err);
      throw err;
    }
  },
  async testConnection() {
    console.log('🧪 Testing session (direct table auth)...');
    try {
      const userData = localStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        console.log('✅ User session active:', user);
        return user;
      }
      console.log('ℹ️ No active session - user not logged in');
      return null;
    } catch (err) {
      console.error('❌ Session check error:', err);
      throw err;
    }
  },
  help() {
    console.log('Available test functions:');
    console.log('  __testSupabase.testCustomers() - Fetch customers from DB');
    console.log('  __testSupabase.testConnection() - Check auth session');
    console.log('  __testSupabase.help() - Show this help');
  }
};

console.log('💡 Tip: Type __testSupabase.help() in console for test commands');
