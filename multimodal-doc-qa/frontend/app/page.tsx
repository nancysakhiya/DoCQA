"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import UploadZone from "@/components/UploadZone";
import DocList from "@/components/DocList";
import { listDocuments, Document } from "@/lib/api";
import { MessageSquare } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Document[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchDocs = async () => {
    try {
      const list = await listDocuments();
      setDocs(list);
    } catch {
      // backend not up yet — silently ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    // Poll for status changes while any doc is processing
    const interval = setInterval(() => {
      if (docs.some((d) => d.status === "processing")) {
        fetchDocs();
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [docs]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const readyDocs = docs.filter((d) => d.status === "ready");
  const selectedReady = [...selectedIds].filter((id) =>
    readyDocs.some((d) => d.id === id)
  );

  const startChat = () => {
    if (selectedReady.length === 0) return;
    router.push(`/chat?docs=${selectedReady.join(",")}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="text-brand-500 w-6 h-6" />
            <span className="font-semibold text-lg">DocQA</span>
          </div>
          <p className="text-sm text-gray-500">
            Upload documents → ask questions → get cited answers
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10 space-y-10">
        {/* Upload */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Upload documents</h2>
          <UploadZone onUploadComplete={fetchDocs} />
          <p className="text-xs text-gray-400 mt-2">
            Supports PDF, DOCX, PNG, JPG, WEBP · Max {" "}
            {process.env.NEXT_PUBLIC_MAX_FILE_MB ?? "20"}MB per file
          </p>
        </section>

        {/* Document library */}
        {(docs.length > 0 || loading) && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Your documents</h2>
              {selectedReady.length > 0 && (
                <button
                  onClick={startChat}
                  className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat with {selectedReady.length} doc
                  {selectedReady.length > 1 ? "s" : ""}
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-sm text-gray-400">Loading…</div>
            ) : (
              <DocList
                docs={docs}
                selectedIds={selectedIds}
                onToggle={toggleSelect}
                onDeleted={fetchDocs}
              />
            )}

            {docs.length > 0 && selectedReady.length === 0 && (
              <p className="text-sm text-gray-400 mt-3">
                Select one or more ready documents to start chatting.
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
