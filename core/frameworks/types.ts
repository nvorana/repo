/**
 * A sales framework is the rubric the reviewer scores against. The default is
 * a general best-practices framework; drop in your own (e.g. from a markdown
 * doc via `frameworkFromMarkdown`) to make every review follow your
 * organization's methodology.
 */
export interface SalesFramework {
  id: string;
  name: string;
  /**
   * Free-form methodology guidance injected into the reviewer's system
   * prompt: the stages, rules, and language your salespeople are trained on.
   */
  guidance: string;
  /** The criteria each call is scored on (1-5 each). */
  criteria: FrameworkCriterion[];
}

export interface FrameworkCriterion {
  id: string;
  name: string;
  /** What "good" looks like for this criterion. */
  description: string;
}
