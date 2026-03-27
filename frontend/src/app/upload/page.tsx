"use client";

import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle } from "lucide-react";
import { api, type UploadResponse } from "@/lib/api";

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.uploadFile(file);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Upload Data</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Upload a CSV or Excel file with your sales data
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          dragOver
            ? "border-indigo-400 bg-indigo-50"
            : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      >
        <Upload className="w-10 h-10 mx-auto text-gray-400 mb-4" />
        <p className="text-sm text-gray-600 mb-2">
          Drag and drop your file here, or{" "}
          <label className="text-indigo-600 hover:text-indigo-700 cursor-pointer font-medium">
            browse
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={onFileSelect}
              className="hidden"
            />
          </label>
        </p>
        <p className="text-xs text-gray-400">CSV or Excel files (.csv, .xlsx, .xls)</p>

        {uploading && (
          <div className="mt-4 text-sm text-indigo-600 font-medium">Uploading…</div>
        )}
      </div>

      {/* Required format */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Required format</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="text-xs text-gray-600">
            <thead>
              <tr className="text-gray-400 uppercase tracking-wide">
                <th className="pr-6 py-1 text-left font-medium">Column</th>
                <th className="pr-6 py-1 text-left font-medium">Required</th>
                <th className="py-1 text-left font-medium">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <tr><td className="pr-6 py-1.5 font-medium text-gray-700">date</td><td className="pr-6 py-1.5">Yes</td><td className="py-1.5">2025-01-15</td></tr>
              <tr><td className="pr-6 py-1.5 font-medium text-gray-700">sku</td><td className="pr-6 py-1.5">Yes</td><td className="py-1.5">SKU-A001</td></tr>
              <tr><td className="pr-6 py-1.5 font-medium text-gray-700">quantity_sold</td><td className="pr-6 py-1.5">Yes</td><td className="py-1.5">42</td></tr>
              <tr><td className="pr-6 py-1.5 font-medium text-gray-700">price</td><td className="pr-6 py-1.5">Optional</td><td className="py-1.5">29.99</td></tr>
              <tr><td className="pr-6 py-1.5 font-medium text-gray-700">category</td><td className="pr-6 py-1.5">Optional</td><td className="py-1.5">Electronics</td></tr>
              <tr><td className="pr-6 py-1.5 font-medium text-gray-700">inventory_on_hand</td><td className="pr-6 py-1.5">Optional</td><td className="py-1.5">350</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <p className="text-sm font-semibold text-green-800">{result.message}</p>
          </div>
          <div className="text-xs text-green-700 space-y-1">
            <p><span className="font-medium">{result.rows.toLocaleString()}</span> rows loaded</p>
            <p><span className="font-medium">{result.skus.length}</span> SKUs: {result.skus.join(", ")}</p>
            <p>Date range: {result.date_range.start} to {result.date_range.end}</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
