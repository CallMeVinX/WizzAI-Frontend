# WizzAI Lead Management — Frontend Console

A minimalist, interactive Next.js (App Router + TypeScript + Tailwind CSS) dashboard and testing console for the WizzAI Lead Management & Entity Resolution backend API.

---

## Features

- **Backend Health & Status**: Live ping and status indicator against `GET /health`.
- **System Overview & Analytics**: Visual metric cards and distribution bars driven by `GET /api/dashboard`.
- **Leads Directory (CRUD & Export)**:
  - Full-text search (`q`) across name, company, and email.
  - Multi-attribute filtering by `status`, `owner`, and `country` populated dynamically from `GET /api/leads/filters`.
  - Pagination controls (`page`, `limit`).
  - Direct CSV streaming download via `GET /api/leads/export`.
  - Detailed lead inspection modal with inline editing of mutable fields (`lead_status`, `contact_owner`, `notes`) via `PATCH /api/leads/{id}`.
- **Entity Deduplication & Transitive Clustering**:
  - Deduplication pipeline trigger button via `POST /api/leads/dedupe-candidates`.
  - Candidate pairs view with confidence percentage bars, match reason chips, and review actions (`Confirm`, `Reject`, `Reset`) via `PATCH /api/leads/dedupe-candidates/{id}`.
  - Transitive cluster view via `GET /api/leads/dedupe-clusters` showing grouped entities with primary lead election.
- **AI Source Extractor Playground**:
  - Interactive test workbench for `POST /api/leads/extract-source`.
  - Pre-configured test cases (Event booth, Organic Search, Hyphenated referral names, Ambiguous LLM narrative).
  - Returns structured `{ channel, detail, method }`.
- **Inbound Web Form Ingestion Playground**:
  - Interactive test form matching `POST /api/leads/ingest` and `website_form_submissions.json`.
  - Test new lead creation vs. non-destructive contact enrichment.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Backend API Connection
By default, the frontend connects to `http://localhost:8000`. You can change the target backend URL directly in the input field located in the top navigation bar without restarting the frontend server.
