// lib/api.ts
// Typed API client — all backend calls go through here

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface Document {
  id: string;
  filename: string;
  file_type: string;
  size_bytes: number;
  status: "processing" | "ready" | "error";
  page_count: number | null;
  chunk_count: number | null;
  created_at: string;
  error_message: string | null;
}

export interface CitedSource {
  doc_id: string;
  filename: string;
  page_num: number;
  chunk_text: string;
  similarity_score: number;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: CitedSource[];
}

// ── Documents ───────────────────────────────────────────────────────────────

export async function uploadDocument(file: File): Promise<{ doc_id: string; status: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail ?? "Upload failed");
  }
  return res.json();
}

export async function listDocuments(): Promise<Document[]> {
  const res = await fetch(`${BASE}/api/documents`);
  const data = await res.json();
  return data.documents;
}

export async function getDocument(docId: string): Promise<Document> {
  const res = await fetch(`${BASE}/api/documents/${docId}`);
  return res.json();
}

export async function deleteDocument(docId: string): Promise<void> {
  await fetch(`${BASE}/api/documents/${docId}`, { method: "DELETE" });
}

// ── Streaming query ─────────────────────────────────────────────────────────

export interface StreamEvent {
  type: "status" | "token" | "sources" | "done" | "error";
  content?: string;
  message?: string;
  sources?: CitedSource[];
}

export async function* streamQuery(
  question: string,
  docIds: string[],
  history: Message[]
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${BASE}/api/query/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      doc_ids: docIds,
      top_k: 5,
      conversation_history: history.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  if (!res.ok) throw new Error("Query failed");

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";   // keep incomplete line

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event: StreamEvent = JSON.parse(line.slice(6));
          yield event;
        } catch {
          // malformed line — skip
        }
      }
    }
  }
}
