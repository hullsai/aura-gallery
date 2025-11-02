import { useState } from 'react';
import { X, Sparkles, Check, AlertCircle } from 'lucide-react';
import axios from '../lib/axios';

interface AITagModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedImageIds: number[];
  onTaggingComplete: () => void;
}

interface TagSuggestion {
  imageId: number;
  filename: string;
  suggestedTags: string[];
  approved: boolean;
}

export default function AITagModal({ isOpen, onClose, selectedImageIds, onTaggingComplete }: AITagModalProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);

  if (!isOpen) return null;

  async function startAnalysis() {
    setAnalyzing(true);
    setError(null);
    setSuggestions([]);

    try {
      const response = await axios.post('/api/ai-tagging/batch-analyze', {
        imageIds: selectedImageIds
      });

      const results = response.data.results.map((r: any) => ({
        imageId: r.imageId,
        filename: r.filename,
        suggestedTags: r.suggestedTags || [],
        approved: autoApprove // Use checkbox setting
      }));

      setSuggestions(results);
      
      // If auto-approve is enabled, apply tags immediately
      if (autoApprove) {
        await applyTagsDirectly(results);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to analyze images');
    } finally {
      setAnalyzing(false);
    }
  }

  async function applyTagsDirectly(results: TagSuggestion[]) {
    setApplying(true);
    try {
      const approvedSuggestions = results
        .filter(s => s.suggestedTags.length > 0)
        .map(s => ({
          imageId: s.imageId,
          tags: s.suggestedTags
        }));

      await axios.post('/api/ai-tagging/batch-apply-tags', {
        tagApplications: approvedSuggestions
      });

      onTaggingComplete();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to apply tags');
    } finally {
      setApplying(false);
    }
  }

  async function applyTags() {
    setApplying(true);
    setError(null);

    try {
      // Only apply tags for approved suggestions
      const approvedSuggestions = suggestions
        .filter(s => s.approved && s.suggestedTags.length > 0)
        .map(s => ({
          imageId: s.imageId,
          tags: s.suggestedTags
        }));

      await axios.post('/api/ai-tagging/batch-apply-tags', {
        tagApplications: approvedSuggestions
      });

      onTaggingComplete();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to apply tags');
    } finally {
      setApplying(false);
    }
  }

  function toggleApproval(index: number) {
    setSuggestions(prev => prev.map((s, i) => 
      i === index ? { ...s, approved: !s.approved } : s
    ));
  }

  function removeTag(suggestionIndex: number, tagIndex: number) {
    setSuggestions(prev => prev.map((s, i) => 
      i === suggestionIndex 
        ? { ...s, suggestedTags: s.suggestedTags.filter((_, ti) => ti !== tagIndex) }
        : s
    ));
  }

  const approvedCount = suggestions.filter(s => s.approved).length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-aura-dark border border-aura-gray rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-aura-gray flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="text-aura-accent" size={24} />
            <div>
              <h2 className="text-xl font-semibold text-aura-text">AI Auto-Tagging</h2>
              <p className="text-sm text-aura-muted">
                {selectedImageIds.length} image{selectedImageIds.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-aura-muted hover:text-aura-text">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {suggestions.length === 0 && !analyzing && (
            <div className="text-center py-12">
              <Sparkles className="mx-auto mb-4 text-aura-accent" size={48} />
              <h3 className="text-lg font-medium text-aura-text mb-2">Ready to Analyze</h3>
              <p className="text-aura-muted mb-6">
                The AI will analyze each image and suggest tags for:
              </p>
              <ul className="text-left max-w-md mx-auto space-y-2 text-aura-muted mb-8">
                <li>• Content rating (Rated: PG / R / X)</li>
                <li>• Clothing type (lingerie, casual, etc.)</li>
                <li>• Setting (bedroom, outdoor, studio, etc.)</li>
                <li>• Pose (standing, sitting, lying down, etc.)</li>
                <li>• Mood (playful, sultry, professional, etc.)</li>
              </ul>
              <p className="text-sm text-aura-muted mb-6">
                {autoApprove 
                  ? 'Tags will be applied automatically after analysis.'
                  : 'You\'ll review all suggestions before they\'re applied.'}
              </p>
              <div className="flex items-center justify-center">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={autoApprove}
                    onChange={(e) => setAutoApprove(e.target.checked)}
                    className="w-4 h-4 rounded border-2 border-aura-gray bg-aura-dark cursor-pointer checked:bg-aura-accent checked:border-aura-accent"
                  />
                  <span className="text-aura-text group-hover:text-aura-accent transition-colors">
                    Auto-approve all tags (skip review)
                  </span>
                </label>
              </div>
            </div>
          )}

          {analyzing && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-aura-accent mb-4"></div>
              <p className="text-aura-text">Analyzing images with AI...</p>
              <p className="text-sm text-aura-muted mt-2">
                {autoApprove 
                  ? 'Tags will be applied automatically when complete'
                  : 'This may take a few minutes'}
              </p>
            </div>
          )}

          {suggestions.length > 0 && !analyzing && !autoApprove && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-aura-muted">
                  Review suggestions • {approvedCount} of {suggestions.length} approved
                </p>
              </div>

              {suggestions.map((suggestion, index) => (
                <div 
                  key={suggestion.imageId}
                  className={`border rounded-lg p-4 ${
                    suggestion.approved 
                      ? 'border-aura-accent bg-aura-accent/5' 
                      : 'border-aura-gray bg-aura-darker'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="text-aura-text font-medium truncate">{suggestion.filename}</p>
                      <p className="text-xs text-aura-muted mt-1">
                        {suggestion.suggestedTags.length} tag{suggestion.suggestedTags.length !== 1 ? 's' : ''} suggested
                      </p>
                    </div>
                    <button
                      onClick={() => toggleApproval(index)}
                      className={`flex items-center gap-2 px-3 py-1 rounded text-sm ${
                        suggestion.approved
                          ? 'bg-aura-accent text-white'
                          : 'bg-aura-gray text-aura-muted hover:bg-aura-gray/70'
                      }`}
                    >
                      <Check size={16} />
                      {suggestion.approved ? 'Approved' : 'Approve'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {suggestion.suggestedTags.map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-aura-gray rounded-full text-sm text-aura-text"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(index, tagIndex)}
                          className="text-aura-muted hover:text-red-400"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-aura-gray flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-aura-muted hover:text-aura-text"
          >
            Cancel
          </button>

          <div className="flex gap-3">
            {suggestions.length === 0 && !analyzing && (
              <button
                onClick={startAnalysis}
                disabled={analyzing}
                className="btn-primary flex items-center gap-2"
              >
                <Sparkles size={18} />
                Start Analysis
              </button>
            )}

            {suggestions.length > 0 && !analyzing && !autoApprove && (
              <button
                onClick={applyTags}
                disabled={applying || approvedCount === 0}
                className="btn-primary flex items-center gap-2"
              >
                {applying ? 'Applying...' : `Apply Tags to ${approvedCount} Image${approvedCount !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}