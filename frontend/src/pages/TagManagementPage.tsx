import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Tag as TagIcon, Edit2, Trash2, X, Check } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface TagData {
  tag_name: string;
  category: string | null;
  usage_count: number;
}

export default function TagManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');

  useEffect(() => {
    loadTags();
  }, []);

  async function loadTags() {
    setLoading(true);
    try {
      const response = await axios.get('/api/images/tags/all');
      setTags(response.data.tags || []);
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRenameTag(oldName: string) {
    if (!newTagName.trim() || newTagName === oldName) {
      setEditingTag(null);
      return;
    }

    try {
      await axios.put('/api/tags/rename', {
        oldName,
        newName: newTagName.trim()
      });
      
      await loadTags();
      setEditingTag(null);
      setNewTagName('');
    } catch (error) {
      console.error('Error renaming tag:', error);
      alert('Failed to rename tag');
    }
  }

  async function handleDeleteTag(tagName: string) {
    if (!confirm(`Delete tag "${tagName}" from all images? This cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`/api/tags/${encodeURIComponent(tagName)}`);
      await loadTags();
    } catch (error) {
      console.error('Error deleting tag:', error);
      alert('Failed to delete tag');
    }
  }

  return (
    <div className="min-h-screen bg-aura-darker">
      {/* Header */}
      <header className="glass border-b border-aura-gray sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/gallery')}
                className="p-2 rounded-lg hover:bg-aura-gray transition-colors"
              >
                <ArrowLeft size={20} className="text-aura-text-secondary" />
              </button>
              <div className="flex items-center gap-3">
                <TagIcon size={32} className="text-aura-blue" />
                <div>
                  <h1 className="text-2xl font-bold text-aura-text">Tag Management</h1>
                  <p className="text-sm text-aura-text-secondary">
                    {user?.username} • {tags.length} tags
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-aura-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-20">
            <TagIcon size={48} className="text-aura-text-secondary mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-aura-text mb-2">No tags yet</h3>
            <p className="text-aura-text-secondary">
              Start tagging your images to see them here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tags.map((tag) => (
              <div
                key={tag.tag_name}
                className="card flex items-center justify-between"
              >
                <div className="flex items-center gap-4 flex-1">
                  <TagIcon size={20} className="text-aura-blue" />
                  
                  {editingTag === tag.tag_name ? (
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRenameTag(tag.tag_name);
                        } else if (e.key === 'Escape') {
                          setEditingTag(null);
                          setNewTagName('');
                        }
                      }}
                      className="input-field flex-1"
                      autoFocus
                    />
                  ) : (
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-aura-text">
                        {tag.tag_name}
                      </h3>
                      <p className="text-sm text-aura-text-secondary">
                        Used in {tag.usage_count} image{tag.usage_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {editingTag === tag.tag_name ? (
                    <>
                      <button
                        onClick={() => handleRenameTag(tag.tag_name)}
                        className="p-2 rounded-lg bg-green-500 bg-opacity-20 text-green-500 hover:bg-opacity-30 transition-colors"
                        title="Save"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingTag(null);
                          setNewTagName('');
                        }}
                        className="p-2 rounded-lg hover:bg-aura-gray transition-colors"
                        title="Cancel"
                      >
                        <X size={18} className="text-aura-text-secondary" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingTag(tag.tag_name);
                          setNewTagName(tag.tag_name);
                        }}
                        className="p-2 rounded-lg hover:bg-aura-gray transition-colors"
                        title="Rename tag"
                      >
                        <Edit2 size={18} className="text-aura-text-secondary" />
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag.tag_name)}
                        className="p-2 rounded-lg hover:bg-red-500 hover:bg-opacity-20 transition-colors"
                        title="Delete tag"
                      >
                        <Trash2 size={18} className="text-aura-text-secondary hover:text-red-500" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}