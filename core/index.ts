/**
 * Sales Call Review — core engine.
 *
 * Framework-agnostic and UI-agnostic: no React, no Express. Import this
 * module from any host (web server, CLI, queue worker, bot) to review calls.
 *
 *   const result = await reviewCall(audio, {
 *     transcriber: new AssemblyAIProvider(process.env.ASSEMBLYAI_API_KEY!),
 *     framework: myFramework, // optional — defaults to general best practices
 *   });
 */
export { reviewCall, reviewCallFromTracks, reanalyzeCall, mergeTracks } from "./pipeline.ts";
export type { ReviewPipelineOptions, ReanalyzeOptions, ReviewStage, CallTracks } from "./pipeline.ts";

export { CallAnalyzer } from "./analyzer.ts";
export type { AnalyzerOptions } from "./analyzer.ts";

export { distillLesson, type DistillInput, type DistillResult } from "./lessons.ts";

export { computeDeliveryMetrics, formatTimestamp } from "./metrics.ts";
export { anchorReviewTimestamps, locateQuoteMs } from "./anchor.ts";
export { verifyReviewClaims, quoteAppears } from "./verify.ts";

export type { TranscriptionProvider, AudioInput } from "./transcription/provider.ts";
export { AssemblyAIProvider } from "./transcription/assemblyai.ts";

export type { SalesFramework, FrameworkCriterion } from "./frameworks/types.ts";
export { defaultFramework } from "./frameworks/default.ts";
export { frameworkFromMarkdown } from "./frameworks/markdown.ts";

export * from "./types.ts";
