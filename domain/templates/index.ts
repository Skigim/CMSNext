/**
 * Template Domain Module - VR/Summary Template Rendering
 *
 * Pure functions for template placeholder substitution.
 * No I/O, no side effects.
 *
 * @module domain/templates
 */

export {
  // Context builders
  buildCaseLevelContext,
  buildRenderContext,

  // Rendering functions
  renderTemplate,
  renderVR,
  renderMultipleVRs,
} from "./vr";

export {
  // Summary generation
  generateCaseSummary,
  type SummarySections,
  DEFAULT_SUMMARY_SECTIONS,

  // Item formatters
  formatResourceItem,
  formatIncomeItem,
  formatExpenseItem,

  // Section context builders
  buildCaseInfoContext,
  buildPersonInfoContext,
  buildRelationshipsContext,
  buildResourcesContext,
  buildIncomeContext,
  buildExpensesContext,
  buildNotesContext,
  buildAVSTrackingContext,
  buildSectionContext,
  renderSummarySection,
} from "./summary";
