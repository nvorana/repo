import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ToolLayout from '../components/ToolLayout';
import ProUpsellBanner from '../components/ProUpsellBanner';

interface ReadabilityResult {
  fleschKincaid: number;
  gradeLevel: number;
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
  readingTime: string;
  level: string;
  audience: string;
  tips: string[];
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 2) return 1;

  let count = 0;
  const vowels = 'aeiouy';
  let prevVowel = false;

  for (let i = 0; i < word.length; i++) {
    const isVowel = vowels.includes(word[i]);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }

  // Silent e
  if (word.endsWith('e') && count > 1) count--;
  // Words like "le" at the end
  if (word.endsWith('le') && word.length > 2 && !vowels.includes(word[word.length - 3])) count++;

  return Math.max(1, count);
}

function analyzeReadability(text: string): ReadabilityResult {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.replace(/[^a-zA-Z]/g, '').length > 0);
  const sentenceCount = Math.max(sentences.length, 1);
  const wordCount = words.length;

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = totalSyllables / Math.max(wordCount, 1);

  // Flesch Reading Ease
  const fleschKincaid = Math.max(
    0,
    Math.min(100, Math.round(206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord))
  );

  // Flesch-Kincaid Grade Level
  const gradeLevel = Math.max(
    0,
    Math.round((0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59) * 10) / 10
  );

  // Reading time (avg 238 wpm)
  const minutes = wordCount / 238;
  const readingTime =
    minutes < 1 ? `${Math.max(1, Math.round(minutes * 60))} sec` : `${Math.round(minutes)} min`;

  // Level & audience
  let level: string;
  let audience: string;
  if (fleschKincaid >= 80) {
    level = 'Very Easy';
    audience = 'Elementary school students';
  } else if (fleschKincaid >= 60) {
    level = 'Standard';
    audience = 'General public, 13-15 year olds';
  } else if (fleschKincaid >= 40) {
    level = 'Fairly Difficult';
    audience = 'College students';
  } else if (fleschKincaid >= 20) {
    level = 'Difficult';
    audience = 'College graduates';
  } else {
    level = 'Very Difficult';
    audience = 'Academic / Professional';
  }

  // Tips
  const tips: string[] = [];
  if (avgWordsPerSentence > 20)
    tips.push('Break up long sentences. Aim for 15-20 words per sentence for better readability.');
  if (avgSyllablesPerWord > 1.7)
    tips.push('Use simpler words with fewer syllables to improve comprehension.');
  if (fleschKincaid < 50 && wordCount > 20)
    tips.push('Your text is fairly complex. Consider simplifying vocabulary for a wider audience.');
  if (sentenceCount < 3 && wordCount > 50)
    tips.push('Add more sentence breaks to improve flow and readability.');
  if (fleschKincaid >= 70)
    tips.push('Great readability! Your text is accessible to a wide audience.');
  if (tips.length === 0)
    tips.push('Your text has decent readability. Try reading it aloud to spot areas for improvement.');

  return {
    fleschKincaid,
    gradeLevel,
    wordCount,
    sentenceCount,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    readingTime,
    level,
    audience,
    tips,
  };
}

function getScoreColor(score: number) {
  if (score >= 60) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-500';
  return 'text-red-500';
}

function getBarColor(score: number) {
  if (score >= 60) return 'bg-emerald-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function ReadabilityScorer() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ReadabilityResult | null>(null);

  const handleAnalyze = () => {
    if (!text.trim()) return;
    setResult(analyzeReadability(text));
  };

  return (
    <ToolLayout title="Readability Scorer" description="Analyze your text's reading level and get actionable suggestions.">
      {/* Input */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-gray-700">Paste your text below</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your article, email, or any text here to analyze its readability..."
          rows={6}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-relaxed focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition resize-y"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {text.split(/\s+/).filter(Boolean).length} words
          </span>
          <button
            onClick={handleAnalyze}
            disabled={!text.trim()}
            className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Analyze Readability
          </button>
        </div>
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={text.slice(0, 50)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="mt-6 space-y-6"
          >
            {/* Main Score */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <div className="text-center sm:text-left">
                  <div className={`text-5xl font-bold ${getScoreColor(result.fleschKincaid)}`}>
                    {result.fleschKincaid}
                  </div>
                  <div className="mt-1 text-sm text-gray-500">Flesch Reading Ease</div>
                  <div className="mt-2">
                    <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {result.level}
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  {/* Score bar */}
                  <div className="mb-4">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        className={`h-full rounded-full ${getBarColor(result.fleschKincaid)}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${result.fleschKincaid}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-gray-400">
                      <span>Hard</span>
                      <span>Easy</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <div className="text-sm font-semibold text-gray-900">Grade {result.gradeLevel}</div>
                      <div className="text-xs text-gray-500">Reading Level</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <div className="text-sm font-semibold text-gray-900">{result.readingTime}</div>
                      <div className="text-xs text-gray-500">Reading Time</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Words', value: result.wordCount },
                { label: 'Sentences', value: result.sentenceCount },
                { label: 'Words/Sentence', value: result.avgWordsPerSentence },
                { label: 'Syllables/Word', value: result.avgSyllablesPerWord },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="mt-1 text-xs text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Audience */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Target Audience</h2>
              <p className="mt-2 text-sm text-gray-600">
                Your text is best suited for: <strong className="text-gray-900">{result.audience}</strong>
              </p>
            </div>

            {/* Tips */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Suggestions</h2>
              <ul className="mt-3 space-y-2">
                {result.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            <ProUpsellBanner featureTeaser="Unlock sentence-by-sentence highlights, tone analysis, passive voice detection, jargon alerts, and exportable PDF reports with Pro." />
          </motion.div>
        )}
      </AnimatePresence>
    </ToolLayout>
  );
}
