# BDHATBELA Management System

A modern React + TypeScript management system with Supabase backend for handling customers, orders, transactions, and business operations.

## Architecture

```
┌─────────────────────────────┐
│   React + TypeScript UI     │
│  (pages, components)        │
└────────────┬────────────────┘
             │
      ┌──────▼──────────┐
      │ Services Layer  │
      │ supabaseQueries │
      │ AuthProvider    │
      └──────┬──────────┘
             │
      ┌──────▼──────────┐
      │  Supabase       │
      │  - Auth         │
      │  - PostgreSQL   │
      │  - RLS Policies │
      └─────────────────┘
```

**Architecture Pattern:** Supabase-direct (no middle-tier Node.js API)
- **Frontend:** React + TypeScript + Vite
- **Backend:** Supabase (managed PostgreSQL + Auth)
- **Data Access:** Centralized query helpers in `src/services/supabaseQueries.ts`
- **Security:** Row Level Security (RLS) policies on all tables

## Quick Start

### Prerequisites
- Node.js 16+
- Supabase account

### 1. Clone & Install
```bash
npm install
```

### 2. Configure Supabase
1. Copy `.env.example` to `.env.local`
2. Add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

### 3. Set Up Database
Run the SQL blocks from [RLS_SETUP.sql](RLS_SETUP.sql) in your Supabase SQL Editor:
1. Go to https://app.supabase.com → Your Project → SQL Editor
2. Create a new query
3. Paste the entire [RLS_SETUP.sql](RLS_SETUP.sql)
4. Click Run

### 4. Start Development Server
```bash
npm run dev
```

Open http://localhost:5173 and log in with your credentials.

### 5. Build for Production
```bash
npm run build
npm run preview
```

## Key Features

✅ **Authentication**
- Phone-based login via Supabase Auth
- Automatic profile syncing
- Session management

✅ **Data Management**
- Customers, Orders, Transactions, Bills
- Vendors, Products, Accounts, Users
- Settings and Reports

✅ **Security**
- Row Level Security (RLS) policies
- Role-based access control (Admin/Employee)
- Environment variable-based configuration

✅ **Developer Experience**
- TypeScript for type safety
- Centralized query helpers
- Consistent error handling
- Comprehensive logging

## File Structure

```
src/
├── contexts/
│   └── AuthProvider.tsx          # Auth state management
├── services/
│   ├── supabaseClient.ts         # Supabase initialization
│   └── supabaseQueries.ts        # CRUD helpers (customers, orders, etc.)
├── pages/                        # Page components
├── components/                   # Reusable UI components
└── types.ts                      # TypeScript types

.env.local                         # Your Supabase credentials (DO NOT COMMIT)
RLS_SETUP.sql                      # Database and RLS policy setup
```

## Documentation

- **[SUPABASE_INTEGRATION.md](SUPABASE_INTEGRATION.md)** - Complete Supabase setup guide (tables, RLS, troubleshooting)
- **[SUBABASE_SETUP_COMPLETE.md](SUBABASE_SETUP_COMPLETE.md)** - What's been implemented and next steps
- **[DO_THIS_NOW.md](DO_THIS_NOW.md)** - 2-minute fix to apply RLS policies
- **[SUPABASE_MIGRATION_CHECKLIST.md](SUPABASE_MIGRATION_CHECKLIST.md)** - 10-phase implementation roadmap

## Troubleshooting

### Customers page stuck in loading state?
1. Apply RLS policies: Run [RLS_SETUP.sql](RLS_SETUP.sql) in Supabase SQL Editor
2. Refresh the app (Ctrl+F5)
3. Check browser DevTools Console for errors

### Login fails?
1. Verify `.env.local` has correct Supabase credentials
2. Check that user exists in Supabase Auth settings
3. Verify `users` table has a matching row

### "Missing environment variables" error?
1. Ensure `.env.local` file exists (not `.env`)
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Restart dev server after updating `.env.local`

## Development Commands

```bash
npm run dev           # Start development server
npm run build         # Build for production
npm run preview       # Preview production build
npm run type-check    # Type checking
```

## Support

For questions or issues:
1. Check the troubleshooting section above
2. Review [SUPABASE_INTEGRATION.md](SUPABASE_INTEGRATION.md) for detailed setup
3. Check browser DevTools Console for error messages
4. Review `RLS_SETUP.sql` to ensure policies are applied

---

**Last Updated:** February 7, 2026  
**Status:** ✅ Production Ready  
**Backend:** Supabase (Auth + PostgreSQL + RLS)
