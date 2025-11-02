import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  TrendingUp, 
  Heart, 
  Zap, 
  Calendar,
  Hash,
  Target,
  BarChart3,
  Activity
} from 'lucide-react';
import axios from '../lib/axios';

interface StatsData {
  overview: {
    totalImages: number;
    totalFavorites: number;
    totalTags: number;
    averageGenerationsPerDay: number;
  };
  qualityMetrics: {
    favoriteRateByCheckpoint: Array<{ checkpoint: string; totalImages: number; favorites: number; rate: number }>;
    favoriteRateBySettings: Array<{ setting: string; value: string; favoriteRate: number }>;
  };
  promptAnalysis: {
    commonWords: Array<{ word: string; count: number }>;
    averagePromptLength: number;
    promptLengthDistribution: Array<{ range: string; count: number }>;
  };
  checkpointDeepDive: {
    byCheckpoint: Array<{
      checkpoint: string;
      count: number;
      avgSteps: number;
      avgCfg: number;
      favoriteRate: number;
      commonSamplers: string[];
    }>;
  };
  timeInsights: {
    generationsByMonth: Array<{ month: string; count: number }>;
    generationsByDayOfWeek: Array<{ day: string; count: number }>;
    productivityTrend: Array<{ period: string; count: number }>;
  };
  parameterAnalysis: {
    stepsDistribution: Array<{ range: string; count: number; favoriteRate: number }>;
    cfgDistribution: Array<{ range: string; count: number; favoriteRate: number }>;
    topSamplers: Array<{ sampler: string; count: number; favoriteRate: number }>;
  };
  loraPatterns: {
    topLoras: Array<{ lora: string; count: number }>;
    commonCombinations: Array<{ loras: string[]; count: number }>;
  };
}

