import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Upload, Search, Heart, Share2, Grid3x3, List, FolderOpen, Filter, X, Tag as TagIcon, BarChart3, Trash2, CheckCircle, Sparkles } from 'lucide-react';
import axios from '../lib/axios';
import { IMAGE_BASE_URL } from '../config';
import UploadModal from '../components/UploadModal';
import ImportModal from '../components/ImportModal';
import ImageDetailModal from '../components/ImageDetailModal';
import FilterPanel from '../components/FilterPanel';
import type { FilterOptions } from '../components/FilterPanel';
import BulkTagModal from '../components/BulkTagModal';
import AITagModal from '../components/AITagModal';

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
  const [showAITagModal, setShowAITagModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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
    await loadAvailableTags();
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
      noTags: false
    });
  };

  const toggleNoTagsFilter = () => {
    setActiveFilters({
      ...activeFilters,
      noTags: !activeFilters.noTags,
      tags: !activeFilters.noTags ? undefined : activeFilters.tags
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
      setDeleteConfirmText('');
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl sm:text-3xl">🎨</span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-aura-text">Aura Gallery</h1>
                <p className="text-xs sm:text-sm text-aura-text-secondary">Welcome, {user?.username}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button 
                onClick={() => setShowImportModal(true)}
                className="btn-secondary flex items-center gap-2 text-sm sm:text-base"
              >
                <FolderOpen size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden sm:inline">Import</span>
              </button>
              <button 
                onClick={() => navigate('/tags')}
                className="btn-secondary flex items-center gap-2 text-sm sm:text-base"
              >
                <TagIcon size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden sm:inline">Tags</span>
              </button>
              <button 
                onClick={() => navigate('/stats')}
                className="btn-secondary flex items-center gap-2 text-sm sm:text-base"
              >
                <BarChart3 size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden sm:inline">Stats</span>
              </button>
              <button 
                onClick={() => setShowUploadModal(true)}
                className="btn-primary flex items-center gap-2 text-sm sm:text-base"
              >
                <Upload size={16} className="sm:w-[18px] sm:h-[18px]" />
                Upload
              </button>
              <button onClick={handleLogout} className="btn-secondary flex items-center gap-2 text-sm sm:text-base">
                <LogOut size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setView('my-images')}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap text-sm sm:text-base ${
                view === 'my-images'
                  ? 'bg-aura-blue text-white'
                  : 'bg-aura-gray text-aura-text hover:bg-aura-light-gray'
              }`}
            >
              My Images ({images.length})
            </button>
            <button
              onClick={() => setView('shared')}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap text-sm sm:text-base ${
                view === 'shared'
                  ? 'bg-aura-blue text-white'
                  : 'bg-aura-gray text-aura-text hover:bg-aura-light-gray'
              }`}
            >
              <Share2 size={14} className="inline mr-2 sm:w-4 sm:h-4" />
              Shared ({sharedImages.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Search */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-aura-text-secondary" size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-9 pr-3 w-full sm:w-64 text-sm sm:text-base h-10 sm:h-auto"
              />
            </div>

            {/* Filter Button */}
            <button
              onClick={() => setShowFilterPanel(true)}
              className={`btn-secondary flex items-center gap-2 text-sm sm:text-base whitespace-nowrap ${getActiveFilterCount() > 0 ? 'ring-2 ring-aura-blue' : ''}`}
            >
              <Filter size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="hidden sm:inline">Filters</span>
              {getActiveFilterCount() > 0 && (
                <span className="bg-aura-blue text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {getActiveFilterCount()}
                </span>
              )}
            </button>

            {/* Select All Filtered Button */}
            {getActiveFilterCount() > 0 && filteredImages.length > 0 && (
              <button
                onClick={selectAllImages}
                className="btn-secondary hidden lg:flex items-center gap-2 text-sm sm:text-base whitespace-nowrap"
              >
                <CheckCircle size={16} className="sm:w-[18px] sm:h-[18px]" />
                Select All ({filteredImages.length})
              </button>
            )}

            {/* View Mode Toggle */}
            <div className="flex gap-1 bg-aura-gray rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-aura-blue text-white' : 'text-aura-text-secondary hover:text-aura-text'}`}
              >
                <Grid3x3 size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-aura-blue text-white' : 'text-aura-text-secondary hover:text-aura-text'}`}
              >
                <List size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Tag Filter Bar */}
        {availableTags.length > 0 && (
          <div className="mb-4 pb-4 border-b border-aura-gray">
            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-aura-gray scrollbar-track-transparent pb-2 sm:pb-0">
              {/* No Tags Option */}
              <button
                onClick={toggleNoTagsFilter}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  activeFilters.noTags
                    ? 'bg-red-500 bg-opacity-20 text-red-400 border border-red-500 border-opacity-50'
                    : 'bg-aura-gray text-aura-text hover:bg-aura-light-gray border border-transparent'
                }`}
              >
                <X size={12} className="sm:w-3.5 sm:h-3.5" />
                <span>No Tags</span>
              </button>

              {/* Separator */}
              <div className="w-px h-5 sm:h-6 bg-aura-gray flex-shrink-0" />

              {/* Available Tags */}
              {availableTags.map((tag) => (
                <button
                  key={tag.tag_name}
                  onClick={() => toggleQuickTag(tag.tag_name)}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
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
            <span className="text-xs sm:text-sm text-aura-text-secondary">Active:</span>
            
            {activeFilters.noTags && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500 bg-opacity-20 text-red-400 rounded-full text-xs sm:text-sm border border-red-500 border-opacity-30">
                <span>No Tags</span>
                <button onClick={() => removeFilter('noTags')} className="hover:text-red-500">
                  <X size={12} />
                </button>
              </div>
            )}

            {activeFilters.checkpoint && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-xs sm:text-sm">
                <span className="truncate max-w-[120px] sm:max-w-none">Checkpoint: {activeFilters.checkpoint}</span>
                <button onClick={() => removeFilter('checkpoint')} className="hover:text-red-400 flex-shrink-0">
                  <X size={12} />
                </button>
              </div>
            )}
            
            {activeFilters.sampler && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-xs sm:text-sm">
                <span>Sampler: {activeFilters.sampler}</span>
                <button onClick={() => removeFilter('sampler')} className="hover:text-red-400">
                  <X size={12} />
                </button>
              </div>
            )}
            
            {activeFilters.orientation && activeFilters.orientation !== 'all' && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-xs sm:text-sm">
                <span>Orientation: {activeFilters.orientation}</span>
                <button onClick={() => removeFilter('orientation')} className="hover:text-red-400">
                  <X size={12} />
                </button>
              </div>
            )}
            
            {activeFilters.minSteps && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-xs sm:text-sm">
                <span>Min Steps: {activeFilters.minSteps}</span>
                <button onClick={() => removeFilter('minSteps')} className="hover:text-red-400">
                  <X size={12} />
                </button>
              </div>
            )}
            
            {activeFilters.maxSteps && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-xs sm:text-sm">
                <span>Max Steps: {activeFilters.maxSteps}</span>
                <button onClick={() => removeFilter('maxSteps')} className="hover:text-red-400">
                  <X size={12} />
                </button>
              </div>
            )}
            
            {activeFilters.minCfg && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-xs sm:text-sm">
                <span>Min CFG: {activeFilters.minCfg}</span>
                <button onClick={() => removeFilter('minCfg')} className="hover:text-red-400">
                  <X size={12} />
                </button>
              </div>
            )}
            
            {activeFilters.maxCfg && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-xs sm:text-sm">
                <span>Max CFG: {activeFilters.maxCfg}</span>
                <button onClick={() => removeFilter('maxCfg')} className="hover:text-red-400">
                  <X size={12} />
                </button>
              </div>
            )}
            
            {activeFilters.dateFrom && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-xs sm:text-sm">
                <span>From: {activeFilters.dateFrom}</span>
                <button onClick={() => removeFilter('dateFrom')} className="hover:text-red-400">
                  <X size={12} />
                </button>
              </div>
            )}
            
            {activeFilters.dateTo && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-xs sm:text-sm">
                <span>To: {activeFilters.dateTo}</span>
                <button onClick={() => removeFilter('dateTo')} className="hover:text-red-400">
                  <X size={12} />
                </button>
              </div>
            )}
            
            {activeFilters.tags && activeFilters.tags.map(tag => (
              <div key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-aura-blue bg-opacity-20 text-aura-blue rounded-full text-xs sm:text-sm">
                <span className="truncate max-w-[100px] sm:max-w-none">Tag: {tag}</span>
                <button onClick={() => removeTagFilter(tag)} className="hover:text-red-400 flex-shrink-0">
                  <X size={12} />
                </button>
              </div>
            ))}
            
            <button
              onClick={clearAllFilters}
              className="px-2.5 py-1 text-xs sm:text-sm text-red-400 hover:text-red-500 transition-colors whitespace-nowrap"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Images Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-aura-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="text-center py-12 sm:py-20 px-4">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-aura-gray mb-4">
              <Upload size={24} className="sm:w-8 sm:h-8 text-aura-text-secondary" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-aura-text mb-2">No images yet</h3>
            <p className="text-sm sm:text-base text-aura-text-secondary mb-6">
              {view === 'my-images' 
                ? 'Upload your first image to get started' 
                : 'No images have been shared with you yet'}
            </p>
            {view === 'my-images' && (
              <button 
                onClick={() => setShowUploadModal(true)}
                className="btn-primary text-sm sm:text-base"
              >
                <Upload size={16} className="inline mr-2 sm:w-[18px] sm:h-[18px]" />
                Upload Image
              </button>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4' 
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
                      className="w-6 h-6 sm:w-5 sm:h-5 rounded border-2 border-white bg-aura-dark cursor-pointer"
                    />
                  </div>
                  {/* Image */}
                  <div onClick={() => setSelectedImageId(image.id)} className="w-full h-full">
                    <img
                      src={`${IMAGE_BASE_URL}/${user?.username}/${image.filename}`}
                      alt={image.filename}
                      loading="lazy"
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
                        {(() => {
                          const allTags = image.tags.split(',').map(t => t.trim());
                          const ratingTag = allTags.find(t => t.toLowerCase().startsWith('rated:'));
                          const otherTags = allTags.filter(t => !t.toLowerCase().startsWith('rated:'));
                          const displayTags = ratingTag 
                            ? [ratingTag, ...otherTags.slice(0, 1)]
                            : otherTags.slice(0, 2);
                          
                          return displayTags.map((tag, i) => (
                            <button
                              key={i}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleQuickTag(tag);
                              }}
                              className={`text-xs px-2 py-1 rounded hover:bg-opacity-30 transition-colors ${
                                tag.toLowerCase().startsWith('rated:')
                                  ? 'bg-purple-500 bg-opacity-20 text-purple-400 font-semibold'
                                  : 'bg-aura-blue bg-opacity-20 text-aura-blue'
                              }`}
                              title={`Filter by ${tag}`}
                            >
                              {tag}
                            </button>
                          ));
                        })()}
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
        <div className="fixed bottom-4 sm:bottom-8 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40">
          <div className="glass rounded-lg px-3 sm:px-6 py-3 sm:py-4 shadow-2xl border border-aura-blue">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
              <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
                <span className="text-aura-text font-medium text-sm sm:text-base">
                  {selectedImages.length} selected
                </span>
                <button
                  onClick={selectAllImages}
                  className="text-xs sm:text-sm text-aura-blue hover:text-aura-blue-light transition-colors whitespace-nowrap"
                >
                  All ({filteredImages.length})
                </button>
              </div>
              <div className="hidden sm:block w-px h-6 bg-aura-gray" />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowBulkTagModal(true)}
                  className="btn-primary flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-initial justify-center"
                >
                  <TagIcon size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Tag</span>
                </button>
                <button 
                  onClick={() => setShowAITagModal(true)}
                  className="btn-primary flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-initial justify-center"
                >
                  <Sparkles size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">AI Tag</span>
                </button>
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="btn-secondary hover:bg-red-500 hover:bg-opacity-20 hover:text-red-500 hover:border-red-500 flex items-center gap-1.5 sm:gap-2 transition-colors text-xs sm:text-sm flex-1 sm:flex-initial justify-center"
                >
                  <Trash2 size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
                <button
                  onClick={clearSelection}
                  className="btn-secondary text-xs sm:text-sm w-full sm:w-auto"
                >
                  Clear
                </button>
              </div>
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
      <AITagModal
        isOpen={showAITagModal}
        onClose={() => setShowAITagModal(false)}
        selectedImageIds={selectedImages}
        onTaggingComplete={loadImages}
      />
      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-lg p-4 sm:p-6 max-w-md w-full mx-4 border border-red-500">
            <div className="flex items-start gap-3 sm:gap-4 mb-4">
              <div className="p-2 sm:p-3 bg-red-500 bg-opacity-20 rounded-full flex-shrink-0">
                <Trash2 size={20} className="sm:w-6 sm:h-6 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-aura-text mb-2">
                  Delete {selectedImages.length} Image{selectedImages.length !== 1 ? 's' : ''}?
                </h3>
                <p className="text-xs sm:text-sm text-aura-text-secondary mb-3">
                  This will permanently delete the selected images. This action cannot be undone.
                </p>

                {/* Tiered Confirmation */}
                {selectedImages.length > 5 && (
                  <div className="mt-4">
                    <label className="block text-sm text-aura-text mb-2 font-medium">
                      {selectedImages.length <= 50 
                        ? `Type ${selectedImages.length} to confirm:`
                        : `Type DELETE ${selectedImages.length} to confirm:`
                      }
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={selectedImages.length <= 50 ? selectedImages.length.toString() : `DELETE ${selectedImages.length}`}
                      className="input-field w-full"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBulkDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="flex-1 btn-secondary text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleBulkDelete();
                  setDeleteConfirmText('');
                }}
                disabled={
                  selectedImages.length > 5 && 
                  (selectedImages.length <= 50 
                    ? deleteConfirmText !== selectedImages.length.toString()
                    : deleteConfirmText !== `DELETE ${selectedImages.length}`
                  )
                }
                className="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors font-medium text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500"
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