"use client";

import { useState } from "react";
import { Document, deleteDocument } from "@/lib/api";
import {
  FileText,
  Image,
  File,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  Layers,
} from "lucide-react";
import clsx from "clsx";

interface DocListProps {
  docs: Document[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onDeleted: () => void;
}

function fileIcon(type: string) {
  if (type === "pdf") return <FileText className="w-4 h-4 text-red-400" />;
  if (type === "image") return <Image className="w-4 h-4 text-purple-400" />;
  return <File className="w-4 h-4 text-blue-400" />;
}

function statusBadge(status: string) {
  switch (status) {
    case "ready":
      return (
        <span className="flex items-center gap-1 text-green-600 text-xs">
          <CheckCircle2 className="w-3 h-3" />
          Ready
        </span>
      );
    case "processing":
      return (
        <span className="flex items-center gap-1 text-amber-500 text-xs">
          <Clock className="w-3 h-3 animate-pulse" />
          Processing…
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1 text-red-400 text-xs">
          <XCircle className="w-3 h-3" />
          Error
        </span>
      );
    default:
      return null;
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function DocList({ docs, selectedIds, onToggle, onDeleted }: DocListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this document and its embeddings?")) return;
    setDeleting(id);
    try {
      await deleteDocument(id);
      onDeleted();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="grid gap-2">
      {docs.map((doc) => {
        const isSelected = selectedIds.has(doc.id);
        const isReady = doc.status === "ready";

        return (
          <div
            key={doc.id}
            onClick={() => isReady && onToggle(doc.id)}
            className={clsx(
              "flex items-center gap-3 border rounded-xl px-4 py-3 transition-all",
              isReady ? "cursor-pointer" : "cursor-default opacity-75",
              isSelected
                ? "border-brand-500 bg-brand-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            )}
          >
            {/* Checkbox indicator */}
            <div
              className={clsx(
                "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                isSelected
                  ? "border-brand-500 bg-brand-500"
                  : "border-gray-300"
              )}
            >
              {isSelected && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                  <path
                    d="M1 4l3 3 5-6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>

            {fileIcon(doc.file_type)}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{doc.filename}</p>
              <div className="flex items-center gap-3 mt-0.5">
                {statusBadge(doc.status)}
                <span className="text-xs text-gray-400">{formatSize(doc.size_bytes)}</span>
                {doc.page_count && (
                  <span className="text-xs text-gray-400">{doc.page_count} pages</span>
                )}
                {doc.chunk_count && (
                  <span className="flex items-center gap-0.5 text-xs text-gray-400">
                    <Layers className="w-3 h-3" />
                    {doc.chunk_count} chunks
                  </span>
                )}
              </div>
              {doc.error_message && (
                <p className="text-xs text-red-400 mt-0.5 truncate">{doc.error_message}</p>
              )}
            </div>

            <button
              onClick={(e) => handleDelete(e, doc.id)}
              disabled={deleting === doc.id}
              className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-400 transition-colors shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
