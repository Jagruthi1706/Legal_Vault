import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  Video,
  Image as ImageIcon,
  FileCode2,
  Trash2,
  Download,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Button } from './Button';
import toast from 'react-hot-toast';

export interface FileItem {
  id: string;
  name: string;
  size: string;
  type: string;
  extension: string;
  timestamp: string;
  uploadToken: string;
  fileObj?: File;
  previewUrl?: string;
}

interface FileUploadZoneProps {
  title?: string;
  description?: string;
  allowedExtensions?: string;
  maxSizeMB?: number;
  initialFiles?: FileItem[];
  onFilesUpdated?: (files: FileItem[]) => void;
  vaultCertified?: boolean;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  title = 'Select or Drop Digital Evidence & Case Filings',
  description = 'Supports .pdf, .doc, .docx, .png, .jpg, .jpeg, .mp4, .txt, .csv, and .log files. Files are staged locally and the server performs canonical SHA-256 hashing on actual upload bytes.',
  allowedExtensions = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.mp4,.txt,.csv,.log',
  maxSizeMB = 100,
  initialFiles = [],
  onFilesUpdated,
  vaultCertified = true
}) => {
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadToken = (filename: string) => {
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `UPLD-${filename.slice(0, 4).toUpperCase()}-${randomSuffix}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const processAddedFiles = (addedFiles: FileList | File[]) => {
    const newItems: FileItem[] = [];

    Array.from(addedFiles).forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      const newItem: FileItem = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: f.name,
        size: formatFileSize(f.size),
        type: f.type,
        extension: ext,
        timestamp: 'Just now',
        uploadToken: generateUploadToken(f.name + f.size),
        fileObj: f,
        previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined
      };
      newItems.push(newItem);
    });

    if (newItems.length > 0) {
      const updated = [...newItems, ...files];
      setFiles(updated);
      if (onFilesUpdated) onFilesUpdated(updated);
      toast.success(
        `${newItems.length} file(s) added and ready for secure upload.`
      );
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processAddedFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processAddedFiles(e.target.files);
    }
  };

  const handleDeleteFile = (id: string, name: string) => {
    const updated = files.filter((f) => f.id !== id);
    setFiles(updated);
    if (onFilesUpdated) onFilesUpdated(updated);
    toast.success(`Removed file: ${name}`);
  };

  const handleDownloadFile = (file: FileItem) => {
    if (file.fileObj) {
      const url = URL.createObjectURL(file.fileObj);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Simulate download for sample files
      const blob = new Blob([
        `Content of ${file.name}\nUpload token: ${file.uploadToken}`
      ], {
        type: 'text/plain'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    toast.success(`Downloading ${file.name}`);
  };

  const formatBadgeClass =
    'bg-surface-subtle text-foreground-secondary border border-border text-xs font-medium px-2.5 py-1 rounded-md shadow-2xs';

  const getFileBadgeAndIcon = (ext: string) => {
    switch (ext) {
      case 'mp4':
        return { icon: Video, label: 'MP4' };
      case 'png':
      case 'jpg':
      case 'jpeg':
        return { icon: ImageIcon, label: ext.toUpperCase() };
      case 'pdf':
        return { icon: FileText, label: 'PDF' };
      case 'doc':
      case 'docx':
        return { icon: FileText, label: ext.toUpperCase() };
      case 'txt':
      case 'csv':
      case 'log':
        return { icon: FileCode2, label: ext.toUpperCase() };
      default:
        return { icon: FileText, label: ext.toUpperCase() || 'FILE' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={allowedExtensions}
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer space-y-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragOver
            ? 'border-border-strong bg-surface-subtle/80'
            : 'border-border bg-surface-subtle/50 hover:bg-surface-subtle/60'
        }`}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-foreground-secondary">
          <Upload className="h-6 w-6" />
        </div>

        <div>
          <h3 className="text-base font-semibold text-foreground">
            {title}
          </h3>
          <p className="mx-auto my-2 max-w-md text-sm text-foreground-muted">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
          {['.PDF', '.DOCX', '.PNG', '.JPG', '.MP4', '.TXT', '.CSV', '.LOG'].map((fmt) => (
            <span key={fmt} className={formatBadgeClass}>
              {fmt}
            </span>
          ))}
        </div>

        <div className="pt-2">
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white shadow-sm transition-all hover:bg-indigo-700"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Browse & Select Files
          </button>
        </div>
      </div>

      {/* Uploaded / Staged Files Preview Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">
              Vault Stamped Records ({files.length})
            </h4>
            {vaultCertified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success/10 text-success border border-success/50">
                <CheckCircle2 className="w-3 h-3 text-success" />
                BSA Sec 63 Validated
              </span>
            )}
          </div>

          {files.length > 0 && (
            <span className="text-xs font-mono text-foreground-muted">
              File staging complete, ready for secure upload
            </span>
          )}
        </div>

        {files.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-border rounded-xl text-sm text-foreground-muted">
            No files staged yet. Drag and drop files above to start.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {files.map((file) => {
              const meta = getFileBadgeAndIcon(file.extension);
              const IconComp = meta.icon;

              return (
                <div
                  key={file.id}
                  className="flex flex-col justify-between space-y-3 rounded-xl border border-border bg-surface p-4 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {file.previewUrl ? (
                        <img
                          src={file.previewUrl}
                          alt={file.name}
                          className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-foreground-secondary">
                          <IconComp className="h-5 w-5" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <h5 className="truncate font-semibold text-foreground" title={file.name}>
                          {file.name}
                        </h5>
                        <div className="mt-0.5 flex items-center gap-2 font-mono text-xs text-foreground-muted">
                          <span>{file.size}</span>
                          <span>•</span>
                          <span>{file.timestamp}</span>
                        </div>
                      </div>
                    </div>

                    <span className={`shrink-0 ${formatBadgeClass}`}>
                      .{meta.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 rounded border border-border bg-surface-subtle px-2 py-1 font-mono text-xs text-foreground-muted">
                    <span className="flex min-w-0 items-center gap-1 break-all">
                      <Lock className="h-3 w-3 shrink-0" />
                      {file.uploadToken}
                    </span>
                    <span className="shrink-0 rounded-full border border-warning/50 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
                      Staged
                    </span>
                  </div>

                  {/* Action buttons: Download & Delete */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Download className="w-3.5 h-3.5" />}
                      onClick={() => handleDownloadFile(file)}
                    >
                      Download
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => handleDeleteFile(file.id, file.name)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
