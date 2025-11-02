import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Upload, Search, Heart, Share2, Grid3x3, List, FolderOpen, Filter, X, Tag as TagIcon, BarChart3, Trash2, CheckCircle } from 'lucide-react';
import axios from '../lib/axios';
import { IMAGE_BASE_URL } from '../config';
import UploadModal from '../components/UploadModal';
import ImportModal from '../components/ImportModal';
import ImageDetailModal from '../components/ImageDetailModal';
import FilterPanel from '../components/FilterPanel';
import type { FilterOptions } from '../components/FilterPanel';
import BulkTagModal from '../components/BulkTagModal';

interface Image {
  id: number;
  filename: string;
  filepath: string;
  prompt_text: string | null;
  workflow_json: string | null;
  created_at: string;
  tags: string | null;
  is_favorite: number;
}

interface AvailableTag {
  tag_name: string;
  category: string | null;
  usage_count: number;
}

export default function GalleryPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [images, setImages] = useState<Image[]>([]);
  const [sharedImages, setSharedImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'my-images' | 'shared'>('my-images');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterOptions>({});
  const [selectedImages, setSelectedImages] = useState<number[]>([]);
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [availableTags, setAvailableTags] = useState<AvailableTag[]>([]);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      if (view === 'my-images') {
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (activeFilters.checkpoint) params.append('checkpoint', activeFilters.checkpoint);
        if (activeFilters.sampler) params.append('sampler', activeFilters.sampler);
        if (activeFilters.orientation && activeFilters.orientation !== 'all') params.append('orientation', activeFilters.orientation);
        if (activeFilters.minSteps) params.append('minSteps', activeFilters.minSteps.toString());
        if (activeFilters.maxSteps) params.append('maxSteps', activeFilters.maxSteps.toString());
        if (activeFilters.minCfg) params.append('minCfg', activeFilters.minCfg.toString());
        if (activeFilters.maxCfg) params.append('maxCfg', activeFilters.maxCfg.toString());
        if (activeFilters.dateFrom) params.append('dateFrom', activeFilters.dateFrom);
        if (activeFilters.dateTo) params.append('dateTo', activeFilters.dateTo);
        if (activeFilters.tags && activeFilters.tags.length > 0) {
          params.append('tags', activeFilters.tags.join(','));
        }
        if (activeFilters.noTags) {
          params.append('noTags', 'true');
        }
    
        const response = await axios.get(`/api/images?${params.toString()}`);
        setImages(response.data.images);
      } else {
        const response = await axios.get('/api/images/shared');
        setSharedImages(response.data.images);
      }
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  }, [view, activeFilters, searchQuery]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  useEffect(() => {
    loadAvailableTags();
  }, []);

  async function loadAvailableTags() {
    try {
      const response = await axios.get('/api/images/tags/all');
      setAvailableTags(response.data.tags || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleImageDelete = async () => {
    await loadImages();
    await loadAvailableTags(); // Reload tags in case counts changed
  };

  const removeFilter = (filterKey: keyof FilterOptions) => {
    const newFilters = { ...activeFilters };
    delete newFilters[filterKey];
    setActiveFilters(newFilters);
  };

  const removeTagFilter = (tagToRemove: string) => {
    if (!activeFilters.tags) return;
    const newTags = activeFilters.tags.filter(tag => tag !== tagToRemove);
    if (newTags.length === 0) {
      const newFilters = { ...activeFilters };
      delete newFilters.tags;
      setActiveFilters(newFilters);
    } else {
      setActiveFilters({ ...activeFilters, tags: newTags });
    }
  };

  const toggleQuickTag = (tagName: string) => {
    const currentTags = activeFilters.tags || [];
    const newTags = currentTags.includes(tagName)
      ? currentTags.filter(t => t !== tagName)
      : [...currentTags, tagName];
    
    setActiveFilters({ 
      ...activeFilters, 
      tags: newTags.length > 0 ? newTags : undefined,
      noTags: false // Clear noTags if selecting specific tags
    });
  };

  const toggleNoTagsFilter = () => {
    setActiveFilters({
      ...activeFilters,
      noTags: !activeFilters.noTags,
      tags: !activeFilters.noTags ? undefined : activeFilters.tags // Clear tags if enabling noTags
    });
  };

  const clearAllFilters = () => {
    setActiveFilters({});
  };

  const getActiveFilterCount = () => {
    return Object.keys(activeFilters).filter(k => {
      const value = activeFilters[k as keyof FilterOptions];
      if (k === 'tags' && Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== undefined && value !== '' && value !== 'all';
    }).length;
  };

  const toggleImageSelection = (imageId: number) => {
    setSelectedImages(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  const selectAllImages = () => {
    setSelectedImages(filteredImages.map(img => img.id));
  };

  const clearSelection = () => {
    setSelectedImages([]);
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(
        selectedImages.map(imageId => 
          axios.delete(`/api/images/${imageId}`)
        )
      );
      
      setSelectedImages([]);
      setShowBulkDeleteConfirm(false);
      await loadImages();
      await loadAvailableTags();
    } catch (error) {
      console.error('Error deleting images:', error);
      alert('Failed to delete some images. Please try again.');
    }
  };

  const displayImages = view === 'my-images' ? images : sharedImages;
  const filteredImages = displayImages;

  return (
    <div className="min-h-screen bg-aura-darker">
      {/* Header */}
      <header className="glass border-b border-aura-gray sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎨</span>
                <div>
                  <h1 className="text-2xl font-bold text-aura-text">Aura Gallery</h1>
                  <p className="text-sm text-aura-text-secondary">Welcome, {user?.username}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowImportModal(true)}
                className="btn-secondary flex items-center gap-2"
              >
                <FolderOpen size={18} />
                Import
              </button>
              <button 
                onClick={() => navigate('/tags')}
                className="btn-secondary flex items-center gap-2"
              >
                <TagIcon size={18} />
                Tags
              </button>
              <button 
                onClick={() => navigate('/stats')}
                className="btn-secondary flex items-center gap-2"
              >
                <BarChart3 size={18} />
                Stats
              </button>
              <button 
                onClick={() => setShowUploadModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Upload size={18} />
                Upload
              </button>
              <button onClick={handleLogout} className="btn-secondary flex items-center gap-2">
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setView('my-images')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                view === 'my-images'
                  ? 'bg-aura-blue text-white'
                  : 'bg-aura-gray text-aura-text hover:bg-aura-light-gray'
              }`}
            >
              My Images ({images.length})
            </button>
            <button
              onClick={() => setView('shared')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                view === 'shared'
                  ? 'bg-aura-blue text-white'
                  : 'bg-aura-gray text-aura-text hover:bg-aura-light-gray'
              }`}
            >
              <Share2 size={16} className="inline mr-2" />
              Shared with Me ({sharedImages.length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-aura-text-secondary" size={18} />
              <input
                type="text"
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-10 w-64"
              />
            </div>

           {/* Filter Button */}
            <button
              onClick={() => setShowFilterPanel(true)}
              className={`btn-secondary flex items-center gap-2 ${getActiveFilterCount() > 0 ? 'ring-2 ring-aura-blue' : ''}`}
            >
              <Filter size={18} />
              Filters
              {getActiveFilterCount() > 0 && (
                <span className="bg-aura-blue text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {getActiveFilterCount()}
                </span>
              )}
            </button>

            {/* Select All Filtered Button - Only shows when filters are active */}
            {getActiveFilterCount() > 0 && filteredImages.length > 0 && (
              <button
                onClick={selectAllImages}
                className="btn-secondary flex items-center gap-2"
              >
                <CheckCircle size={18} />
                Select All Filtered ({filteredImages.length})
              </button>
            )}

            {/* View Mode Toggle */}
            <div className="flex gap-1 bg-aura-gray rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-aura-blue text-white' : 'text-aura-text-secondary hover:text-aura-text'}`}
              >
                <Grid3x3 size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-aura-blue text-white' : 'text-aura-text-secondary hover:text-aura-text'}`}
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Tag Filter Bar */}
        {availableTags.length > 0 && (
          <div className="mb-4 pb-4 border-b border-aura-gray">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-aura-gray scrollbar-track-transparent">
              {/* No Tags Option */}
              <button
                onClick={toggleNoTagsFilter}
                className={`flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeFilters.noTags
                    ? 'bg-red-500 bg-opacity-20 text-red-400 border border-red-500 border-opacity-50'
                    : 'bg-aura-gray text-aura-text hover:bg-aura-light-gray border border-transparent'
                }`}
              >
                <X size={14} />
                <span>No Tags</span>
              </button>

              {/* Separator */}
              <div className="w-px h-6 bg-aura-gray flex-shrink-0" />

              {/* Available Tags */}
              {availableTags.map((tag) => (
                <button
                  key={tag.tag_name}
                  onClick={() => toggleQuickTag(tag.tag_name)}
                  className={`flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeFilters.tags?.includes(tag.tag_name)
                      ? 'bg-aura-blue text-white border border-aura-blue'
                      : 'bg-aura-gray text-aura-text hover:bg-aura-light-gray border border-transparent'
                  }`}
                >
                  <span>{tag.tag_name}</span>
                  <span className="text-xs opacity-75">({tag.usage_count})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active Filters Pills */}
        {getActiveFilterCount() > 0 && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-aura-text-secondary">Active filters:</span>
            
            {activeFilters.noTags && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500 bg-opacity-20 text-red-400 rounded-full text-sm border border-red-500 border-opacity-30">
                <span>No Tags</span>
                <button onClick={() => removeFilter('noTags')} className="hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            )}

            {activeFilters.checkpoint && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-sm">
                <span>Checkpoint: {activeFilters.checkpoint}</span>
                <button onClick={() => removeFilter('checkpoint')} className="hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            )}
            
            {activeFilters.sampler && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-sm">
                <span>Sampler: {activeFilters.sampler}</span>
                <button onClick={() => removeFilter('sampler')} className="hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            )}
            
            {activeFilters.orientation && activeFilters.orientation !== 'all' && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-sm">
                <span>Orientation: {activeFilters.orientation}</span>
                <button onClick={() => removeFilter('orientation')} className="hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            )}
            
            {activeFilters.minSteps && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-sm">
                <span>Min Steps: {activeFilters.minSteps}</span>
                <button onClick={() => removeFilter('minSteps')} className="hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            )}
            
            {activeFilters.maxSteps && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-sm">
                <span>Max Steps: {activeFilters.maxSteps}</span>
                <button onClick={() => removeFilter('maxSteps')} className="hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            )}
            
            {activeFilters.minCfg && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-sm">
                <span>Min CFG: {activeFilters.minCfg}</span>
                <button onClick={() => removeFilter('minCfg')} className="hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            )}
            
            {activeFilters.maxCfg && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-sm">
                <span>Max CFG: {activeFilters.maxCfg}</span>
                <button onClick={() => removeFilter('maxCfg')} className="hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            )}
            
            {activeFilters.dateFrom && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-sm">
                <span>From: {activeFilters.dateFrom}</span>
                <button onClick={() => removeFilter('dateFrom')} className="hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            )}
            
            {activeFilters.dateTo && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-sm">
                <span>To: {activeFilters.dateTo}</span>
                <button onClick={() => removeFilter('dateTo')} className="hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            )}
            
            {activeFilters.tags && activeFilters.tags.map(tag => (
              <div key={tag} className="inline-flex items-center gap-2 px-3 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-sm">
                <span>Tag: {tag}</span>
                <button onClick={() => removeTagFilter(tag)} className="hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            ))}
            
            <button
              onClick={clearAllFilters}
              className="px-3 py-1 text-sm text-red-400 hover:text-red-500 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Images Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-aura-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-aura-gray mb-4">
              <Upload size={32} className="text-aura-text-secondary" />
            </div>
            <h3 className="text-xl font-semibold text-aura-text mb-2">No images yet</h3>
            <p className="text-aura-text-secondary mb-6">
              {view === 'my-images' 
                ? 'Upload your first image to get started' 
                : 'No images have been shared with you yet'}
            </p>
            {view === 'my-images' && (
              <button 
                onClick={() => setShowUploadModal(true)}
                className="btn-primary"
              >
                <Upload size={18} className="inline mr-2" />
                Upload Image
              </button>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' 
            : 'space-y-4'
          }>
            {filteredImages.map((image) => (
              <div 
                key={image.id} 
                className="card hover:border-aura-blue transition-all cursor-pointer group relative"
              >
                <div className="aspect-square bg-aura-gray rounded-lg overflow-hidden mb-3 relative">
              {/* Checkbox overlay */}
                <div 
                  className="absolute top-2 left-2 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedImages.includes(image.id)}
                    onChange={() => toggleImageSelection(image.id)}
                    className="w-5 h-5 rounded border-2 border-white bg-aura-dark cursor-pointer"
                  />
                </div>
                  {/* Image - now clickable separately */}
                  <div onClick={() => setSelectedImageId(image.id)} className="w-full h-full">
                    <img
                      src={`${IMAGE_BASE_URL}/${user?.username}/${image.filename}`}
                      alt={image.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </div> 
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-aura-text truncate">{image.filename}</h3>
                  {image.prompt_text && (
                    <p className="text-xs text-aura-text-secondary line-clamp-2">{image.prompt_text}</p>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    {image.is_favorite === 1 && (
                      <Heart size={14} className="text-red-500 fill-red-500" />
                    )}
                    {image.tags && (
                      <div className="flex gap-1 flex-wrap">
                        {image.tags.split(',').slice(0, 2).map((tag, i) => (
                          <button
                            key={i}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleQuickTag(tag.trim());
                            }}
                            className="text-xs bg-aura-blue bg-opacity-20 text-aura-blue px-2 py-1 rounded hover:bg-opacity-30 transition-colors"
                            title={`Filter by ${tag.trim()}`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Bulk Actions Bar */}
      {selectedImages.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
          <div className="glass rounded-lg px-6 py-4 shadow-2xl border border-aura-blue">
            <div className="flex items-center gap-4">
              <span className="text-aura-text font-medium">
                {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={selectAllImages}
                className="text-sm text-aura-blue hover:text-aura-blue-light transition-colors"
              >
                Select All ({filteredImages.length})
              </button>
              <div className="w-px h-6 bg-aura-gray" />
              <button
                onClick={() => setShowBulkTagModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <TagIcon size={16} />
                Tag Selected
              </button>
              <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="btn-secondary hover:bg-red-500 hover:bg-opacity-20 hover:text-red-500 hover:border-red-500 flex items-center gap-2 transition-colors"
            >
              <Trash2 size={16} />
              Delete Selected
            </button>
            <button
              onClick={clearSelection}
              className="btn-secondary"
            >
              Clear Selection
            </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={loadImages}
      />
      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={loadImages}
      />
      {/* Image Detail Modal */}
      <ImageDetailModal
        imageId={selectedImageId}
        isOpen={selectedImageId !== null}
        onClose={() => setSelectedImageId(null)}
        onNavigate={(id: number) => setSelectedImageId(id)}
        onDelete={handleImageDelete}
        allImageIds={filteredImages.map(img => img.id)}
      />
      {/* Filter Panel */}
      <FilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        onApplyFilters={(filters) => setActiveFilters(filters)}
      />
      <BulkTagModal
        isOpen={showBulkTagModal}
        onClose={() => setShowBulkTagModal(false)}
        selectedImageIds={selectedImages}
        onComplete={() => {
          clearSelection();
          loadImages();
          loadAvailableTags();
        }}
      />
      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="glass rounded-lg p-6 max-w-md mx-4 border border-red-500">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-red-500 bg-opacity-20 rounded-full">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-aura-text mb-2">Delete {selectedImages.length} Image{selectedImages.length !== 1 ? 's' : ''}?</h3>
                <p className="text-sm text-aura-text-secondary">
                  This will permanently delete the selected images. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}