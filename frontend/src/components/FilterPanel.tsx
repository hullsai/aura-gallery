import { useState, useEffect } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import axios from '../lib/axios';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FilterOptions) => void;
}

export interface FilterOptions {
  checkpoint?: string;
  sampler?: string;
  orientation?: 'portrait' | 'landscape' | 'square' | 'all';
  minSteps?: number;
  maxSteps?: number;
  minCfg?: number;
  maxCfg?: number;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[]; // Array of tag names
  noTags?: boolean; // Filter for images with NO tags
}

interface AvailableTag {
  tag_name: string;
  category: string | null;
  usage_count: number;
}

export default function FilterPanel({ isOpen, onClose, onApplyFilters }: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    orientation: 'all',
    tags: [],
    noTags: false
  });
  const [availableCheckpoints, setAvailableCheckpoints] = useState<string[]>([]);
  const [availableSamplers, setAvailableSamplers] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<AvailableTag[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    tags: true,
    model: false,
    generation: false,
    dimensions: false,
    date: false
  });

  useEffect(() => {
    if (isOpen) {
      loadFilterOptions();
      loadAvailableTags();
    }
  }, [isOpen]);

  async function loadFilterOptions() {
    try {
      const response = await axios.get('/api/images/filter-options');
      setAvailableCheckpoints(response.data.checkpoints || []);
      setAvailableSamplers(response.data.samplers || []);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  }

  async function loadAvailableTags() {
    try {
      const response = await axios.get('/api/images/tags/all');
      setAvailableTags(response.data.tags || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }

  function toggleTag(tagName: string) {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tagName)
      ? currentTags.filter(t => t !== tagName)
      : [...currentTags, tagName];
    
    // If selecting a specific tag, disable "No Tags" filter
    setFilters({ ...filters, tags: newTags, noTags: newTags.length > 0 ? false : filters.noTags });
  }

  function toggleNoTags() {
    // If enabling "No Tags", clear selected tags
    setFilters({ 
      ...filters, 
      noTags: !filters.noTags,
      tags: !filters.noTags ? [] : filters.tags 
    });
  }

  function handleApply() {
    onApplyFilters(filters);
    onClose();
  }

  function handleReset() {
    const resetFilters: FilterOptions = { orientation: 'all', tags: [], noTags: false };
    setFilters(resetFilters);
    onApplyFilters(resetFilters);
  }

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Filter size={24} className="text-aura-blue" />
            <h2 className="text-2xl font-bold text-aura-text">Advanced Filters</h2>
          </div>
          <button
            onClick={onClose}
            className="text-aura-text-secondary hover:text-aura-text transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Tags */}
          <FilterSection
            title={`Tags ${filters.tags && filters.tags.length > 0 ? `(${filters.tags.length} selected)` : filters.noTags ? '(No Tags)' : ''}`}
            expanded={expandedSections.tags}
            onToggle={() => toggleSection('tags')}
          >
            {/* No Tags Option */}
            <div className="mb-4 pb-4 border-b border-aura-gray">
              <button
                onClick={toggleNoTags}
                className={`w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  filters.noTags
                    ? 'bg-red-500 bg-opacity-20 text-red-400 border border-red-500 border-opacity-30'
                    : 'bg-aura-gray text-aura-text hover:bg-aura-light-gray'
                }`}
              >
                <X size={16} />
                <span>Images with No Tags</span>
              </button>
              <p className="text-xs text-aura-text-secondary mt-2">
                {filters.noTags 
                  ? 'Showing only images without any tags' 
                  : 'Click to filter images that have no tags'}
              </p>
            </div>

            {/* Available Tags */}
            {availableTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag.tag_name}
                    onClick={() => toggleTag(tag.tag_name)}
                    disabled={filters.noTags}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      filters.tags?.includes(tag.tag_name)
                        ? 'bg-aura-blue text-white'
                        : filters.noTags
                        ? 'bg-aura-gray text-aura-text-secondary opacity-50 cursor-not-allowed'
                        : 'bg-aura-gray text-aura-text hover:bg-aura-light-gray'
                    }`}
                  >
                    {tag.tag_name}
                    <span className="text-xs opacity-75">({tag.usage_count})</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-aura-text-secondary text-sm">No tags available</p>
            )}
          </FilterSection>

          {/* Model Settings */}
          <FilterSection
            title="Model Settings"
            expanded={expandedSections.model}
            onToggle={() => toggleSection('model')}
          >
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-aura-text mb-2">
                  Checkpoint
                </label>
                <select
                  value={filters.checkpoint || ''}
                  onChange={(e) => setFilters({ ...filters, checkpoint: e.target.value || undefined })}
                  className="input-field w-full"
                >
                  <option value="">All Checkpoints</option>
                  {availableCheckpoints.map((cp) => (
                    <option key={cp} value={cp}>{cp}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-aura-text mb-2">
                  Sampler
                </label>
                <select
                  value={filters.sampler || ''}
                  onChange={(e) => setFilters({ ...filters, sampler: e.target.value || undefined })}
                  className="input-field w-full"
                >
                  <option value="">All Samplers</option>
                  {availableSamplers.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </FilterSection>

          {/* Generation Settings */}
          <FilterSection
            title="Generation Settings"
            expanded={expandedSections.generation}
            onToggle={() => toggleSection('generation')}
          >
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-aura-text mb-2">
                  Steps Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minSteps || ''}
                    onChange={(e) => setFilters({ ...filters, minSteps: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="input-field"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxSteps || ''}
                    onChange={(e) => setFilters({ ...filters, maxSteps: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-aura-text mb-2">
                  CFG Scale Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Min"
                    value={filters.minCfg || ''}
                    onChange={(e) => setFilters({ ...filters, minCfg: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="input-field"
                  />
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Max"
                    value={filters.maxCfg || ''}
                    onChange={(e) => setFilters({ ...filters, maxCfg: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="input-field"
                  />
                </div>
              </div>
            </div>
          </FilterSection>

          {/* Dimensions */}
          <FilterSection
            title="Dimensions"
            expanded={expandedSections.dimensions}
            onToggle={() => toggleSection('dimensions')}
          >
            <div>
              <label className="block text-sm font-medium text-aura-text mb-2">
                Orientation
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['all', 'portrait', 'landscape', 'square'] as const).map((orientation) => (
                  <button
                    key={orientation}
                    onClick={() => setFilters({ ...filters, orientation })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      filters.orientation === orientation
                        ? 'bg-aura-blue text-white'
                        : 'bg-aura-gray text-aura-text hover:bg-aura-light-gray'
                    }`}
                  >
                    {orientation.charAt(0).toUpperCase() + orientation.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </FilterSection>

          {/* Date Range */}
          <FilterSection
            title="Date Range"
            expanded={expandedSections.date}
            onToggle={() => toggleSection('date')}
          >
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-aura-text mb-2">
                  From
                </label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-aura-text mb-2">
                  To
                </label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
                  className="input-field w-full"
                />
              </div>
            </div>
          </FilterSection>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6 pt-6 border-t border-aura-gray">
          <button onClick={handleReset} className="btn-secondary flex-1">
            Reset Filters
          </button>
          <button onClick={handleApply} className="btn-primary flex-1">
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterSection({ 
  title, 
  expanded, 
  onToggle, 
  children 
}: { 
  title: string; 
  expanded: boolean; 
  onToggle: () => void; 
  children: React.ReactNode;
}) {
  return (
    <div className="border border-aura-gray rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-aura-gray hover:bg-aura-light-gray transition-colors"
      >
        <span className="font-medium text-aura-text">{title}</span>
        {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {expanded && <div className="p-4 bg-aura-dark">{children}</div>}
    </div>
  );
}