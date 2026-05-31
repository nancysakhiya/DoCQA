# Multimodal Document QA

A production-grade RAG (Retrieval-Augmented Generation) system that lets you upload PDFs, Word documents, and images, then ask natural language questions and get cited answers.

## Architecture

```
Upload → Extract text (PyMuPDF + OCR) → Chunk → Embed (OpenAI) → Store (pgvector)
                                                                        ↓
Question → Embed query → Similarity search → Build prompt → Stream answer (GPT-4o-mini)
```

## Tech Stack

| Layer         | Technology                        |
|---------------|-----------------------------------|
| Frontend      | Next.js 14, TypeScript, Tailwind  |
| Backend       | FastAPI (Python 3.11)             |
| Embeddings    | OpenAI text-embedding-3-small     |
| LLM           | GPT-4o-mini (streaming)           |
| Vector DB     | Supabase + pgvector               |
| OCR           | Tesseract via pytesseract         |
| PDF parsing   | PyMuPDF (fitz)                    |
| DevOps        | Docker Compose                    |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker (optional but recommended)
- OpenAI API key
- Supabase account (free tier works)

### 1. Clone & enter the project
```bash
git clone <your-repo>
cd multimodal-doc-qa
```

### 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → **New query**
3. Paste the contents of `supabase_setup.sql` and click **Run**
4. Copy your project URL and service key from **Settings → API**

### 3. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Fill in: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

# Frontend
cp frontend/.env.local.example frontend/.env.local
# Fill in: NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4a. Run with Docker (recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs (Swagger): http://localhost:8000/docs

### 4b. Run manually (no Docker)

**Backend:**
```bash
cd backend
pip install -r requirements.txt

# macOS/Ubuntu: also install Tesseract
# macOS:  brew install tesseract
# Ubuntu: sudo apt-get install tesseract-ocr

uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Project Structure

```
multimodal-doc-qa/
├── frontend/                  # Next.js 14 app
│   ├── app/
│   │   ├── page.tsx           # Upload + document library
│   │   └── chat/page.tsx      # Chat interface
│   ├── components/
│   │   ├── UploadZone.tsx     # Drag-drop upload
│   │   ├── DocList.tsx        # Document library with status
│   │   ├── ChatWindow.tsx     # Streaming message thread
│   │   └── SourceCitation.tsx # Expandable citation cards
│   └── lib/api.ts             # Typed API client
│
├── backend/                   # FastAPI Python backend
│   ├── main.py                # App entrypoint + CORS
│   ├── config.py              # Settings via pydantic-settings
│   ├── routers/
│   │   ├── upload.py          # POST /api/upload + document CRUD
│   │   └── query.py           # POST /api/query/stream (SSE)
│   ├── services/
│   │   ├── extractor.py       # PDF/DOCX/image → text
│   │   ├── chunker.py         # Text → overlapping chunks
│   │   ├── embedder.py        # Chunks → OpenAI vectors
│   │   ├── vector_store.py    # Supabase pgvector CRUD
│   │   └── llm.py             # Prompt + streaming GPT call
│   └── models/schemas.py      # Pydantic schemas
│
├── supabase_setup.sql         # Run this first in Supabase!
└── docker-compose.yml
```

---

## Key Technical Decisions

**Why `text-embedding-3-small` over `ada-002`?**  
5x cheaper, comparable quality, and the 1536-dim output is pgvector-compatible.

**Why `RecursiveCharacterTextSplitter` with overlap?**  
Sentences that span chunk boundaries won't get cut off. The 50-token overlap ensures context continuity without doubling storage.

**Why Supabase pgvector over Pinecone?**  
One less managed service. pgvector on Postgres lets us do hybrid queries (filter by `doc_id`, sort by `created_at`) with a single SQL call — Pinecone needs metadata filters as a separate feature.

**Why query rewriting?**  
User questions like "what did they say about money?" retrieve poorly. Rewriting to "annual revenue, financial projections, monetary policy" before embedding measurably improves recall.

**Why SSE over WebSockets for streaming?**  
Simpler. SSE is unidirectional (server → client), which is all we need. Works with `fetch()`, no socket lifecycle to manage.

---

## API Reference

| Method | Endpoint              | Description                            |
|--------|-----------------------|----------------------------------------|
| POST   | `/api/upload`         | Upload file, starts ingestion          |
| GET    | `/api/documents`      | List all documents                     |
| GET    | `/api/documents/{id}` | Get document status (poll this)        |
| DELETE | `/api/documents/{id}` | Delete document + chunks               |
| POST   | `/api/query`          | Non-streaming query                    |
| POST   | `/api/query/stream`   | Streaming query via SSE                |
| GET    | `/health`             | Health check                           |
| GET    | `/docs`               | Swagger UI (auto-generated)            |

---

## What to build next (Phase 2+)

- [ ] PDF viewer with passage highlighting (react-pdf)
- [ ] Cross-document comparison queries
- [ ] Confidence threshold filtering
- [ ] Export conversation as PDF
- [ ] Authentication (Supabase Auth)
- [ ] Document re-indexing
