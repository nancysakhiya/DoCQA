"""
main.py
-------
FastAPI application entrypoint.

Run locally (no Docker):
  cd backend
  cp .env.example .env   # fill in your keys
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000

Then open: http://localhost:8000/docs  (Swagger UI — great for testing!)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import upload, query

app = FastAPI(
    title="Multimodal Document QA",
    description="RAG-powered document question answering with citations",
    version="1.0.0",
)

# CORS — allow the Next.js frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # local dev
        "https://*.vercel.app",    # deployed frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(upload.router)
app.include_router(query.router)


@app.get("/health")
def health_check():
    """Quick endpoint to verify the server is running."""
    return {"status": "ok", "version": "1.0.0"}


@app.get("/")
def root():
    return {
        "message": "Multimodal Document QA API",
        "docs": "/docs",
        "health": "/health",
    }
