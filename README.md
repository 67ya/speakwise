# speakwise

An AI-powered English learning platform that delivers real-time, structured feedback on spoken and written input. Users submit voice or text, choose a practice category, and receive an AI-generated analysis — including a natural spoken rewrite, grammar corrections, vocabulary breakdown, and Chinese translation.

The platform is designed around an extensible category system, meaning new types of practice (business writing, presentation skills, domain-specific vocabulary, etc.) can be added without changing the core architecture — only a new prompt and a new category entry.

---

## Features

### Voice Input
Uses the browser's built-in Web Speech API to transcribe speech in real time. Continuous recording mode keeps listening until the user manually stops, allowing multi-sentence input without interruption. Falls back gracefully when the browser does not support the API.

### Category-Based AI Analysis
Each practice category uses a dedicated AI prompt tailored to its context. Submitting the same sentence under different categories produces meaningfully different feedback. The current categories are a starting point — the system is built to support dozens more.

### Structured Feedback
Every submission returns four sections:
- **Spoken rewrite** — a more natural, fluent version of the input
- **Grammar corrections** — specific issues identified with explanations in Chinese
- **Vocabulary breakdown** — key words and phrases with Chinese definitions
- **Chinese translation** — of the rewritten version

### Notebook
Analyzed entries can be saved to a personal notebook. Entries are organized into user-defined categories, support color-coded priority labels (P1–P7), and can be browsed, filtered, and reviewed at any time.

### AI Response Caching
Responses from the AI API are cached in Redis using a hash of the input and category as the key, with a 7-day TTL. Repeated submissions return instantly without additional API calls, reducing both cost and latency.

### Responsive Layout
The UI adapts to both desktop and mobile viewports. On mobile, the notebook switches to a slide-in detail panel to make better use of limited screen space.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 8 |
| Backend | .NET 8, ASP.NET Core Web API |
| ORM | Entity Framework Core + Pomelo MySQL |
| Database | MySQL 8 |
| Cache | Redis 7, StackExchange.Redis |
| AI | OpenAI-compatible Chat Completions API |
| HTTP Client | Axios (frontend), HttpClient (backend) |
| Container | Docker, Docker Compose |
| Web Server | nginx (reverse proxy + SPA serving) |

---

## Architecture

```
Browser
  │
  └── nginx :80
        ├── /api/*  ──────────►  ASP.NET Core API :8080
        │                              │
        │                              ├── MySQL  (entries, categories)
        │                              └── Redis  (AI response cache)
        │
        └── /*  ──────────────►  React SPA (static files from dist/)
```

All services run as Docker containers managed by Docker Compose. nginx acts as the single entry point — it serves the React app as static files and proxies any `/api/` request to the .NET container. The browser never talks directly to the API, which means no CORS configuration is needed in production.

---

## Project Structure

```
fluent-lab/
├── web/                        # React + TypeScript frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── PracticeView.tsx    # Main practice interface
│   │   │   └── NotebookView.tsx    # Saved entries browser
│   │   ├── hooks/
│   │   │   └── useVoiceInput.ts    # Web Speech API hook
│   │   ├── api/
│   │   │   ├── client.ts           # Axios instance
│   │   │   ├── analyze.ts          # AI analysis endpoint
│   │   │   ├── entries.ts          # Notebook CRUD
│   │   │   └── categories.ts       # Category CRUD
│   │   └── types/
│   │       └── index.ts            # Shared TypeScript interfaces
│   ├── nginx.conf
│   └── Dockerfile
│
├── eng-learn/                  # ASP.NET Core Web API backend
│   ├── Controllers/
│   │   ├── AnalyzeController.cs    # POST /api/analyze
│   │   ├── EntriesController.cs    # CRUD /api/entries
│   │   └── CategoriesController.cs # CRUD /api/categories
│   ├── Services/
│   │   └── AiService.cs            # Prompt building, API call, Redis caching
│   ├── Models/
│   │   ├── Entry.cs
│   │   ├── Category.cs
│   │   └── AnalyzeRequest.cs
│   ├── Data/
│   │   └── AppDbContext.cs
│   └── appsettings.json
│
├── docker-compose.yml
├── .env                        # Secrets — gitignored
├── start-frontend.bat          # Local dev: start Vite dev server
├── start-backend.bat           # Local dev: start Redis + .NET API
└── deploy.bat                  # Build → package → upload → deploy
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- .NET 8 SDK
- MySQL 8
- Redis (or Docker Desktop)

### 1. Configure local secrets

Create `eng-learn/appsettings.Local.json` (this file is gitignored):

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=127.0.0.1;Port=3306;Database=english_learn;User=root;Password=YOUR_PASSWORD;"
  },
  "Ai": {
    "BaseUrl": "https://api.openai.com/v1",
    "ApiKey": "YOUR_API_KEY",
    "Model": "gpt-4o"
  }
}
```

### 2. Start the backend

```
start-backend.bat
```

This starts Redis and the .NET API at `http://127.0.0.1:8090`.  
Swagger UI is available at `http://127.0.0.1:8090/swagger`.  
The database tables are created automatically on first run via `EnsureCreated()`.

### 3. Start the frontend

```
start-frontend.bat
```

Vite dev server starts at `http://localhost:3000`.  
API requests are proxied to `http://127.0.0.1:8090` via the `.env.development` config.

---

## Deployment

One-command deploy to any Linux server with Docker:

```
deploy.bat
```

**What it does:**
1. Runs `npm run build` to produce the React static files
2. Archives the source with `tar`, excluding `node_modules`, `bin/obj`, and secrets
3. Uploads the archive to the server via SCP
4. SSHs in and runs `docker-compose down && docker-compose up -d --build`

**Required `.env` in the project root (gitignored):**

```env
MYSQL_ROOT_PASSWORD=your_db_password
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=your_api_key
AI_MODEL=gpt-4o
```

Docker Compose injects these values into the API container at runtime — no secrets are baked into the image.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze` | Submit a sentence for AI analysis |
| `GET` | `/api/entries` | Get all saved notebook entries |
| `POST` | `/api/entries` | Save a new entry |
| `PUT` | `/api/entries/:id` | Update an entry (e.g. color label) |
| `DELETE` | `/api/entries/:id` | Delete an entry |
| `GET` | `/api/categories` | Get all categories |
| `POST` | `/api/categories` | Create a new category |
| `PUT` | `/api/categories/:id` | Rename a category |
| `DELETE` | `/api/categories/:id` | Delete a category |

### POST `/api/analyze` — Request body

```json
{
  "sentence": "I working here for three year.",
  "includeSpoken": true,
  "practiceType": "general"
}
```

### POST `/api/analyze` — Response

```json
{
  "spoken": "I've been working here for three years.",
  "translation": "我在这里工作了三年。",
  "analysis": "have been working - 现在完成进行时，表示持续到现在的动作\nfor three years - 持续时间，搭配完成时态使用",
  "corrections": "\"I working\" → I've been working - 缺少助动词，需用现在完成进行时\n\"three year\" → three years - 复数名词",
  "fromCache": false
}
```
