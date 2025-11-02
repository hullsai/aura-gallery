import { useState } from 'react';
import { X, FolderOpen, Upload, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import axios from '../lib/axios';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ImportModal({ isOpen, onClose, onImportComplete }: ImportModalProps) {
  const [sourcePath, setSourcePath] = useState('/Users/hullsai/Projects/webapps/ComfyUI/output');
  const [importMode, setImportMode] = useState<'copy' | 'move' | 'reference'>('move');
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [scanResults, setScanResults] = useState<any>(null);
  const [importResults, setImportResults] = useState<any>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleScan() {
    setScanning(true);
    setError('');
    setScanResults(null);

    try {
      const response = await axios.post('/api/import/scan', { sourcePath });
      setScanResults(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    setError('');
    setImportResults(null);

    try {
      const response = await axios.post('/api/import/import', { 
        sourcePath, 
        copyFiles: importMode === 'copy',
        moveFiles: importMode === 'move'
      });
      setImportResults(response.data);
      
      if (response.data.imported > 0) {
        setTimeout(() => {
          onImportComplete();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    if (importResults?.imported > 0) {
      onImportComplete();
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-aura-text">Import ComfyUI Images</h2>
          <button
            onClick={handleClose}
            className="text-aura-text-secondary hover:text-aura-text transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Source Path Input */}
        <div className="space-y-4 mb-6">
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
                  className="mt-1 w-4 h-4 text-aura-blue focus:ring-2 focus:ring-aura-blue"
                />
                <div className="flex-1">
                  <p className="text-aura-text font-medium">Copy files to gallery</p>
                  <p className="text-xs text-aura-text-secondary mt-1">
                    Files are copied to your gallery. Original files remain in ComfyUI output folder.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border-2 border-aura-blue bg-aura-blue bg-opacity-10 hover:border-aura-blue transition-colors cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'move'}
                  onChange={() => setImportMode('move')}
                  className="mt-1 w-4 h-4 text-aura-blue focus:ring-2 focus:ring-aura-blue"
                />
                <div className="flex-1">
                  <p className="text-aura-blue font-medium">Move files to gallery (Recommended)</p>
                  <p className="text-xs text-aura-text-secondary mt-1">
                    Files are moved to your gallery. Original files are deleted from ComfyUI output folder after successful import.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-aura-gray hover:border-aura-blue transition-colors cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'reference'}
                  onChange={() => setImportMode('reference')}
                  className="mt-1 w-4 h-4 text-aura-blue focus:ring-2 focus:ring-aura-blue"
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
        </div>

        {/* Scan Button */}
        {!scanResults && !importResults && (
          <button
            onClick={handleScan}
            disabled={scanning || !sourcePath}
            className="btn-primary w-full mb-4"
          >
            {scanning ? (
              <>
                <Loader className="animate-spin" size={18} />
                Scanning...
              </>
            ) : (
              <>
                <FolderOpen size={18} />
                Scan Folder
              </>
            )}
          </button>
        )}

        {/* Scan Results */}
        {scanResults && !importResults && (
          <div className="space-y-4">
            <div className="bg-aura-gray rounded-lg p-4">
              <h3 className="font-semibold text-aura-text mb-2">Scan Results</h3>
              <div className="space-y-2 text-sm">
                <p className="text-aura-text-secondary">
                  Found <span className="text-aura-text font-semibold">{scanResults.total}</span> images
                </p>
                <p className="text-aura-text-secondary">
                  Already imported: <span className="text-aura-text font-semibold">{scanResults.existing}</span>
                </p>
                <p className="text-aura-text-secondary">
                  New images to import: <span className="text-aura-blue font-semibold">{scanResults.total}</span>
                </p>
              </div>
            </div>

            {importMode === 'move' && (
              <div className="bg-yellow-500 bg-opacity-10 border border-yellow-500 text-yellow-400 px-4 py-3 rounded-lg flex items-start gap-2">
                <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  <strong>Move mode:</strong> Original files will be deleted from ComfyUI output folder after successful import.
                </p>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={importing || scanResults.total === 0}
              className="btn-primary w-full"
            >
              {importing ? (
                <>
                  <Loader className="animate-spin" size={18} />
                  {importMode === 'move' ? 'Moving' : importMode === 'copy' ? 'Copying' : 'Importing'} {importResults ? `${importResults.imported}/${scanResults.total}` : '...'}
                </>
              ) : (
                <>
                  <Upload size={18} />
                  {importMode === 'move' ? 'Move' : importMode === 'copy' ? 'Copy' : 'Import'} {scanResults.total} Images
                </>
              )}
            </button>
          </div>
        )}

        {/* Import Results */}
        {importResults && (
          <div className="space-y-4">
            <div className="bg-green-500 bg-opacity-10 border border-green-500 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle size={24} className="text-green-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-400 mb-2">Import Complete!</h3>
                  <div className="space-y-1 text-sm text-green-300">
                    <p>✓ Imported: {importResults.imported} images</p>
                    {importResults.skipped > 0 && <p>○ Skipped: {importResults.skipped} (already imported)</p>}
                    {importResults.errors > 0 && <p className="text-red-400">✗ Errors: {importResults.errors}</p>}
                    {importMode === 'move' && importResults.imported > 0 && (
                      <p className="text-yellow-400 mt-2">⚠ Original files have been deleted from ComfyUI output folder</p>
                    )}
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

        {/* Error Message */}
        {error && (
          <div className="mt-4 bg-red-500 bg-opacity-10 border border-red-500 text-red-400 px-4 py-3 rounded-lg flex items-start gap-2">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Info */}
        <p className="text-xs text-aura-text-secondary mt-6">
          This will scan your ComfyUI output folder and import all PNG/JPG images with their metadata.
        </p>
      </div>
    </div>
  );
}