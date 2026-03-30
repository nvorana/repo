import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const tools = [
  {
    title: 'Headline Analyzer',
    description: 'Grade your headlines for engagement, emotional impact, and click-worthiness.',
    path: '/tools/headline-analyzer',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    color: 'from-orange-500 to-pink-500',
    bgLight: 'bg-orange-50',
    textColor: 'text-orange-600',
  },
  {
    title: 'Readability Scorer',
    description: 'Analyze your text\'s readability level with Flesch-Kincaid scoring and suggestions.',
    path: '/tools/readability-scorer',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: 'from-emerald-500 to-teal-500',
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-600',
  },
  {
    title: 'Color Contrast Checker',
    description: 'Check WCAG accessibility compliance of your color combinations instantly.',
    path: '/tools/color-contrast-checker',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
    color: 'from-violet-500 to-purple-500',
    bgLight: 'bg-violet-50',
    textColor: 'text-violet-600',
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="text-lg font-bold text-indigo-600">ToolKit</span>
          <button className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700">
            Get Pro
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pb-8 pt-12 text-center sm:px-6 sm:pt-20 sm:pb-12">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-700 uppercase">
            100% Free
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            Free Tools to Boost
            <span className="block bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Your Workflow
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-500">
            Powerful analyzers and graders — completely free. No sign-up required. Get instant results and actionable insights.
          </p>
        </motion.div>
      </section>

      {/* Tools Grid */}
      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {tools.map((tool) => (
            <motion.div key={tool.path} variants={item}>
              <Link
                to={tool.path}
                className="group block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-lg hover:border-slate-300"
              >
                <div className={`inline-flex rounded-xl ${tool.bgLight} p-3 ${tool.textColor}`}>
                  {tool.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition">
                  {tool.title}
                </h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{tool.description}</p>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-indigo-600">
                  Try it free
                  <svg className="h-4 w-4 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Pro CTA Section */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Need more power?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-gray-500">
            Unlock bulk analysis, API access, detailed reports, and 20+ premium tools with Pro.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button className="rounded-full bg-indigo-600 px-8 py-3 text-sm font-medium text-white shadow-md transition hover:bg-indigo-700 hover:shadow-lg">
              Upgrade to Pro — $9/mo
            </button>
            <span className="text-sm text-gray-400">No credit card required to start</span>
          </div>
        </div>
      </section>
    </div>
  );
}
