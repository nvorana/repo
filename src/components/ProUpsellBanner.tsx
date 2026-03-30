import { motion } from 'framer-motion';

interface ProUpsellBannerProps {
  featureTeaser: string;
}

export default function ProUpsellBanner({ featureTeaser }: ProUpsellBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="mt-8 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">Unlock Pro Features</h3>
          <p className="mt-1 text-sm text-gray-600">{featureTeaser}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-md transition hover:bg-indigo-700 hover:shadow-lg">
              Upgrade to Pro
            </button>
            <button className="rounded-full border border-indigo-300 px-5 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50">
              See All Pro Features
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
