/**
 * Summary Section Renderer
 *
 * All core logic has moved to @/domain/templates.
 * This file re-exports for backwards compatibility.
 */

// Re-export everything from domain/templates
export {
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
} from "@/domain/templates";
