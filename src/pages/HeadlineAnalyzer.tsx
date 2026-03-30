import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ToolLayout from '../components/ToolLayout';
import ProUpsellBanner from '../components/ProUpsellBanner';

interface AnalysisResult {
  score: number;
  wordCount: number;
  characterCount: number;
  powerWords: string[];
  emotionalWords: string[];
  uncommonWords: string[];
  headlineType: string;
  sentiment: string;
  tips: string[];
}

const POWER_WORDS = [
  'amazing', 'proven', 'secret', 'ultimate', 'essential', 'incredible', 'guaranteed',
  'powerful', 'free', 'new', 'best', 'easy', 'instant', 'exclusive', 'limited',
  'shocking', 'surprising', 'revolutionary', 'breakthrough', 'discover', 'unleash',
  'master', 'boost', 'skyrocket', 'transform', 'hack', 'critical', 'urgent',
];

const EMOTIONAL_WORDS = [
  'love', 'hate', 'fear', 'joy', 'angry', 'happy', 'sad', 'excited', 'worried',
  'thrilled', 'terrified', 'beautiful', 'ugly', 'brilliant', 'stupid', 'amazing',
  'awful', 'wonderful', 'terrible', 'fantastic', 'horrible', 'inspiring', 'devastating',
];

const COMMON_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out',
  'off', 'up', 'down', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
  'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just',
  'because', 'if', 'when', 'where', 'how', 'what', 'which', 'who', 'whom', 'this',
  'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him',
  'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'about',
]);

function analyzeHeadline(headline: string): AnalysisResult {
  const words = headline.toLowerCase().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const characterCount = headline.length;

  const powerWords = words.filter((w) => POWER_WORDS.includes(w));
  const emotionalWords = words.filter((w) => EMOTIONAL_WORDS.includes(w));
  const uncommonWords = words.filter((w) => !COMMON_WORDS.has(w) && w.length > 3);

  // Determine headline type
  let headlineType = 'Generic';
  const lower = headline.toLowerCase();
  if (/^\d+|^top\s+\d+/i.test(headline)) headlineType = 'List / Listicle';
  else if (/^how\s+to/i.test(headline)) headlineType = 'How-To';
  else if (/\?$/.test(headline.trim())) headlineType = 'Question';
  else if (/^why/i.test(headline)) headlineType = 'Explanation';
  else if (lower.includes('guide') || lower.includes('tutorial')) headlineType = 'Guide';

  // Sentiment
  let sentiment = 'Neutral';
  if (emotionalWords.length > 0) {
    const positive = ['love', 'joy', 'happy', 'excited', 'thrilled', 'beautiful', 'brilliant', 'amazing', 'wonderful', 'fantastic', 'inspiring'];
    const isPositive = emotionalWords.some((w) => positive.includes(w));
    sentiment = isPositive ? 'Positive' : 'Negative';
  }

  // Score calculation
  let score = 40;

  // Word count scoring (ideal: 6-12 words)
  if (wordCount >= 6 && wordCount <= 12) score += 15;
  else if (wordCount >= 4 && wordCount <= 14) score += 8;
  else score -= 5;

  // Character count (ideal: 50-70)
  if (characterCount >= 50 && characterCount <= 70) score += 10;
  else if (characterCount >= 40 && characterCount <= 80) score += 5;

  // Power words
  score += Math.min(powerWords.length * 8, 16);

  // Emotional words
  score += Math.min(emotionalWords.length * 6, 12);

  // Uncommon words ratio
  const uncommonRatio = uncommonWords.length / Math.max(wordCount, 1);
  if (uncommonRatio >= 0.3 && uncommonRatio <= 0.7) score += 7;

  // Has number
  if (/\d/.test(headline)) score += 5;

  // Starts with number
  if (/^\d/.test(headline)) score += 3;

  // Has colon or dash structure
  if (/[:\u2014\u2013-]/.test(headline)) score += 3;

  score = Math.max(0, Math.min(100, Math.round(score)));

  // Tips
  const tips: string[] = [];
  if (wordCount < 6) tips.push('Add more words — aim for 6-12 words for optimal engagement.');
  if (wordCount > 14) tips.push('Consider shortening — headlines with 6-12 words tend to perform best.');
  if (powerWords.length === 0) tips.push('Add a power word like "proven", "essential", or "ultimate" to increase impact.');
  if (emotionalWords.length === 0) tips.push('Include an emotional trigger word to boost click-through rates.');
  if (!/\d/.test(headline)) tips.push('Consider adding a number — numbered headlines get 36% more engagement.');
  if (characterCount > 80) tips.push('Trim to under 70 characters to avoid truncation in search results.');
  if (headlineType === 'Generic') tips.push('Try a specific format: How-To, List, or Question headlines perform better.');
  if (tips.length === 0) tips.push('Great headline! Consider A/B testing variations for even better results.');

  return { score, wordCount, characterCount, powerWords, emotionalWords, uncommonWords, headlineType, sentiment, tips };
}

