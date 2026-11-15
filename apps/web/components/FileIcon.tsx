'use client';

import React from 'react';
import {
  FileVideo,
  FileAudio,
  FileImage,
  FileArchive,
  FileCode2,
  FileText,
  File as GenericFile,
} from 'lucide-react';

interface FileIconProps {
  fileName: string;
  mimeType?: string;
  className?: string;
  size?: number;
}

export function FileIcon({ fileName, mimeType = '', className = 'w-6 h-6', size }: FileIconProps) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // Video
  if (
    mimeType.startsWith('video/') ||
    ['mp4', 'mkv', 'mov', 'avi', 'wmv', 'webm', 'flv'].includes(ext)
  ) {
    return <FileVideo className={`${className} text-amber-400`} size={size} />;
  }

  // Audio
  if (
    mimeType.startsWith('audio/') ||
    ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)
  ) {
    return <FileAudio className={`${className} text-fuchsia-400`} size={size} />;
  }

  // Image
  if (
    mimeType.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'bmp', 'tiff'].includes(ext)
  ) {
    return <FileImage className={`${className} text-cyan-400`} size={size} />;
  }

  // Archives / ISO
  if (
    mimeType.includes('zip') ||
    mimeType.includes('compressed') ||
    mimeType.includes('tar') ||
    mimeType.includes('iso') ||
    ['zip', 'rar', '7z', 'tar', 'gz', 'iso', 'dmg'].includes(ext)
  ) {
    return <FileArchive className={`${className} text-amber-300`} size={size} />;
  }

  // Code
  if (
    ['js', 'ts', 'tsx', 'jsx', 'json', 'py', 'rs', 'go', 'cpp', 'c', 'html', 'css', 'sh'].includes(
      ext
    )
  ) {
    return <FileCode2 className={`${className} text-indigo-400`} size={size} />;
  }

  // Documents
  if (
    mimeType.includes('pdf') ||
    ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'md', 'csv'].includes(ext)
  ) {
    return <FileText className={`${className} text-emerald-400`} size={size} />;
  }

  return <GenericFile className={`${className} text-slate-300`} size={size} />;
}
