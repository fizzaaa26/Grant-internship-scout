# 🚀 Grant & Internship AI Scout

> **An automated, end-to-end intelligence system that daily scrapes, extracts, synthesizes, stores, notifies, and displays software engineering and electronics internships, student grants, and open fellowship opportunities.**

![GitHub Actions Status](https://img.shields.io/badge/Pipeline-Daily%20Cron-emerald?style=for-the-badge&logo=githubactions)
![Python 3.11](https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge&logo=python)
![Gemini 2.5](https://img.shields.io/badge/AI Engine-Gemini%202.5%20Flash-purple?style=for-the-badge&logo=google)
![Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-emerald?style=for-the-badge&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Frontend-Tailwind%20CSS-38BDF8?style=for-the-badge&logo=tailwindcss)

---

## 📌 Architecture Diagram

```
                     +---------------------------------------+
                     |         GitHub Actions Cron           |
                     |         (Daily @ 02:30 UTC)           |
                     +-------------------+-------------------+
                                         |
                                         v
                     +-------------------+-------------------+
                     |       Python Ingestion Pipeline       |
                     |           (scripts/agent.py)          |
                     +---------+-------------------+---------+
                               |                   |
            +------------------+                   +------------------+
            |                                                         |
            v                                                         v
+-----------+-----------+                                 +-----------+-----------+
|    Tavily Search API  |                                 |    Gemini 2.5 Flash   |
| (Web Crawl & Extract) |                                 |  (JSON Structuring)   |
+-----------+-----------+                                 +-----------+-----------+
            |                                                         |
            +------------------+                   +------------------+
                               |                   |
                               v                   v
                     +---------+-------------------+---------+
                     |  Supabase PostgreSQL DB (RLS Enabled) |
                     +-------------------+-------------------+
                                         |
                       +-----------------+-----------------+
                       |                                   |
                       v                                   v
         +-------------+-------------+       +-------------+-------------+
         |     Gmail SMTP Digest     |       |   GitHub Pages Dashboard    |
         |    (Email Notification)   |       |   (docs/index.html + JS)    |
         +---------------------------+       +---------------------------+
```

---

## ✨ Key Features

- 🔍 **Automated Multi-Source Scraping**: Powered by Tavily's `advanced` search depth API to harvest fresh software engineering internships, hardware/electronics student grants, and open fellowships across the web.
- 🧠 **Gemini 2.5 Flash Structuring**: Raw web search payloads are synthesized by Gemini into clean, structured JSON with strict schema validation (`title`, `company`, `description`, `link`, `tags`, `deadline`).
- ⚡ **Supabase PostgreSQL & RLS**: Persistent relational storage with indexed search capabilities and public read-only Row Level Security (RLS) policies.
- 📬 **Automated Gmail Digest Alerts**: Instant email alerts sent via Gmail SMTP SSL containing top featured opportunities with direct application links.
- ⏱️ **Scheduled GitHub Actions Automation**: Daily automated cron job execution (`30 2 * * *` UTC) with manual trigger capabilities.
- 🎨 **Glassmorphism Web Dashboard**: High-aesthetic GitHub Pages frontend built with Tailwind CSS, featuring live statistics, real-time search filtering, and responsive category pill filters.

---

## 📁 Repository Structure

```
grant-internship-scout/
├── .github/
│   └── workflows/
│       └── pipeline.yml       # GitHub Actions workflow (daily schedule & manual trigger)
├── db/
│   └── schema.sql             # Supabase SQL table schema & RLS policies
├── scripts/
│   └── agent.py               # Main Python pipeline: Search -> Synthesize -> Store -> Notify
├── docs/
│   ├── index.html             # High-aesthetic responsive dashboard UI (GitHub Pages)
│   └── app.js                 # Supabase JS v2 client, live search & tag filter logic
├── requirements.txt           # Python dependencies (supabase, requests)
└── README.md                  # Detailed documentation & setup guide
```

---

## 🛠️ Step-by-Step Setup Guide

### 1. Database Configuration (Supabase)
1. Log in to [Supabase](https://supabase.com/) and create a new project.
2. Open the **SQL Editor** in your Supabase Dashboard.
3. Paste and execute the contents of [`db/schema.sql`](file:///db/schema.sql):
   ```sql
   CREATE TABLE IF NOT EXISTS public.opportunities (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
       title TEXT NOT NULL,
       company TEXT NOT NULL,
       description TEXT,
       link TEXT,
       tags TEXT[] DEFAULT '{}',
       deadline TEXT DEFAULT 'TBD'
   );

   ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Allow public read access" ON public.opportunities 
       FOR SELECT USING (true);
   ```
4. Copy your **Project URL** and **anon / public key** from `Settings` -> `API`.

---

### 2. Obtain API Keys & Passwords

- **Gemini API Key**: Generate a free API key at [Google AI Studio](https://aistudio.google.com/).
- **Tavily API Key**: Get an API key from [Tavily AI Search](https://tavily.com/).
- **Gmail App Password**:
  1. Go to your Google Account Settings -> Security.
  2. Enable 2-Step Verification.
  3. Search for **App passwords**, create a new app password named "Scout", and copy the 16-character code.

---

### 3. Configure GitHub Repository Secrets
Navigate to your GitHub Repository -> `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`, and add the following 6 environment secrets:

| Secret Name | Description |
| :--- | :--- |
| `TAVILY_API_KEY` | Tavily Search API Key |
| `GEMINI_API_KEY` | Google Gemini 2.5 Flash API Key |
| `SUPABASE_URL` | Supabase Project URL (`https://xyz.supabase.co`) |
| `SUPABASE_KEY` | Supabase Secret Service Role Key or Anon Key |
| `SMTP_USER` | Your Gmail address (`yourname@gmail.com`) |
| `SMTP_PASSWORD` | 16-character Gmail App Password |

---

### 4. Configure Web Dashboard (`docs/app.js`)
1. Open [`docs/app.js`](file:///docs/app.js).
2. Update lines 8 & 9 with your Supabase credentials:
   ```javascript
   let SUPABASE_URL = "https://your-project.supabase.co";
   let SUPABASE_ANON_KEY = "your-actual-anon-key";
   ```
*(Note: If left unconfigured, the web dashboard automatically displays a dynamic demo dataset for evaluation).*

---

### 5. Deploy Web Dashboard to GitHub Pages
1. In your GitHub repository, go to `Settings` -> `Pages`.
2. Under **Build and deployment** -> **Source**, select **Deploy from a branch**.
3. Select `main` (or `master`) branch and set folder to `/docs`.
4. Click **Save**. Your dashboard will be live at `https://<your-username>.github.io/<repo-name>/`.

---

## 💻 Local Development & Execution

To test the ingestion pipeline locally on your machine:

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/grant-internship-scout.git
   cd grant-internship-scout
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Export environment variables (Linux/macOS) or set in PowerShell (Windows):
   ```powershell
   $env:TAVILY_API_KEY="your-tavily-key"
   $env:GEMINI_API_KEY="your-gemini-key"
   $env:SUPABASE_URL="https://your-project.supabase.co"
   $env:SUPABASE_KEY="your-supabase-key"
   $env:SMTP_USER="your-email@gmail.com"
   $env:SMTP_PASSWORD="your-app-password"
   ```

4. Execute the agent script:
   ```bash
   python scripts/agent.py
   ```

---

## 👥 Team & Acknowledgments

- **AI Engineer & Lead Developer**: Grant & Internship AI Scout Core Team
- **Technologies Used**: Google Gemini 2.5 Flash, Tavily Search API, Supabase, GitHub Actions, Tailwind CSS.

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
