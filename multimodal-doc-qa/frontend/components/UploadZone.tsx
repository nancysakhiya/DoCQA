"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { uploadDocument } from "@/lib/api";
import { Upload, CheckCircle, XCircle, Loader } from "lucide-react";
import clsx from "clsx";

interface UploadZoneProps {
  onUploadComplete: () => void;
}

interface FileStatus {
  file: File;
  state: "uploading" | "done" | "error";
  error?: string;
}

const ACCEPTED = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};

export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [uploads, setUploads] = useState<FileStatus[]>([]);

  const updateStatus = (fileName: string, update: Partial<FileStatus>) => {
    setUploads((prev) =>
      prev.map((u) => (u.file.name === fileName ? { ...u, ...update } : u))
    );
  };

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const newUploads: FileStatus[] = accepted.map((f) => ({
        file: f,
        state: "uploading",
      }));
      setUploads((prev) => [...newUploads, ...prev]);

      await Promise.all(
        accepted.map(async (file) => {
          try {
            await uploadDocument(file);
            updateStatus(file.name, { state: "done" });
            onUploadComplete();
          } catch (err: any) {
            updateStatus(file.name, { state: "error", error: err.message });
          }
        })
      );
    },
    [onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: 20 * 1024 * 1024,
    multiple: true,
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={clsx(
          "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-brand-500 bg-brand-50"
            : "border-gray-200 hover:border-brand-300 hover:bg-gray-50"
        )}
      >
        <input {...getInputProps()} />
        <Upload
          className={clsx(
            "w-8 h-8 mx-auto mb-3",
            isDragActive ? "text-brand-500" : "text-gray-300"
          )}
        />
        {isDragActive ? (
          <p className="text-brand-600 font-medium">Drop files here…</p>
        ) : (
          <div>
            <p className="text-gray-600 font-medium">
              Drag &amp; drop files, or{" "}
              <span className="text-brand-500 underline">browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF · DOCX · PNG · JPG · WEBP</p>
          </div>
        )}
      </div>

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u) => (
            <div
              key={u.file.name}
              className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-4 py-2 text-sm"
            >
              {u.state === "uploading" && (
                <Loader className="w-4 h-4 text-brand-500 animate-spin shrink-0" />
              )}
              {u.state === "done" && (
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              )}
              {u.state === "error" && (
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span className="flex-1 truncate text-gray-700">{u.file.name}</span>
              {u.state === "uploading" && (
                <span className="text-gray-400 text-xs shrink-0">Uploading…</span>
              )}
              {u.state === "done" && (
                <span className="text-green-600 text-xs shrink-0">Processing…</span>
              )}
              {u.state === "error" && (
                <span className="text-red-400 text-xs shrink-0 max-w-[160px] truncate">
                  {u.error}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
