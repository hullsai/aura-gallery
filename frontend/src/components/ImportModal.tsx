import { useState } from 'react';
import { X, FolderOpen, CheckCircle, AlertCircle, Loader, Check, Square, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import axios from '../lib/axios';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface FilePreview {
  filename: string;
  filepath: string;
  size: number;
  created: number;
  thumbnail: string | null;
  isDuplicate: boolean;
  selected: boolean;
  error?: string;
}

type ImportStep = 'setup' | 'review' | 'importing' | 'complete';

export default function ImportModal({ isOpen, onClose, onImportComplete }: ImportModalProps) {
  const [sourcePath, setSourcePath] = useState('/Users/hullsai/Projects/webapps/ComfyUI/output');
  const [importMode, setImportMode] = useState<'copy' | 'move' | 'reference'>('move');
  const [cleanupRejected, setCleanupRejected] = useState(false);
  
  const [step, setStep] = useState<ImportStep>('setup');
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, selected: 0, duplicates: 0 });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importResults, setImportResults] = useState<any>(null);

  if (!isOpen) return null;

  async function handleStartReview() {
    setLoading(true);
    setError('');
    setStep('review');
    setPage(1);

    try {
      const response = await axios.post('/api/import/scan-review', { 
        sourcePath, 
        page: 1, 
        pageSize: 50 
      });

      setFiles(response.data.files);
      setTotalPages(response.data.totalPages);
      setStats({
        total: response.data.total,
        selected: response.data.files.filter((f: FilePreview) => f.selected).length,
        duplicates: response.data.duplicates
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to scan directory');
      setStep('setup');
    } finally {
      setLoading(false);
    }
  }

  async function loadPage(newPage: number) {
    setLoading(true);
    try {
      const response = await axios.post('/api/import/scan-review', { 
        sourcePath, 
        page: newPage, 
        pageSize: 50 
      });

      setFiles(response.data.files);
      setPage(newPage);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load page');
    } finally {
      setLoading(false);
    }
  }

  function toggleFile(index: number) {
    const newFiles = [...files];
    newFiles[index].selected = !newFiles[index].selected;
    setFiles(newFiles);
    setStats(prev => ({
      ...prev,
      selected: prev.selected + (newFiles[index].selected ? 1 : -1)
    }));
  }

  function selectAll() {
    const newFiles = files.map(f => ({ ...f, selected: true }));
    setFiles(newFiles);
    setStats(prev => ({ ...prev, selected: prev.selected + newFiles.filter(f => !files.find(old => old.filename === f.filename)?.selected).length }));
  }

  function selectNone() {
    const selectedCount = files.filter(f => f.selected).length;
    const newFiles = files.map(f => ({ ...f, selected: false }));
    setFiles(newFiles);
    setStats(prev => ({ ...prev, selected: prev.selected - selectedCount }));
  }

  function invertSelection() {
    const newFiles = files.map(f => ({ ...f, selected: !f.selected }));
    const newSelectedCount = newFiles.filter(f => f.selected).length;
    const oldSelectedCount = files.filter(f => f.selected).length;
    setFiles(newFiles);
    setStats(prev => ({ ...prev, selected: prev.selected - oldSelectedCount + newSelectedCount }));
  }

  async function handleImport() {
    const selectedFiles = files.filter(f => f.selected);
    
    if (selectedFiles.length === 0) {
      alert('Please select at least one image to import');
      return;
    }

    const rejectedCount = stats.total - stats.selected;
    
    // Confirmation for cleanup
    if (cleanupRejected && rejectedCount > 0 && (importMode === 'copy' || importMode === 'move')) {
      const confirmMsg = rejectedCount <= 10 
        ? `This will delete ${rejectedCount} rejected image${rejectedCount > 1 ? 's' : ''} from the source folder. Continue?`
        : `This will delete ${rejectedCount} rejected images. Please type the number ${rejectedCount} to confirm:`;
      
      if (rejectedCount <= 10) {
        if (!confirm(confirmMsg)) return;
      } else {
        const userInput = prompt(confirmMsg);
        if (userInput !== String(rejectedCount)) {
          alert('Confirmation failed. Import cancelled.');
          return;
        }
      }
    }

    setStep('importing');
    setLoading(true);
    
    try {
      // Strip thumbnails to reduce payload size
      const selectedFilesForImport = selectedFiles.map(({ thumbnail, ...rest }) => rest);
      
      const response = await axios.post('/api/import/import-selected', {
        sourcePath,
        selectedFiles: selectedFilesForImport,
        importMode,
        cleanupRejected
      });

      setImportResults(response.data);
      setStep('complete');
      
      setTimeout(() => {
        onImportComplete();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Import failed');
      setStep('review');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (step === 'complete' || importResults?.imported > 0) {
      onImportComplete();
    }
    // Reset state
    setStep('setup');
    setFiles([]);
    setPage(1);
    setStats({ total: 0, selected: 0, duplicates: 0 });
    setImportResults(null);
    setError('');
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="card max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-aura-text">
              {step === 'setup' && 'Import ComfyUI Images'}
              {step === 'review' && 'Review Images'}
              {step === 'importing' && 'Importing...'}
              {step === 'complete' && 'Import Complete!'}
            </h2>
            {step === 'review' && (
              <p className="text-sm text-aura-text-secondary mt-1">
                {stats.total} images • {stats.selected} selected • {stats.duplicates} duplicates
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-aura-text-secondary hover:text-aura-text transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Step 1: Setup */}
        {step === 'setup' && (
          <div className="space-y-4">
            {/* Source Path Input */}
            <div>
              <label className="block text-sm font-medium text-aura-text mb-2">
                ComfyUI Output Folder
              </label>
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-aura-text-secondary" size={18} />
                <input
                  type="text"
                  value={sourcePath}
                  onChange={(e) => setSourcePath(e.target.value)}
                  className="input-field w-full pl-10"
                  placeholder="/path/to/ComfyUI/output"
                />
              </div>
            </div>

            {/* Import Mode Selection */}
            <div>
              <label className="block text-sm font-medium text-aura-text mb-3">
                Import Mode
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 rounded-lg border border-aura-gray hover:border-aura-blue transition-colors cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'copy'}
                    onChange={() => setImportMode('copy')}
                    className="mt-1 w-4 h-4 text-aura-blue"
                  />
                  <div className="flex-1">
                    <p className="text-aura-text font-medium">Copy files to gallery</p>
                    <p className="text-xs text-aura-text-secondary mt-1">
                      Files are copied. Originals remain in ComfyUI output folder.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg border-2 border-aura-blue bg-aura-blue bg-opacity-10 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'move'}
                    onChange={() => setImportMode('move')}
                    className="mt-1 w-4 h-4 text-aura-blue"
                  />
                  <div className="flex-1">
                    <p className="text-aura-blue font-medium">Move files to gallery (Recommended)</p>
                    <p className="text-xs text-aura-text-secondary mt-1">
                      Files are moved. Originals are deleted after successful import.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-lg border border-aura-gray hover:border-aura-blue transition-colors cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'reference'}
                    onChange={() => setImportMode('reference')}
                    className="mt-1 w-4 h-4 text-aura-blue"
                  />
                  <div className="flex-1">
                    <p className="text-aura-text font-medium">Reference files in place</p>
                    <p className="text-xs text-aura-text-secondary mt-1">
                      No files are copied. Gallery references files in their original location.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {error && (
              <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-400 px-4 py-3 rounded-lg flex items-start gap-2">
                <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleStartReview}
              disabled={loading || !sourcePath}
              className="btn-primary w-full"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin" size={18} />
                  Scanning...
                </>
              ) : (
                <>
                  <FolderOpen size={18} />
                  Scan & Review Images
                </>
              )}
            </button>

            <p className="text-xs text-aura-text-secondary">
              You'll be able to review and select which images to import before proceeding.
            </p>
          </div>
        )}

        {/* Step 2: Review */}
        {step === 'review' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Quick Actions Bar */}
            <div className="flex items-center gap-2 pb-3 border-b border-aura-gray mb-4">
              <button
                onClick={selectAll}
                className="px-3 py-1.5 text-sm bg-aura-gray hover:bg-aura-light-gray text-aura-text rounded-lg transition-colors flex items-center gap-2"
              >
                <CheckCircle size={16} />
                All
              </button>
              <button
                onClick={selectNone}
                className="px-3 py-1.5 text-sm bg-aura-gray hover:bg-aura-light-gray text-aura-text rounded-lg transition-colors flex items-center gap-2"
              >
                <Square size={16} />
                None
              </button>
              <button
                onClick={invertSelection}
                className="px-3 py-1.5 text-sm bg-aura-gray hover:bg-aura-light-gray text-aura-text rounded-lg transition-colors"
              >
                Invert
              </button>
              
              {stats.duplicates > 0 && (
                <div className="ml-auto flex items-center gap-2 text-sm text-amber-400">
                  <AlertCircle size={16} />
                  {stats.duplicates} duplicate{stats.duplicates > 1 ? 's' : ''} auto-deselected
                </div>
              )}
            </div>

            {/* Thumbnail Grid */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader className="animate-spin text-aura-blue" size={32} />
                </div>
              ) : files.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <AlertCircle size={48} className="text-aura-text-secondary mx-auto mb-2" />
                    <p className="text-aura-text-secondary">No images found</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {files.map((file, index) => (
                    <div
                      key={`${file.filename}-${index}`}
                      className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                        file.selected
                          ? 'border-aura-blue ring-2 ring-aura-blue ring-opacity-50'
                          : 'border-aura-gray hover:border-aura-light-gray'
                      } ${file.isDuplicate ? 'opacity-50' : ''}`}
                      onClick={() => toggleFile(index)}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-square bg-aura-gray flex items-center justify-center">
                        {file.thumbnail ? (
                          <img
                            src={file.thumbnail}
                            alt={file.filename}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-aura-text-secondary text-xs px-2 text-center">
                            {file.error || 'No preview'}
                          </div>
                        )}
                      </div>

                      {/* Checkbox Overlay */}
                      <div className="absolute top-2 left-2">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                          file.selected
                            ? 'bg-aura-blue text-white'
                            : 'bg-aura-dark bg-opacity-80 text-aura-text-secondary border border-aura-gray'
                        }`}>
                          {file.selected && <Check size={16} />}
                        </div>
                      </div>

                      {/* Duplicate Badge */}
                      {file.isDuplicate && (
                        <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-md font-medium">
                          Duplicate
                        </div>
                      )}

                      {/* Filename on Hover */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-xs text-white truncate">{file.filename}</p>
                        <p className="text-xs text-gray-300">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4 border-t border-aura-gray mt-4">
                <button
                  onClick={() => loadPage(page - 1)}
                  disabled={page === 1 || loading}
                  className="p-2 hover:bg-aura-gray rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={20} className="text-aura-text-secondary" />
                </button>
                <span className="text-sm text-aura-text-secondary">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => loadPage(page + 1)}
                  disabled={page === totalPages || loading}
                  className="p-2 hover:bg-aura-gray rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={20} className="text-aura-text-secondary" />
                </button>
              </div>
            )}

            {/* Footer - Import Controls */}
            <div className="pt-4 border-t border-aura-gray mt-4">
              {/* Cleanup Option */}
              {(importMode === 'copy' || importMode === 'move') && (
                <label className="flex items-center gap-2 mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cleanupRejected}
                    onChange={(e) => setCleanupRejected(e.target.checked)}
                    className="w-4 h-4 text-aura-blue rounded"
                  />
                  <span className="text-sm text-aura-text flex items-center gap-2">
                    <Trash2 size={16} className="text-red-400" />
                    Delete rejected images ({stats.total - stats.selected} files)
                  </span>
                </label>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-aura-text-secondary">
                  {stats.selected} image{stats.selected !== 1 ? 's' : ''} will be imported
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('setup')}
                    className="btn-secondary"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={stats.selected === 0}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Import Selected
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader className="animate-spin text-aura-blue mx-auto mb-4" size={48} />
              <p className="text-aura-text font-medium">
                {importMode === 'move' ? 'Moving' : importMode === 'copy' ? 'Copying' : 'Importing'} images...
              </p>
              <p className="text-sm text-aura-text-secondary mt-2">
                This may take a moment
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && importResults && (
          <div className="space-y-4">
            <div className="bg-green-500 bg-opacity-10 border border-green-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle size={24} className="text-green-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-400 mb-2">Import Complete!</h3>
                  <div className="space-y-1 text-sm text-green-300">
                    <p>✓ Imported: {importResults.imported} images</p>
                    {importResults.skipped > 0 && <p>○ Skipped: {importResults.skipped} (already imported)</p>}
                    {importResults.deleted > 0 && <p>🗑 Deleted: {importResults.deleted} rejected files</p>}
                    {importResults.errors > 0 && <p className="text-red-400">✗ Errors: {importResults.errors}</p>}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="btn-primary w-full"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}