"use client";

import { useEffect, useRef } from "react";
import { Message, CitedSource } from "@/lib/api";
import SourceCitation from "./SourceCitation";
import { Bot, User } from "lucide-react";
import clsx from "clsx";

interface ChatWindowProps {
  messages: Message[];
  isStreaming: boolean;
  statusMsg: string;
}

export default function ChatWindow({ messages, isStreaming, statusMsg }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll as tokens arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusMsg]);

  if (messages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8 text-gray-400">
        <Bot className="w-10 h-10 mb-4 text-gray-200" />
        <p className="text-base font-medium text-gray-500">Ask anything about your documents</p>
        <p className="text-sm mt-1">
          Try: "Summarise the key findings" or "What does page 3 say about revenue?"
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto chat-scroll px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={clsx("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
            {/* Avatar */}
            <div
              className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-medium",
                msg.role === "user" ? "bg-gray-400" : "bg-brand-500"
              )}
            >
              {msg.role === "user" ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>

            <div className={clsx("flex-1 space-y-3", msg.role === "user" && "flex flex-col items-end")}>
              {/* Message bubble */}
              <div
                className={clsx(
                  "rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%]",
                  msg.role === "user"
                    ? "bg-brand-500 text-white"
                    : "bg-gray-50 border border-gray-100 text-gray-800"
                )}
              >
                {msg.content ? (
                  <MessageContent content={msg.content} />
                ) : (
                  // Empty assistant message while streaming starts
                  <span className="text-gray-400 text-xs">Thinking…</span>
                )}
                {/* Typing cursor on last streaming message */}
                {isStreaming && i === messages.length - 1 && msg.role === "assistant" && (
                  <span className="typing-cursor" />
                )}
              </div>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="w-full max-w-[85%]">
                  <p className="text-xs text-gray-400 mb-2">
                    Sources ({msg.sources.length})
                  </p>
                  <div className="space-y-2">
                    {msg.sources.map((src, j) => (
                      <SourceCitation key={j} source={src} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Status indicator */}
        {statusMsg && (
          <div className="flex items-center gap-2 text-xs text-gray-400 pl-11">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-brand-300 border-t-brand-500 animate-spin" />
            {statusMsg}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// Renders message text — preserves newlines, handles basic markdown-like bold
function MessageContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line) return <br key={i} />;
        // Bold: **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i}>
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j}>{part.slice(2, -2)}</strong>
              ) : (
                part
              )
            )}
          </p>
        );
      })}
    </div>
  );
}
