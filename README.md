# सोनार समाज ट्रस्ट, इंदौर (Sonar Samaj Trust, Indore)

Official website and admin portal for **सोनार समाज ट्रस्ट, इंदौर** ([sonarsamaj.com](https://sonarsamaj.com)).

## Project Structure

```text
├── index.html                 # Main multi-lingual portal (Marathi, Hindi, English)
├── contact.html               # Standalone contact & committee directory page
├── admin/
│   ├── index.html             # Password-protected Admin Portal
│   └── config.yml             # CMS configuration
├── content/                   # Structured JSON data (gallery, events, directory, news)
├── netlify/functions/         # Serverless API endpoints (PostgreSQL + Auth + Email)
│   ├── auth.js                # HMAC-SHA256 admin session verification
│   ├── admin-login.js         # Admin login & token verification endpoint
│   ├── members.js             # Membership registration API + Gmail notification
│   ├── celebrations.js        # Birthdays & anniversaries API (single + Excel bulk)
│   ├── businesses.js          # Business directory CRUD API
│   ├── save-business.js       # GitHub-backed directory sync
│   └── db.js                  # PostgreSQL connection pool
├── src/
│   ├── members/               # Executive committee member portraits
│   ├── gallery/               # Year-wise & event-wise photo archives
│   └── ...                    # Logos, news scans, video clips, and UPI QR
├── netlify.toml               # Netlify build & function routing config
├── package.json               # Node dependencies (pg, nodemailer)
├── robots.txt & sitemap.xml   # SEO configuration
```

## Key Features
- **Multi-lingual UI:** Instant switching between Marathi, Hindi, and English.
- **Karyakarini Samiti & Business Directory:** Searchable community business listings and committee profiles.
- **Events, News & Collapsible Gallery:** Interactive lightbox gallery with year/program filters, newspaper scans, and video highlights.
- **Membership Registration:** Captures DOB, Blood Group, and family details into Supabase PostgreSQL, generates a WhatsApp summary, and emails `sonarsamajindore@gmail.com`.
- **Secured Admin Portal (`/admin/`):** Protected by server-side login and signed Bearer tokens; supports Excel/CSV bulk birthday imports, gallery previews, business management, and member application tracking.

## Environment Variables (Netlify)
- `DATABASE_URL` — PostgreSQL connection string (Supabase pooler)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — Admin portal credentials
- `ADMIN_AUTH_SECRET` — Optional custom HMAC signing key
- `GMAIL_APP_PASSWORD` — Gmail App Password for membership email notifications
- `GITHUB_TOKEN` — Optional token for `save-business.js`
