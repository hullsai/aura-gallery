import { useState, useEffect } from 'react';
import { X, Plus, Tag as TagIcon, Check, Minus } from 'lucide-react';
import axios from '../lib/axios';

interface BulkTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedImageIds: number[];
  onComplete: () => void;
}

interface AvailableTag {
  tag_name: string;
  category: string;
  usage_count: number;
}

interface ImageTag {
  tag_name: string;
  imageCount: number; // How many selected images have this tag
}

export default function BulkTagModal({ isOpen, onClose, selectedImageIds, onComplete }: BulkTagModalProps) {
  const [newTag, setNewTag] = useState('');
  const [availableTags, setAvailableTags] = useState<AvailableTag[]>([]);
  const [existingTags, setExistingTags] = useState<ImageTag[]>([]);
  const [appliedTags, setAppliedTags] = useState<Set<string>>(new Set());
  const [tagSuggestions, setTagSuggestions] = useState<AvailableTag[]>([]);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAvailableTags();
      loadExistingTags();
      setAppliedTags(new Set());
    }
  }, [isOpen, selectedImageIds]);

  async function loadAvailableTags() {
    try {
      const response = await axios.get('/api/images/tags/all');
      setAvailableTags(response.data.tags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }

  async function loadExistingTags() {
    try {
      // Load tags for all selected images
      const tagResponses = await Promise.all(
        selectedImageIds.map(imageId =>
          axios.get(`/api/images/${imageId}`)
        )
      );

      // Count how many images have each tag
      const tagCounts = new Map<string, number>();
      tagResponses.forEach(response => {
        const tags = response.data.image.tags || [];
        tags.forEach((tag: { tag_name: string }) => {
          tagCounts.set(tag.tag_name, (tagCounts.get(tag.tag_name) || 0) + 1);
        });
      });

      // Convert to array
      const existingTagsArray = Array.from(tagCounts.entries()).map(([tag_name, imageCount]) => ({
        tag_name,
        imageCount
      }));

      setExistingTags(existingTagsArray);
    } catch (error) {
      console.error('Error loading existing tags:', error);
    }
  }

  function handleTagInputChange(value: string) {
    setNewTag(value);
    
    if (value.trim()) {
      const filtered = availableTags
        .filter(tag => 
          tag.tag_name.toLowerCase().includes(value.toLowerCase()) &&
          !appliedTags.has(tag.tag_name) &&
          !existingTags.find(t => t.tag_name === tag.tag_name)
        )
        .slice(0, 5);
      setTagSuggestions(filtered);
    } else {
      setTagSuggestions([]);
    }
  }

  async function addNewTag() {
    if (!newTag.trim() || applying) return;

    const tagName = newTag.trim();
    
    // Check if tag already exists in applied or existing
    if (appliedTags.has(tagName) || existingTags.find(t => t.tag_name === tagName)) {
      return;
    }

    setApplying(true);
    try {
      // Apply tag to all selected images
      await Promise.all(
        selectedImageIds.map(imageId =>
          axios.post(`/api/images/${imageId}/tags`, {
            tagName,
            category: null
          })
        )
      );

      // Add to applied tags
      setAppliedTags(prev => new Set([...prev, tagName]));
      setNewTag('');
      setTagSuggestions([]);
    } catch (error) {
      console.error('Error applying tag:', error);
      alert('Failed to apply tag to some images');
    } finally {
      setApplying(false);
    }
  }

  async function quickApplyTag(tagName: string) {
    if (applying) return;

    setApplying(true);
    try {
      // Apply tag to all selected images
      await Promise.all(
        selectedImageIds.map(imageId =>
          axios.post(`/api/images/${imageId}/tags`, {
            tagName,
            category: null
          })
        )
      );

      // Add to applied tags
      setAppliedTags(prev => new Set([...prev, tagName]));
    } catch (error) {
      console.error('Error applying tag:', error);
      alert('Failed to apply tag to some images');
    } finally {
      setApplying(false);
    }
  }

  async function removeExistingTag(tagName: string) {
    if (applying) return;

    setApplying(true);
    try {
      // Remove tag from all selected images
      await Promise.all(
        selectedImageIds.map(imageId =>
          axios.delete(`/api/images/${imageId}/tags/${encodeURIComponent(tagName)}`)
        )
      );

      // Remove from existing tags
      setExistingTags(prev => prev.filter(t => t.tag_name !== tagName));
    } catch (error) {
      console.error('Error removing tag:', error);
      alert('Failed to remove tag from some images');
    } finally {
      setApplying(false);
    }
  }

  async function addExistingTagToAll(tagName: string) {
    if (applying) return;

    setApplying(true);
    try {
      // Add tag to all selected images
      await Promise.all(
        selectedImageIds.map(imageId =>
          axios.post(`/api/images/${imageId}/tags`, {
            tagName,
            category: null
          })
        )
      );

      // Update the count to all images
      setExistingTags(prev => 
        prev.map(t => t.tag_name === tagName ? { ...t, imageCount: selectedImageIds.length } : t)
      );
    } catch (error) {
      console.error('Error adding tag:', error);
      alert('Failed to add tag to some images');
    } finally {
      setApplying(false);
    }
  }

  function handleDone() {
    onComplete();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="card max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TagIcon size={24} className="text-aura-blue" />
            <h2 className="text-xl font-bold text-aura-text">Bulk Tag Images</h2>
          </div>
          <button
            onClick={handleDone}
            className="text-aura-text-secondary hover:text-aura-text transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <p className="text-aura-text-secondary mb-6">
          Managing tags for {selectedImageIds.length} selected image{selectedImageIds.length !== 1 ? 's' : ''}
        </p>

        {/* Add New Tag Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-aura-text mb-2">Add New Tag</label>
          <div className="relative">
            <input
              type="text"
              value={newTag}
              onChange={(e) => handleTagInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addNewTag();
                }
              }}
              placeholder="Type tag name and press Enter..."
              className="input-field w-full"
              autoFocus
              disabled={applying}
            />

            {/* Tag Suggestions */}
            {tagSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-aura-dark border border-aura-gray rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                {tagSuggestions.map((tag, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setNewTag(tag.tag_name);
                      setTagSuggestions([]);
                      // Auto-apply after selection
                      setTimeout(() => addNewTag(), 100);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-aura-text hover:bg-aura-gray transition-colors flex items-center justify-between"
                  >
                    <span>{tag.tag_name}</span>
                    <span className="text-xs text-aura-text-secondary">
                      used {tag.usage_count}x
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Applied Tags (in this session) */}
        {appliedTags.size > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-aura-text mb-2">
              Just Added ({appliedTags.size})
            </label>
            <div className="flex flex-wrap gap-2">
              {Array.from(appliedTags).map(tag => (
                <div
                  key={tag}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500 bg-opacity-20 text-green-400 rounded-lg text-sm border border-green-500 border-opacity-30"
                >
                  <Check size={14} />
                  <span>{tag}</span>
                  <span className="text-xs opacity-75">
                    (all {selectedImageIds.length})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Tags */}
        {existingTags.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-aura-text mb-2">
              Existing Tags ({existingTags.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {existingTags.map(tag => {
                const isPartial = tag.imageCount < selectedImageIds.length;
                const isComplete = tag.imageCount === selectedImageIds.length;

                return (
                  <div
                    key={tag.tag_name}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
                      isComplete
                        ? 'bg-aura-blue bg-opacity-20 text-aura-blue border-aura-blue border-opacity-30'
                        : 'bg-yellow-500 bg-opacity-20 text-yellow-400 border-yellow-500 border-opacity-30'
                    }`}
                  >
                    <span>{tag.tag_name}</span>
                    <span className="text-xs opacity-75">
                      ({tag.imageCount}/{selectedImageIds.length})
                    </span>
                    
                    <div className="flex gap-1 ml-1">
                      {isPartial && (
                        <button
                          onClick={() => addExistingTagToAll(tag.tag_name)}
                          disabled={applying}
                          className="hover:text-green-400 transition-colors"
                          title="Add to all selected images"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => removeExistingTag(tag.tag_name)}
                        disabled={applying}
                        className="hover:text-red-400 transition-colors"
                        title="Remove from all selected images"
                      >
                        <Minus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Available Tags (not yet applied) */}
        {(() => {
          const existingTagNames = new Set(existingTags.map(t => t.tag_name));
          const availableToAdd = availableTags.filter(t => 
            !existingTagNames.has(t.tag_name) && !appliedTags.has(t.tag_name)
          );

          return availableToAdd.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-aura-text mb-2">
                Available Tags ({availableToAdd.length})
              </label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-aura-gray bg-opacity-30 rounded-lg">
                {availableToAdd.map(tag => (
                  <button
                    key={tag.tag_name}
                    onClick={() => quickApplyTag(tag.tag_name)}
                    disabled={applying}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-aura-gray text-aura-text rounded-lg text-sm hover:bg-aura-light-gray transition-colors border border-aura-gray hover:border-aura-blue disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={14} />
                    <span>{tag.tag_name}</span>
                    <span className="text-xs text-aura-text-secondary">
                      ({tag.usage_count})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-aura-gray">
          <button
            onClick={handleDone}
            className="btn-primary flex-1"
            disabled={applying}
          >
            {applying ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Processing...
              </>
            ) : (
              'Done'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}