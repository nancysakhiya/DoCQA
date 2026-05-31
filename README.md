# Multimodal Document QA

A production-grade Retrieval-Augmented Generation (RAG) system that allows users to upload PDFs, Word documents, and images, then ask natural language questions and receive grounded answers with source citations.

## Architecture

```text
Upload → Extract Text (PyMuPDF + OCR)
       → Chunk Documents
       → Generate Embeddings (Ollama Embedding Model)
       → Store Vectors (pgvector / Supabase)

Question → Generate Query Embedding
         → Similarity Search
         → Retrieve Relevant Chunks
         → Build Context Prompt
         → Stream Answer (Llama 3 via Ollama)
```

---

## Tech Stack

| Layer            | Technology                                             |
| ---------------- | ------------------------------------------------------ |
| Frontend         | Next.js 14, TypeScript, Tailwind CSS                   |
| Backend          | FastAPI (Python 3.11)                                  |
| LLM              | Llama 3 (via Ollama)                                   |
| Embeddings       | Ollama Embedding Model (`nomic-embed-text` or similar) |
| Vector Database  | Supabase + pgvector                                    |
| OCR              | Tesseract OCR                                          |
| PDF Parsing      | PyMuPDF (fitz)                                         |
| Document Parsing | python-docx                                            |
| Streaming        | Server-Sent Events (SSE)                               |
| DevOps           | Docker Compose                                         |

---

## Features

* Upload PDFs, DOCX files, and images
* OCR support for scanned documents
* Semantic search using vector embeddings
* Source-grounded answers with citations
* Streaming responses
* Document management (upload, list, delete)
* Local LLM inference using Ollama
* Supabase pgvector integration

---

## Quick Start

### Prerequisites

* Python 3.11+
* Node.js 18+
* Docker (optional)
* Ollama installed locally
* Supabase account

### Install Ollama

Download and install Ollama:

https://ollama.com

Pull the required models:

```bash
ollama pull llama3
ollama pull nomic-embed-text
```

Verify Ollama is running:

```bash
ollama serve
```

---

## 1. Clone Repository

```bash
git clone <your-repository-url>
cd multimodal-doc-qa
```

---

## 2. Set Up Supabase

1. Create a free project in Supabase.
2. Open SQL Editor.
3. Execute `supabase_setup.sql`.
4. Copy:

   * Project URL
   * Service Role Key

---

## 3. Configure Environment Variables

### Backend

```bash
cp backend/.env.example backend/.env
```

Example:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

OLLAMA_BASE_URL=http://localhost:11434

LLM_MODEL=llama3
EMBEDDING_MODEL=nomic-embed-text
```

### Frontend

```bash
cp frontend/.env.local.example frontend/.env.local
```

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 4a. Run with Docker

```bash
docker-compose up --build
```

Services:

* Frontend: http://localhost:3000
* Backend: http://localhost:8000
* API Docs: http://localhost:8000/docs

---

## 4b. Run Manually

### Backend

```bash
cd backend

pip install -r requirements.txt

# Install Tesseract if needed
# Ubuntu:
sudo apt install tesseract-ocr

# macOS:
brew install tesseract

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

npm install
npm run dev
```

---

## Project Structure

```text
multimodal-doc-qa/

├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   └── chat/page.tsx
│   │
│   ├── components/
│   │   ├── UploadZone.tsx
│   │   ├── DocList.tsx
│   │   ├── ChatWindow.tsx
│   │   └── SourceCitation.tsx
│   │
│   └── lib/api.ts
│
├── backend/
│   ├── main.py
│   ├── config.py
│   │
│   ├── routers/
│   │   ├── upload.py
│   │   └── query.py
│   │
│   ├── services/
│   │   ├── extractor.py
│   │   ├── chunker.py
│   │   ├── embedder.py
│   │   ├── vector_store.py
│   │   └── llm.py
│   │
│   └── models/
│       └── schemas.py
│
├── supabase_setup.sql
└── docker-compose.yml
```

---

## Key Technical Decisions

### Why Llama 3 via Ollama?

* Runs entirely locally
* No OpenAI API costs
* Better privacy for sensitive documents
* Easy deployment and model management

### Why Local Embeddings?

Using `nomic-embed-text` through Ollama keeps the entire RAG pipeline local and removes dependency on external embedding APIs.

### Why Recursive Chunking?

Documents often contain context spanning multiple paragraphs. Overlapping chunks preserve semantic continuity while maintaining retrieval quality.

### Why Supabase pgvector?

* Open-source vector search
* PostgreSQL ecosystem
* Metadata filtering support
* Cost-effective compared to dedicated vector databases

### Why SSE Instead of WebSockets?

The application only requires one-way streaming (server → client), making Server-Sent Events simpler and easier to maintain.

---

## API Reference

| Method | Endpoint              | Description                 |
| ------ | --------------------- | --------------------------- |
| POST   | `/api/upload`         | Upload and ingest document  |
| GET    | `/api/documents`      | List uploaded documents     |
| GET    | `/api/documents/{id}` | Retrieve document status    |
| DELETE | `/api/documents/{id}` | Delete document and vectors |
| POST   | `/api/query`          | Non-streaming query         |
| POST   | `/api/query/stream`   | Streaming query via SSE     |
| GET    | `/health`             | Health check                |
| GET    | `/docs`               | Swagger API documentation   |

---

## Example Workflow

1. Upload a PDF, DOCX, or image.
2. Text is extracted using PyMuPDF and OCR.
3. Documents are chunked and embedded.
4. Embeddings are stored in pgvector.
5. User asks a question.
6. Relevant chunks are retrieved using similarity search.
7. Context is passed to Llama 3 through Ollama.
8. The generated answer is streamed back with citations.

This architecture provides a fully local, privacy-focused RAG pipeline while maintaining production-grade retrieval and response quality.
