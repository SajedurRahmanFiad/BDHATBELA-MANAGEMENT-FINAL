# Server Ops Action Guide

This file explains the one remaining problem in very simple words.

## Short answer

I already fixed the **app/code side** of the slowdown inside this project.

The remaining issue is on the **live hosting/server side** for:

`https://admin.bdhatbela.com`

That means:

- I can prepare the code and deployment package for you
- I cannot directly change your cPanel/LiteSpeed/hosting settings unless you give me server access

## What "ops action" means

"Ops action" means a **server setting change**, not a React change.

In this case, the likely problem is:

- the hosting server for `admin.bdhatbela.com` has an HTTP/2 + TLS/SSL issue
- browsers like Chrome/Edge are sometimes rejecting the connection with `ERR_HTTP2_PROTOCOL_ERROR`

So even when the code is correct, the browser can still fail before the API call finishes cleanly.

## Important: what I already fixed in code

I already changed the app so it puts much less pressure on the server:

- much less background polling
- no unnecessary polling in hidden tabs
- no duplicate retries for important write requests
- lighter order update payloads
- safer session bootstrap behavior
- backend request-path optimizations and caching

These changes should make the server much more stable under load.

## What still has to be done on the live server

One person with hosting access must do **both** of these:

1. Deploy the updated code from this repo
2. Ask the hosting provider to fix the HTTP/2/TLS issue for `admin.bdhatbela.com`

## Can you do it yourself?

Yes, if you have:

- cPanel access to upload the new package
- and either:
  - WHM/root/LiteSpeed admin access, or
  - a hosting support team that can change server settings for you

If you only have normal cPanel access, you will probably need to ask hosting support for the second part.

## What you need to do in the easiest possible way

### Step 1. Upload the new app package

Use the file:

`deploy/cpanel-admin-package.zip`

Upload it into your cPanel home directory and extract it.

The target layout should be:

```text
/home/CPANEL_USER/admin.bdhatbela.com/
/home/CPANEL_USER/bdhatbela_app/
```

Then make sure your live database `.env` is correct at:

`/home/CPANEL_USER/bdhatbela_app/.env`

If you need more help for this part, read:

`CPANEL_DEPLOYMENT.md`

### Step 2. Ask hosting support to fix the server transport problem

Send them the message below.

## Copy-paste message for hosting support

Hello, we are having browser connection problems on our subdomain:

`https://admin.bdhatbela.com`

Users in Chrome and Edge are getting:

- `ERR_HTTP2_PROTOCOL_ERROR`
- API request timeouts / 408 errors

The application code has already been optimized, so we now need the server/network side checked.

Please inspect the LiteSpeed / SSL / HTTP/2 configuration for this subdomain and do one of the following:

1. Fix the HTTP/2 + TLS configuration so the subdomain works normally in Chrome/Edge
2. Or temporarily disable HTTP/2 for `admin.bdhatbela.com` and serve it over HTTP/1.1 until the issue is fixed

Please also verify:

- the SSL certificate is valid and correctly installed for `admin.bdhatbela.com`
- there is no TLS renegotiation issue
- ALPN/HTTP version negotiation is healthy
- LiteSpeed is not timing out upstream PHP requests too aggressively

The API health URL is:

`https://admin.bdhatbela.com/api/?action=health`

Please confirm after the fix so we can retest in Chrome and Edge.

## If the hosting provider asks "why disable HTTP/2?"

You can reply with this:

Chrome/Edge users are seeing `ERR_HTTP2_PROTOCOL_ERROR`, so we want HTTP/2 ruled out immediately. Serving over HTTP/1.1 temporarily is acceptable if it stabilizes the site while the root TLS/HTTP/2 issue is being corrected.

## Will disabling HTTP/2 make the app slow?

Usually, no in any serious way for this app.

Why:

- the bigger problem was the app making too many requests
- that has already been reduced in code
- a stable HTTP/1.1 connection is much better than a broken HTTP/2 connection

So if support disables HTTP/2 temporarily, that is a reasonable and professional stability move.

## Best order to do things

1. Upload the new deployment package
2. Confirm the app opens
3. Ask hosting support to fix or disable HTTP/2 for `admin.bdhatbela.com`
4. Retest in Chrome and Edge
5. If needed, ask support to increase PHP/LiteSpeed timeout limits slightly for the API while load settles

## How to know the fix worked

After both steps are done:

- users should stop seeing `bootstrapSession` timeout errors
- order updates should stop failing randomly
- `fetchOrderById` and notifications should stop timing out as often
- Chrome/Edge console should no longer show `ERR_HTTP2_PROTOCOL_ERROR`

## What I can still do for you

I can do these parts from the code side:

- prepare the latest deployment package
- explain exactly what files to upload
- help you verify the deployed version
- help you read any reply from your hosting provider

I cannot directly do these parts unless you give me hosting/server access:

- change cPanel settings
- change LiteSpeed or Apache settings
- reissue SSL certificates
- disable or reconfigure HTTP/2 on the live server
