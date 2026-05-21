"use client";

import { useState } from "react";
import { CitedSource } from "@/lib/api";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";

interface SourceCitationProps {
  source: CitedSource;
}

export default function SourceCitation({ source }: SourceCitationProps) {
  const [expanded, setExpanded] = useState(false);

  // Confidence bar width based on similarity score (0–1)
  const confidence = Math.round(source.similarity_score * 100);
  const barColor =
    confidence >= 80 ? "bg-green-400" :
    confidence >= 60 ? "bg-amber-400" :
    "bg-red-300";

  return (
    <button
      onClick={() => setExpanded((v) => !v)}
      className="w-full text-left border border-gray-200 rounded-xl p-3 hover:border-brand-200 hover:bg-brand-50 transition-colors citation-chip"
    >
      <div className="flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />

        <span className="text-xs font-medium text-gray-700 flex-1 truncate">
          {source.filename}
        </span>

        <span className="text-xs text-gray-400 shrink-0">p.{source.page_num}</span>

        {/* Confidence bar */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${confidence}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 w-8">{confidence}%</span>
        </div>

        {expanded ? (
          <ChevronUp className="w-3 h-3 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
        )}
      </div>

      {/* Expanded chunk text */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-6">
            {source.chunk_text}
          </p>
        </div>
      )}
    </button>
  );
}
