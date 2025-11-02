import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import axios from '../lib/axios';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

export default function UploadModal({ isOpen, onClose, onUploadComplete }: UploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('image', file);

      await axios.post('/api/images/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess(true);
      setTimeout(() => {
        onUploadComplete();
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="card max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-aura-text">Upload Image</h2>
          <button
            onClick={onClose}
            className="text-aura-text-secondary hover:text-aura-text transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Upload Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
            dragActive
              ? 'border-aura-blue bg-aura-blue bg-opacity-10'
              : 'border-aura-gray hover:border-aura-light-gray'
          }`}
        >
          {success ? (
            <div className="space-y-4">
              <CheckCircle size={48} className="text-green-500 mx-auto" />
              <p className="text-lg font-medium text-aura-text">Upload successful!</p>
            </div>
          ) : uploading ? (
            <div className="space-y-4">
              <div className="w-12 h-12 border-4 border-aura-blue border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-aura-text">Uploading and processing metadata...</p>
            </div>
          ) : (
            <>
              <Upload size={48} className="text-aura-text-secondary mx-auto mb-4" />
              <p className="text-lg font-medium text-aura-text mb-2">
                Drop your image here
              </p>
              <p className="text-sm text-aura-text-secondary mb-6">
                or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary"
              >
                Select File
              </button>
            </>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 bg-red-500 bg-opacity-10 border border-red-500 text-red-400 px-4 py-3 rounded-lg flex items-start gap-2">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Info */}
        <p className="text-xs text-aura-text-secondary mt-6">
          ComfyUI metadata will be automatically extracted from PNG files
        </p>
      </div>
    </div>
  );
}