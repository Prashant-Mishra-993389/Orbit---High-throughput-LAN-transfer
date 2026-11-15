'use client';

import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, FolderPlus, FilePlus2, Sparkles } from 'lucide-react';

interface DropzoneProps {
  onFileSelected: (file: File) => void;
  isSending?: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFileSelected, isSending = false }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        onFileSelected(e.dataTransfer.files[0]);
      }
    },
    [onFileSelected]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelected(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative rounded-3xl border-2 border-dashed transition-all duration-300 p-8 sm:p-12 text-center flex flex-col items-center justify-center cursor-pointer group ${
          isDragOver
            ? 'border-cyan-400 bg-cyan-500/15 scale-[1.01] shadow-2xl shadow-cyan-500/20'
            : 'border-white/15 bg-gradient-to-b from-surface-100/80 to-surface-50/80 hover:border-cyan-500/40 hover:bg-surface-100 shadow-xl'
        }`}
      >
        {/* Animated Glow Icon */}
        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600/30 via-cyan-500/30 to-teal-400/20 border border-white/15 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:shadow-cyan-500/25 transition-all duration-300">
            <UploadCloud
              className={`w-10 h-10 ${
                isDragOver ? 'text-cyan-300 animate-bounce' : 'text-cyan-400 group-hover:text-cyan-300'
              } transition-colors`}
            />
          </div>
          <span className="absolute -top-1 -right-1 p-1 rounded-full bg-cyan-400 text-slate-900 shadow-sm animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Primary Call to Action */}
        <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5 tracking-tight group-hover:text-cyan-200 transition-colors">
          Drop any file to share instantly
        </h3>
        <p className="text-xs sm:text-sm text-slate-400 mb-5 max-w-sm leading-relaxed">
          Generates an instant QR code and link for any phone or laptop. Zero copies made in advance.
        </p>

        {/* Visual Pill Buttons */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-white/10 group-hover:bg-cyan-500/20 text-xs font-semibold text-white border border-white/10 group-hover:border-cyan-500/30 transition-all flex items-center space-x-1.5 shadow-sm"
          >
            <FilePlus2 className="w-4 h-4 text-cyan-400" />
            <span>Browse Files</span>
          </button>
        </div>
      </div>
    </div>
  );
};
