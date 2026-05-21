"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { streamQuery, listDocuments, Document, Message, CitedSource } from "@/lib/api";
import ChatWindow from "@/components/ChatWindow";
import { ArrowLeft, FileText } from "lucide-react";

function ChatContent() {
  const router = useRouter();
  const params = useSearchParams();
  const docIds = (params.get("docs") ?? "").split(",").filter(Boolean);

  const [docs, setDocs] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listDocuments().then((all) =>
      setDocs(all.filter((d) => docIds.includes(d.id)))
    );
  }, []);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    setStatusMsg("");

    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);

    // Placeholder assistant message that we'll fill as tokens stream in
    const assistantMsg: Message = { role: "assistant", content: "", sources: [] };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      let accumulated = "";
      const historyForApi = [...messages, userMsg];

      for await (const event of streamQuery(question, docIds, historyForApi)) {
        if (event.type === "status" && event.message) {
          setStatusMsg(event.message);
        } else if (event.type === "token" && event.content) {
          accumulated += event.content;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: accumulated,
            };
            return updated;
          });
        } else if (event.type === "sources" && event.sources) {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              sources: event.sources,
            };
            return updated;
          });
        } else if (event.type === "done") {
          setStatusMsg("");
        } else if (event.type === "error") {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: `Error: ${event.message}`,
            };
            return updated;
          });
        }
      }
    } finally {
      setIsStreaming(false);
      setStatusMsg("");
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {docs.map((doc) => (
            <span
              key={doc.id}
              className="flex items-center gap-1 bg-brand-50 text-brand-700 text-xs px-2 py-1 rounded-md"
            >
              <FileText className="w-3 h-3" />
              {doc.filename}
            </span>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-400">
          {docIds.length} document{docIds.length > 1 ? "s" : ""}
        </span>
      </header>

      {/* Chat messages */}
      <div className="flex-1 overflow-hidden">
        <ChatWindow
          messages={messages}
          isStreaming={isStreaming}
          statusMsg={statusMsg}
        />
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-200 p-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your documents…"
            disabled={isStreaming}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:opacity-50"
            autoFocus
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading…</div>}>
      <ChatContent />
    </Suspense>
  );
}
