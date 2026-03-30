import { useState } from 'react';
import { motion } from 'framer-motion';
import ToolLayout from '../components/ToolLayout';
import ProUpsellBanner from '../components/ProUpsellBanner';

interface ContrastResult {
  ratio: number;
  aaLargePass: boolean;
  aaNormalPass: boolean;
  aaaLargePass: boolean;
  aaaNormalPass: boolean;
  grade: string;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return [r, g, b];
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 0;

  const l1 = relativeLuminance(...rgb1);
  const l2 = relativeLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function checkContrast(foreground: string, background: string): ContrastResult {
  const ratio = Math.round(getContrastRatio(foreground, background) * 100) / 100;

  const aaNormalPass = ratio >= 4.5;
  const aaLargePass = ratio >= 3;
  const aaaNormalPass = ratio >= 7;
  const aaaLargePass = ratio >= 4.5;

  let grade = 'Fail';
  if (aaaNormalPass) grade = 'AAA';
  else if (aaNormalPass) grade = 'AA';
  else if (aaLargePass) grade = 'AA Large';

  return { ratio, aaLargePass, aaNormalPass, aaaLargePass, aaaNormalPass, grade };
}

function isValidHex(hex: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}

function PassFailBadge({ pass, label }: { pass: boolean; label: string }) {
  return (
    <div className={`flex items-center justify-between rounded-xl p-3 ${pass ? 'bg-emerald-50' : 'bg-red-50'}`}>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <span
        className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
          pass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
        }`}
      >
        {pass ? 'Pass' : 'Fail'}
      </span>
    </div>
  );
}

export default function ColorContrastChecker() {
  const [foreground, setForeground] = useState('#1e293b');
  const [background, setBackground] = useState('#ffffff');
  const [result, setResult] = useState<ContrastResult | null>(null);

  const canCheck = isValidHex(foreground) && isValidHex(background);

  const handleCheck = () => {
    if (!canCheck) return;
    const fg = foreground.startsWith('#') ? foreground : `#${foreground}`;
    const bg = background.startsWith('#') ? background : `#${background}`;
    setResult(checkContrast(fg, bg));
  };

  const handleSwap = () => {
    setForeground(background);
    setBackground(foreground);
    setResult(null);
  };

  const fgHex = foreground.startsWith('#') ? foreground : `#${foreground}`;
  const bgHex = background.startsWith('#') ? background : `#${background}`;

  return (
    <ToolLayout title="Color Contrast Checker" description="Check WCAG accessibility compliance for your color combinations.">
      {/* Input */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {/* Foreground */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">Text Color</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={isValidHex(foreground) ? fgHex : '#000000'}
                onChange={(e) => setForeground(e.target.value)}
                className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-slate-300"
              />
              <input
                type="text"
                value={foreground}
                onChange={(e) => setForeground(e.target.value)}
                placeholder="#1e293b"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-mono focus:border-violet-500 focus:ring-2 focus:ring-violet-200 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            className="self-center rounded-full border border-slate-300 p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            title="Swap colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>

          {/* Background */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">Background Color</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="color"
                value={isValidHex(background) ? bgHex : '#ffffff'}
                onChange={(e) => setBackground(e.target.value)}
                className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-slate-300"
              />
              <input
                type="text"
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                placeholder="#ffffff"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-mono focus:border-violet-500 focus:ring-2 focus:ring-violet-200 focus:outline-none transition"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleCheck}
          disabled={!canCheck}
          className="mt-5 rounded-full bg-violet-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Check Contrast
        </button>
      </div>

      {/* Preview */}
      {canCheck && (
        <div
          className="mt-6 rounded-2xl border border-slate-200 p-8 shadow-sm transition-colors"
          style={{ backgroundColor: bgHex }}
        >
          <p className="text-2xl font-bold" style={{ color: fgHex }}>
            The quick brown fox jumps over the lazy dog.
          </p>
          <p className="mt-2 text-sm" style={{ color: fgHex }}>
            This is how your text will look with these color choices. Check the contrast ratio below.
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mt-6 space-y-6"
        >
          {/* Ratio */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
            <div className="text-sm text-gray-500">Contrast Ratio</div>
            <div
              className={`mt-1 text-5xl font-bold ${
                result.aaNormalPass ? 'text-emerald-600' : result.aaLargePass ? 'text-amber-500' : 'text-red-500'
              }`}
            >
              {result.ratio}:1
            </div>
            <div className="mt-2">
              <span
                className={`inline-block rounded-full px-4 py-1 text-sm font-semibold ${
                  result.grade === 'Fail'
                    ? 'bg-red-100 text-red-700'
                    : result.grade === 'AAA'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                WCAG {result.grade}
              </span>
            </div>
          </div>

          {/* WCAG Levels */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">WCAG Compliance</h2>
            <div className="space-y-3">
              <PassFailBadge pass={result.aaNormalPass} label="AA Normal Text (≥ 4.5:1)" />
              <PassFailBadge pass={result.aaLargePass} label="AA Large Text (≥ 3:1)" />
              <PassFailBadge pass={result.aaaNormalPass} label="AAA Normal Text (≥ 7:1)" />
              <PassFailBadge pass={result.aaaLargePass} label="AAA Large Text (≥ 4.5:1)" />
            </div>
          </div>

          <ProUpsellBanner featureTeaser="Get full palette accessibility audits, auto-suggested accessible alternatives, color blindness simulation, and exportable compliance reports with Pro." />
        </motion.div>
      )}
    </ToolLayout>
  );
}