function getScoreColor(score: number) {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-500';
  return 'text-red-500';
}

function getScoreLabel(score: number) {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Average';
  if (score >= 30) return 'Needs Work';
  return 'Poor';
}

function getScoreRingColor(score: number) {
  if (score >= 70) return '#059669';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

export default function HeadlineAnalyzer() {
  const [headline, setHeadline] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = () => {
    if (!headline.trim()) return;
    setResult(analyzeHeadline(headline));
  };

  const circumference = 2 * Math.PI * 54;

  return (
    <ToolLayout title="Headline Analyzer" description="Score your headline for engagement, emotion, and click-worthiness.">
      {/* Input */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-gray-700">Enter your headline</label>
        <input
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          placeholder="e.g. 10 Proven Ways to Boost Your Productivity Today"
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition"
        />
        <button
          onClick={handleAnalyze}
          disabled={!headline.trim()}
          className="mt-4 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Analyze Headline
        </button>
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={headline}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="mt-6 space-y-6"
          >
            {/* Score Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                {/* Score Ring */}
                <div className="relative flex shrink-0 items-center justify-center">
                  <svg width="128" height="128" className="-rotate-90">
                    <circle cx="64" cy="64" r="54" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                    <motion.circle
                      cx="64" cy="64" r="54" fill="none"
                      stroke={getScoreRingColor(result.score)}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: circumference - (result.score / 100) * circumference }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className={`text-3xl font-bold ${getScoreColor(result.score)}`}>{result.score}</span>
                    <span className="block text-xs text-gray-400">{getScoreLabel(result.score)}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <div className="text-xl font-bold text-gray-900">{result.wordCount}</div>
                    <div className="text-xs text-gray-500">Words</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <div className="text-xl font-bold text-gray-900">{result.characterCount}</div>
                    <div className="text-xs text-gray-500">Characters</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <div className="text-xl font-bold text-gray-900">{result.headlineType}</div>
                    <div className="text-xs text-gray-500">Type</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <div className="text-xl font-bold text-gray-900">{result.powerWords.length}</div>
                    <div className="text-xs text-gray-500">Power Words</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <div className="text-xl font-bold text-gray-900">{result.emotionalWords.length}</div>
                    <div className="text-xs text-gray-500">Emotional Words</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <div className="text-xl font-bold text-gray-900">{result.sentiment}</div>
                    <div className="text-xs text-gray-500">Sentiment</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Suggestions</h2>
              <ul className="mt-3 space-y-2">
                {result.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Word highlights */}
            {(result.powerWords.length > 0 || result.emotionalWords.length > 0) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">Word Highlights</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.powerWords.map((w) => (
                    <span key={`p-${w}`} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                      {w} <span className="text-amber-400">· power</span>
                    </span>
                  ))}
                  {result.emotionalWords.map((w) => (
                    <span key={`e-${w}`} className="rounded-full bg-pink-100 px-3 py-1 text-xs font-medium text-pink-700">
                      {w} <span className="text-pink-400">· emotional</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <ProUpsellBanner featureTeaser="Get AI-powered headline rewrites, A/B test suggestions, competitor headline analysis, and bulk scoring for up to 1,000 headlines at once." />
          </motion.div>
        )}
      </AnimatePresence>
    </ToolLayout>
  );
}
