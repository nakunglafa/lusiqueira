"use client";

import { useState, useRef } from "react";

/** Max image size for logo (e.g. restaurant logo): 500 KB */
export const MAX_IMAGE_BYTES = 500 * 1024;

/** Max image size for menu category/item per API doc: 2 MB */
export const MAX_MENU_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Validates image file size. Returns error message or null.
 * @param {File} file
 * @param {number} [maxBytes] - defaults to MAX_IMAGE_BYTES (500 KB)
 */
export function validateImageSize(file, maxBytes = MAX_IMAGE_BYTES) {
  if (!(file instanceof File)) return null;
  if (file.size > maxBytes) {
    const maxMB = (maxBytes / (1024 * 1024)).toFixed(1);
    return `Image must be ${maxMB} MB or less (selected: ${(file.size / 1024).toFixed(0)} KB).`;
  }
  return null;
}

/**
 * Image upload with drag-and-drop, 500 KB max, and optional file input.
 * @param {string} id - Input id for label
 * @param {string} label - Label text
 * @param {File | undefined} value - Current file (for showing "New image: name")
 * @param {(file: File | undefined) => void} onChange - Called with file or undefined
 * @param {(message: string) => void} onError - Called when file too large or invalid
 * @param {string} [className] - Wrapper class
 * @param {string} [accept] - Accept attribute (default "image/*")
 * @param {string} [dropHint] - Hint text (default "Drop image or click to choose (max 500 KB)")
 * @param {number} [maxBytes] - Max file size in bytes (default MAX_IMAGE_BYTES)
 */
export function ImageUploadDropzone({
  id,
  label,
  value,
  onChange,
  onError,
  className = "",
  accept = "image/*",
  dropHint = "Drop image or click to choose (max 500 KB)",
  maxBytes = MAX_IMAGE_BYTES,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file) {
      onChange(undefined);
      return;
    }
    if (!file.type.startsWith("image/")) {
      onError("Please select an image file (JPEG, PNG, JPG, GIF, or SVG).");
      return;
    }
    const err = validateImageSize(file, maxBytes);
    if (err) {
      onError(err);
      return;
    }
    onChange(file);
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    handleFile(file ?? undefined);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
  };

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          {label}
        </label>
      )}
      <div
        role="button"
        tabIndex={0}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`
          min-h-[80px] rounded-lg border-2 border-dashed px-3 py-4 text-center text-sm cursor-pointer
          transition-colors flex flex-col items-center justify-center gap-1
          ${isDragOver
            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20 dark:border-emerald-400"
            : "border-zinc-300 bg-zinc-50/50 dark:border-zinc-600 dark:bg-zinc-800/50"
          }
        `}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="sr-only"
        />
        <span className="text-zinc-600 dark:text-zinc-400">{dropHint}</span>
        {value instanceof File && (
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{value.name}</span>
        )}
      </div>
    </div>
  );
}
