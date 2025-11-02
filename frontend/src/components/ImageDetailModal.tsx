import { useState, useEffect, useRef } from 'react';
import { X, Heart, Share2, Download, Tag as TagIcon, Settings, Code, ChevronLeft, ChevronRight, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import axios from '../lib/axios';
import { IMAGE_BASE_URL } from '../config';

interface ImageDetailModalProps {
  imageId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (newImageId: number) => void;
  onDelete?: () => void;
  allImageIds?: number[];
}

interface ImageDetail {
  id: number;
  filename: string;
  filepath: string;
  prompt_text: string;
  workflow_json: string;
  node_info: string;
  created_at: string;
  is_favorite: number;
  tags: Array<{ tag_name: string; category: string }>;
  nodeInfo?: {
    checkpoint: string;
    sampler: string;
    steps: number;
    cfg: number;
    seed: number;
    dimensions: { width: number; height: number; batch_size: number };
    scheduler: string;
    denoise: number;
    otherNodes: Array<{ type: string; id: string }>;
  };
}

interface AvailableTag {
  tag_name: string;
  category: string;
  usage_count: number;
}

export default function ImageDetailModal({ imageId, isOpen, onClose, onNavigate, onDelete, allImageIds = [] }: ImageDetailModalProps) {
  const [image, setImage] = useState<ImageDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'prompt' | 'workflow'>('details');
  const [showMetadata, setShowMetadata] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Tag management state
  const [newTag, setNewTag] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [availableTags, setAvailableTags] = useState<AvailableTag[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<AvailableTag[]>([]);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (imageId && isOpen) {
      loadImageDetails();
      loadAvailableTags();
    }
  }, [imageId, isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyPress(e: KeyboardEvent) {
      // Delete confirmation shortcuts
      if (showDeleteConfirm) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleDelete();
        } else if (e.key === 'Escape') {
          setShowDeleteConfirm(false);
        }
        return;
      }

      // Normal navigation
      if (e.key === 'ArrowLeft') {
        navigateToPrevious();
      } else if (e.key === 'ArrowRight') {
        navigateToNext();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!showTagInput) {
          setShowDeleteConfirm(true);
        }
      } else if (e.key === 'Escape') {
        if (showTagInput) {
          setShowTagInput(false);
          setNewTag('');
        } else {
          onClose();
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        setShowMetadata(prev => !prev);
      }
    }

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, imageId, allImageIds, showTagInput, showDeleteConfirm]);

  async function loadImageDetails() {
    setLoading(true);
    try {
      const response = await axios.get(`/api/images/${imageId}`);
      setImage(response.data.image);
    } catch (error) {
      console.error('Error loading image details:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailableTags() {
    try {
      const response = await axios.get('/api/images/tags/all');
      setAvailableTags(response.data.tags);
    } catch (error) {
      console.error('Error loading available tags:', error);
    }
  }

  async function toggleFavorite() {
    try {
      await axios.post(`/api/images/${imageId}/favorite`);
      if (image) {
        setImage({ ...image, is_favorite: image.is_favorite ? 0 : 1 });
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }

  async function addTag(tagName: string) {
    if (!tagName.trim() || !imageId) return;

    try {
      await axios.post(`/api/images/${imageId}/tags`, {
        tagName: tagName.trim(),
        category: null
      });

      // Reload image to get updated tags
      await loadImageDetails();
      await loadAvailableTags();
      
      setNewTag('');
      setShowTagInput(false);
      setTagSuggestions([]);
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  }

  async function removeTag(tagName: string) {
    if (!imageId) return;

    try {
      await axios.delete(`/api/images/${imageId}/tags/${encodeURIComponent(tagName)}`);
      
      // Reload image to get updated tags
      await loadImageDetails();
      await loadAvailableTags();
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  }

  function handleTagInputChange(value: string) {
    setNewTag(value);
    
    if (value.trim()) {
      const filtered = availableTags
        .filter(tag => tag.tag_name.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 5);
      setTagSuggestions(filtered);
    } else {
      setTagSuggestions([]);
    }
  }

  async function handleDelete() {
    if (!imageId) return;
    
    try {
      await axios.delete(`/api/images/${imageId}`);
      setShowDeleteConfirm(false);
      
      // Navigate to next/previous image if available, otherwise just close
      const currentIndex = allImageIds.indexOf(imageId);
      if (allImageIds.length > 1) {
        // Try next image first, then previous
        if (currentIndex < allImageIds.length - 1) {
          onNavigate(allImageIds[currentIndex + 1]);
        } else if (currentIndex > 0) {
          onNavigate(allImageIds[currentIndex - 1]);
        } else {
          onClose();
        }
      } else {
        onClose();
      }
      
      // Refresh gallery after navigation
      if (onDelete) onDelete();
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image. Please try again.');
    }
  }

  function navigateToPrevious() {
    if (!imageId || allImageIds.length === 0) return;
    const currentIndex = allImageIds.indexOf(imageId);
    if (currentIndex > 0) {
      const prevId = allImageIds[currentIndex - 1];
      onNavigate(prevId);
    }
  }

  function navigateToNext() {
    if (!imageId || allImageIds.length === 0) return;
    const currentIndex = allImageIds.indexOf(imageId);
    if (currentIndex < allImageIds.length - 1) {
      const nextId = allImageIds[currentIndex + 1];
      onNavigate(nextId);
    }
  }

  if (!isOpen || !imageId) return null;

  const currentIndex = allImageIds.indexOf(imageId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < allImageIds.length - 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50">
      <div className="w-full h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-aura-gray bg-aura-dark bg-opacity-90">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-aura-text truncate max-w-md">{image?.filename}</h2>
            {allImageIds.length > 0 && (
              <span className="text-sm text-aura-text-secondary">
                {currentIndex + 1} / {allImageIds.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className="p-2 rounded-lg hover:bg-aura-gray transition-colors"
              title={showMetadata ? "Hide metadata (Space)" : "Show metadata (Space)"}
            >
              {showMetadata ? (
                <EyeOff size={20} className="text-aura-text-secondary" />
              ) : (
                <Eye size={20} className="text-aura-text-secondary" />
              )}
            </button>
            <button
              onClick={toggleFavorite}
              className="p-2 rounded-lg hover:bg-aura-gray transition-colors"
            >
              <Heart
                size={20}
                className={image?.is_favorite ? 'text-red-500 fill-red-500' : 'text-aura-text-secondary'}
              />
            </button>
            <button className="p-2 rounded-lg hover:bg-aura-gray transition-colors">
              <Share2 size={20} className="text-aura-text-secondary" />
            </button>
            <button className="p-2 rounded-lg hover:bg-aura-gray transition-colors">
              <Download size={20} className="text-aura-text-secondary" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg hover:bg-red-500 hover:bg-opacity-20 transition-colors"
              title="Delete image"
            >
              <Trash2 size={20} className="text-aura-text-secondary hover:text-red-500" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-aura-gray transition-colors"
            >
              <X size={20} className="text-aura-text-secondary" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-aura-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden relative">
            {/* Navigation Arrows */}
            {hasPrevious && (
              <button
                onClick={navigateToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-aura-dark bg-opacity-75 hover:bg-opacity-100 transition-all"
                title="Previous (←)"
              >
                <ChevronLeft size={32} className="text-aura-text" />
              </button>
            )}
            
            {hasNext && (
              <button
                onClick={navigateToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-aura-dark bg-opacity-75 hover:bg-opacity-100 transition-all"
                title="Next (→)"
              >
                <ChevronRight size={32} className="text-aura-text" />
              </button>
            )}

            {/* Image Preview */}
            <div className={`${showMetadata ? 'w-1/2' : 'w-full'} p-8 flex items-center justify-center bg-aura-darker transition-all duration-300`}>
              <img
                src={`${IMAGE_BASE_URL}/${image?.filepath.split('/').slice(-2).join('/')}`}
                alt={image?.filename}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Metadata Panel */}
            {showMetadata && (
              <div className="w-1/2 flex flex-col border-l border-aura-gray bg-aura-dark transition-all duration-300">
                {/* Tabs */}
                <div className="flex border-b border-aura-gray">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'details'
                        ? 'text-aura-blue border-b-2 border-aura-blue'
                        : 'text-aura-text-secondary hover:text-aura-text'
                    }`}
                  >
                    <Settings size={16} className="inline mr-2" />
                    Details
                  </button>
                  <button
                    onClick={() => setActiveTab('prompt')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'prompt'
                        ? 'text-aura-blue border-b-2 border-aura-blue'
                        : 'text-aura-text-secondary hover:text-aura-text'
                    }`}
                  >
                    <TagIcon size={16} className="inline mr-2" />
                    Prompt
                  </button>
                  <button
                    onClick={() => setActiveTab('workflow')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === 'workflow'
                        ? 'text-aura-blue border-b-2 border-aura-blue'
                        : 'text-aura-text-secondary hover:text-aura-text'
                    }`}
                  >
                    <Code size={16} className="inline mr-2" />
                    Workflow
                  </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {activeTab === 'details' && (
                    <div className="space-y-4">
                      {/* Tags Section */}
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-aura-text-secondary uppercase">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                          {image?.tags && image.tags.length > 0 ? (
                            image.tags.map((tag, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-sm"
                              >
                                {tag.tag_name}
                                <button
                                  onClick={() => removeTag(tag.tag_name)}
                                  className="hover:text-red-400 transition-colors"
                                >
                                  <X size={14} />
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-aura-text-secondary text-sm">No tags yet</span>
                          )}
                          
                          {!showTagInput ? (
                            <button
                              onClick={() => {
                                setShowTagInput(true);
                                setTimeout(() => tagInputRef.current?.focus(), 100);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 border border-dashed border-aura-gray text-aura-text-secondary rounded-full text-sm hover:border-aura-blue hover:text-aura-blue transition-colors"
                            >
                              <Plus size={14} />
                              Add Tag
                            </button>
                          ) : (
                            <div className="relative flex-1 min-w-[200px]">
                              <input
                                ref={tagInputRef}
                                type="text"
                                value={newTag}
                                onChange={(e) => handleTagInputChange(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    addTag(newTag);
                                  } else if (e.key === 'Escape') {
                                    setShowTagInput(false);
                                    setNewTag('');
                                    setTagSuggestions([]);
                                  }
                                }}
                                placeholder="Type tag name..."
                                className="w-full px-3 py-1 bg-aura-gray text-aura-text rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-aura-blue"
                              />
                              
                              {/* Tag Suggestions */}
                              {tagSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-aura-dark border border-aura-gray rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                                  {tagSuggestions.map((tag, i) => (
                                    <button
                                      key={i}
                                      onClick={() => addTag(tag.tag_name)}
                                      className="w-full px-3 py-2 text-left text-sm text-aura-text hover:bg-aura-gray transition-colors"
                                    >
                                      {tag.tag_name}
                                      <span className="text-xs text-aura-text-secondary ml-2">
                                        ({tag.usage_count})
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {image?.nodeInfo && (
                        <>
                          <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-aura-text-secondary uppercase">Generation Settings</h3>
                            <div className="grid grid-cols-2 gap-3">
                              <InfoItem label="Checkpoint" value={image.nodeInfo.checkpoint} />
                              <InfoItem label="Sampler" value={image.nodeInfo.sampler} />
                              <InfoItem label="Steps" value={image.nodeInfo.steps} />
                              <InfoItem label="CFG Scale" value={image.nodeInfo.cfg} />
                              <InfoItem label="Scheduler" value={image.nodeInfo.scheduler} />
                              <InfoItem label="Denoise" value={image.nodeInfo.denoise} />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-aura-text-secondary uppercase">Dimensions</h3>
                            <div className="grid grid-cols-2 gap-3">
                              <InfoItem label="Width" value={image.nodeInfo.dimensions?.width} />
                              <InfoItem label="Height" value={image.nodeInfo.dimensions?.height} />
                              <InfoItem label="Batch Size" value={image.nodeInfo.dimensions?.batch_size} />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-aura-text-secondary uppercase">Seed</h3>
                            <div className="bg-aura-gray rounded-lg p-3">
                              <code className="text-xs text-aura-text break-all">{image.nodeInfo.seed}</code>
                            </div>
                          </div>

                          {image.nodeInfo.otherNodes && image.nodeInfo.otherNodes.length > 0 && (
                            <div className="space-y-2">
                              <h3 className="text-sm font-semibold text-aura-text-secondary uppercase">Other Nodes</h3>
                              <div className="space-y-2">
                                {image.nodeInfo.otherNodes.map((node, i) => (
                                  <div key={i} className="bg-aura-gray rounded-lg px-3 py-2 text-sm text-aura-text">
                                    {node.type}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {activeTab === 'prompt' && (
                    <div className="space-y-4">
                      {image?.prompt_text ? (
                        <div className="bg-aura-gray rounded-lg p-4">
                          <pre className="text-sm text-aura-text whitespace-pre-wrap font-sans">
                            {image.prompt_text}
                          </pre>
                        </div>
                      ) : (
                        <p className="text-aura-text-secondary text-center py-8">No prompt data available</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'workflow' && (
                    <div className="space-y-4">
                      {image?.workflow_json ? (
                        <div className="bg-aura-darker rounded-lg p-4 overflow-x-auto">
                          <pre className="text-xs text-aura-text">
                            {JSON.stringify(JSON.parse(image.workflow_json), null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <p className="text-aura-text-secondary text-center py-8">No workflow data available</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Keyboard Hints */}
        <div className="p-2 bg-aura-dark bg-opacity-90 border-t border-aura-gray">
          <div className="flex items-center justify-center gap-6 text-xs text-aura-text-secondary">
            <span>← → Navigate</span>
            <span>Space Toggle Info</span>
            <span>Delete Key to Delete</span>
            <span>ESC Close</span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60]">
          <div className="bg-aura-dark border border-aura-gray rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-red-500 bg-opacity-20 rounded-full">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-aura-text mb-2">Delete Image?</h3>
                <p className="text-sm text-aura-text-secondary">
                  Are you sure you want to delete <strong>{image?.filename}</strong>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-aura-gray text-aura-text rounded-lg hover:bg-aura-light-gray transition-colors"
              >
                Cancel <span className="text-xs opacity-75">(ESC)</span>
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                autoFocus
              >
                Delete <span className="text-xs opacity-75">(Enter)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-aura-gray rounded-lg p-3">
      <div className="text-xs text-aura-text-secondary mb-1">{label}</div>
      <div className="text-sm font-medium text-aura-text">{value ?? 'N/A'}</div>
    </div>
  );
}