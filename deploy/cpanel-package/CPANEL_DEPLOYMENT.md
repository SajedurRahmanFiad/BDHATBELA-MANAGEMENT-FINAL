# cPanel Deployment Guide

This app is ready to deploy to cPanel as a subdomain app where the document root is the folder:

`/home/CPANEL_USER/admin1.bdhatbela.com/`

The deployment shape is:

- static frontend files in `admin1.bdhatbela.com`
- PHP backend files in a sibling private folder `bdhatbela_app`
- MariaDB database created from cPanel

## Recommended server layout

Use this structure in your cPanel account home:

```text
/home/CPANEL_USER/
  admin1.bdhatbela.com/
    index.html
    assets/
    api/
      index.php
      .htaccess
    .htaccess
  bdhatbela_app/
    .env
    backend/
      bootstrap.php
      public/
      src/
      bin/
      database/
```

## Where to enter live database credentials

Put them in:

`/home/CPANEL_USER/bdhatbela_app/.env`

Use the template from:

`deploy/cpanel-template/bdhatbela_app/.env.example`

The exact variables are:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=cpanelusername_bdhatbela
DB_USER=cpanelusername_bdhatbela_user
DB_PASS=your-live-database-password
APP_JWT_SECRET=your-long-random-secret
APP_TIMEZONE=Asia/Dhaka
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Build the upload package locally

Run:

```powershell
npm run deploy:cpanel:prepare:admin1
```

This creates:

- `deploy/cpanel-admin1-package/`
- `deploy/cpanel-admin1-package.zip`

## cPanel steps

### 1. Create the live database

In cPanel use Database Wizard / Manage My Databases and create:

- one database
- one database user
- grant that user all privileges

Official cPanel docs:

- https://docs.cpanel.net/cpanel/databases/mysql-database-wizard/
- https://docs.cpanel.net/cpanel/databases/mysql-databases/

Important:

- cPanel usually prefixes database and username values
- use the full prefixed values in `.env`

### 2. Upload the files

Upload `deploy/cpanel-admin1-package.zip` into your cPanel home directory and extract it.

Official cPanel File Manager doc:

- https://docs.cpanel.net/cpanel/files/file-manager/110/

After extraction, you should have:

- `/home/CPANEL_USER/admin1.bdhatbela.com/`
- `/home/CPANEL_USER/bdhatbela_app/`

If your cPanel subdomain already points to `/home/CPANEL_USER/admin1.bdhatbela.com/`, you do not need to move the frontend files anywhere else.

### 3. Create the server `.env`

Copy:

`/home/CPANEL_USER/bdhatbela_app/.env.example`

to:

`/home/CPANEL_USER/bdhatbela_app/.env`

Then edit `.env` and enter:

- your live MariaDB credentials
- your JWT secret
- your Supabase URL/service-role key if you want server-side refresh from production later

### 4. Initialize or refresh the live MariaDB data

If your cPanel has Terminal access, run one of these:

```bash
php /home/CPANEL_USER/bdhatbela_app/backend/bin/setup.php
php /home/CPANEL_USER/bdhatbela_app/backend/bin/refresh_from_supabase.php
```

Use `refresh_from_supabase.php` if you want the server database to be rebuilt from production Supabase.

Official cPanel Terminal doc:

- https://docs.cpanel.net/cpanel/advanced/terminal-in-cpanel/

If your host does not provide Terminal:

- create the database in cPanel
- prepare/fill the data locally
- export/import it through phpMyAdmin instead

### 5. Verify the deployment

Open:

```text
https://admin1.bdhatbela.com/api/?action=health
```

You should get JSON with `"ok": true`.

Then open:

```text
https://admin1.bdhatbela.com/
```

## Notes

- the frontend build already uses `/api/`, so you do not need Node.js on cPanel
- the cPanel API entry file is `admin1.bdhatbela.com/api/index.php`
- the backend stays outside the subdomain document root so only the API entrypoint is web-accessible
- the refresh script imports from Supabase in read-only mode and does not modify Supabase
- if your cPanel subdomain uses a different document-root folder than `admin1.bdhatbela.com`, generate a package with a different `-DocumentRootFolder` value