export default function StatsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('overview');

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const response = await axios.get('/api/stats/advanced');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-aura-darker flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-aura-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-aura-darker flex items-center justify-center">
        <div className="text-center">
          <p className="text-aura-text-secondary">Failed to load statistics</p>
          <button onClick={() => navigate('/gallery')} className="btn-primary mt-4">
            Back to Gallery
          </button>
        </div>
      </div>
    );
  }

  const sections = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'quality', label: 'Quality Metrics', icon: Heart },
    { id: 'prompts', label: 'Prompt Analysis', icon: Hash },
    { id: 'checkpoints', label: 'Checkpoint Deep Dive', icon: Target },
    { id: 'time', label: 'Time Insights', icon: Calendar },
    { id: 'parameters', label: 'Parameter Analysis', icon: Zap },
    { id: 'loras', label: 'LoRA Patterns', icon: Activity },
  ];

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
                <ArrowLeft size={24} className="text-aura-text" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-aura-text">Advanced Analytics</h1>
                <p className="text-sm text-aura-text-secondary">
                  Deep insights from {stats.overview.totalImages} images
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation Tabs - 2 Row Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                  activeSection === section.id
                    ? 'bg-aura-blue text-white'
                    : 'bg-aura-gray text-aura-text hover:bg-aura-light-gray'
                }`}
              >
                <Icon size={18} />
                <span className="hidden md:inline">{section.label}</span>
                <span className="md:hidden text-sm">{section.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Images"
                value={stats.overview.totalImages.toLocaleString()}
                icon={BarChart3}
                color="blue"
              />
              <StatCard
                label="Favorites"
                value={stats.overview.totalFavorites.toLocaleString()}
                icon={Heart}
                color="red"
              />
              <StatCard
                label="Unique Tags"
                value={stats.overview.totalTags.toLocaleString()}
                icon={Hash}
                color="green"
              />
              <StatCard
                label="Avg/Day"
                value={stats.overview.averageGenerationsPerDay.toFixed(1)}
                icon={TrendingUp}
                color="purple"
              />
            </div>
          </div>
        )}

        {/* Quality Metrics Section */}
        {activeSection === 'quality' && (
          <div className="space-y-6">
            <SectionCard title="Favorite Rate by Checkpoint">
              <div className="space-y-3">
                {stats.qualityMetrics.favoriteRateByCheckpoint.map((item) => (
                  <div key={item.checkpoint} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-aura-text font-medium">{item.checkpoint}</span>
                      <span className="text-aura-text-secondary">
                        {item.favorites}/{item.totalImages} ({(item.rate * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-aura-gray rounded-full h-2">
                      <div
                        className="bg-aura-blue rounded-full h-2 transition-all"
                        style={{ width: `${item.rate * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* Prompt Analysis Section */}
        {activeSection === 'prompts' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SectionCard title="Most Common Words">
                <div className="flex flex-wrap gap-2">
                  {stats.promptAnalysis.commonWords.slice(0, 30).map((word) => (
                    <div
                      key={word.word}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-aura-blue bg-opacity-20 text-aura-blue rounded-lg text-sm"
                    >
                      <span>{word.word}</span>
                      <span className="text-xs opacity-75">({word.count})</span>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Prompt Length Distribution">
                <div className="space-y-3">
                  {stats.promptAnalysis.promptLengthDistribution.map((item) => (
                    <div key={item.range} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-aura-text">{item.range}</span>
                        <span className="text-aura-text-secondary">{item.count} images</span>
                      </div>
                      <div className="w-full bg-aura-gray rounded-full h-2">
                        <div
                          className="bg-green-500 rounded-full h-2"
                          style={{
                            width: `${(item.count / stats.overview.totalImages) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Average Prompt Length">
              <p className="text-3xl font-bold text-aura-text">
                {stats.promptAnalysis.averagePromptLength.toFixed(0)} characters
              </p>
            </SectionCard>
          </div>
        )}

        {/* Checkpoint Deep Dive Section */}
        {activeSection === 'checkpoints' && (
          <div className="space-y-6">
            {stats.checkpointDeepDive.byCheckpoint.map((cp) => (
              <SectionCard key={cp.checkpoint} title={cp.checkpoint}>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm text-aura-text-secondary mb-1">Total Images</p>
                    <p className="text-2xl font-bold text-aura-text">{cp.count}</p>
                  </div>
                  <div>
                    <p className="text-sm text-aura-text-secondary mb-1">Avg Steps</p>
                    <p className="text-2xl font-bold text-aura-text">{cp.avgSteps.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-aura-text-secondary mb-1">Avg CFG</p>
                    <p className="text-2xl font-bold text-aura-text">{cp.avgCfg.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-aura-text-secondary mb-1">Favorite Rate</p>
                    <p className="text-2xl font-bold text-aura-text">
                      {(cp.favoriteRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-aura-text-secondary mb-1">Top Samplers</p>
                    <div className="flex flex-wrap gap-1">
                      {cp.commonSamplers.slice(0, 3).map((sampler) => (
                        <span
                          key={sampler}
                          className="text-xs bg-aura-gray text-aura-text px-2 py-1 rounded"
                        >
                          {sampler}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>
            ))}
          </div>
        )}

        {/* Time Insights Section */}
        {activeSection === 'time' && (
          <div className="space-y-6">
            <SectionCard title="Generations by Month">
              <div className="space-y-3">
                {stats.timeInsights.generationsByMonth.map((item) => (
                  <div key={item.month} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-aura-text">{item.month}</span>
                      <span className="text-aura-text-secondary">{item.count} images</span>
                    </div>
                    <div className="w-full bg-aura-gray rounded-full h-2">
                      <div
                        className="bg-purple-500 rounded-full h-2"
                        style={{
                          width: `${(item.count / Math.max(...stats.timeInsights.generationsByMonth.map((i) => i.count))) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Generations by Day of Week">
              <div className="grid grid-cols-7 gap-2">
                {stats.timeInsights.generationsByDayOfWeek.map((item) => (
                  <div key={item.day} className="text-center">
                    <p className="text-xs text-aura-text-secondary mb-2">{item.day}</p>
                    <div className="bg-aura-gray rounded-lg p-3">
                      <p className="text-lg font-bold text-aura-text">{item.count}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* Parameter Analysis Section */}
        {activeSection === 'parameters' && (
          <div className="space-y-6">
            <SectionCard title="Steps Distribution & Favorite Rate">
              <div className="space-y-3">
                {stats.parameterAnalysis.stepsDistribution.map((item) => (
                  <div key={item.range} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-aura-text">{item.range} steps</span>
                      <span className="text-aura-text-secondary">
                        {item.count} images · {(item.favoriteRate * 100).toFixed(1)}% favorited
                      </span>
                    </div>
                    <div className="w-full bg-aura-gray rounded-full h-2">
                      <div
                        className="bg-aura-blue rounded-full h-2"
                        style={{ width: `${item.favoriteRate * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="CFG Scale Distribution & Favorite Rate">
              <div className="space-y-3">
                {stats.parameterAnalysis.cfgDistribution.map((item) => (
                  <div key={item.range} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-aura-text">CFG {item.range}</span>
                      <span className="text-aura-text-secondary">
                        {item.count} images · {(item.favoriteRate * 100).toFixed(1)}% favorited
                      </span>
                    </div>
                    <div className="w-full bg-aura-gray rounded-full h-2">
                      <div
                        className="bg-green-500 rounded-full h-2"
                        style={{ width: `${item.favoriteRate * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Top Samplers">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.parameterAnalysis.topSamplers.map((item) => (
                  <div key={item.sampler} className="bg-aura-gray rounded-lg p-4">
                    <p className="text-lg font-bold text-aura-text mb-1">{item.sampler}</p>
                    <p className="text-sm text-aura-text-secondary">
                      {item.count} images · {(item.favoriteRate * 100).toFixed(1)}% favorited
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* LoRA Patterns Section */}
        {activeSection === 'loras' && (
          <div className="space-y-6">
            <SectionCard title="Most Used LoRAs">
              <div className="flex flex-wrap gap-2">
                {stats.loraPatterns.topLoras.map((lora) => (
                  <div
                    key={lora.lora}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-aura-blue bg-opacity-20 text-aura-blue rounded-lg"
                  >
                    <span className="font-medium">{lora.lora}</span>
                    <span className="text-sm opacity-75">({lora.count})</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Common LoRA Combinations">
              <div className="space-y-3">
                {stats.loraPatterns.commonCombinations.map((combo, index) => (
                  <div key={index} className="bg-aura-gray rounded-lg p-4">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {combo.loras.map((lora) => (
                        <span
                          key={lora}
                          className="text-sm bg-aura-blue bg-opacity-20 text-aura-blue px-2 py-1 rounded"
                        >
                          {lora}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-aura-text-secondary">Used together {combo.count} times</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: any;
  color: string;
}) {
  const colorClasses = {
    blue: 'bg-aura-blue bg-opacity-20 text-aura-blue',
    red: 'bg-red-500 bg-opacity-20 text-red-400',
    green: 'bg-green-500 bg-opacity-20 text-green-400',
    purple: 'bg-purple-500 bg-opacity-20 text-purple-400',
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-aura-text-secondary">{label}</p>
        <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="text-3xl font-bold text-aura-text">{value}</p>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="text-lg font-bold text-aura-text mb-4">{title}</h3>
      {children}
    </div>
  );
}