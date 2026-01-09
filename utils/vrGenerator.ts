/**
 * Template Generator Utility
 *
 * Renders templates by substituting placeholders with actual data
 * from financial items and case records.
 *
 * All core logic has moved to @/domain/templates.
 * This file re-exports for backwards compatibility.
 */

// Re-export everything from domain/templates
export {
  buildCaseLevelContext,
  buildRenderContext,
  renderTemplate,
  renderVR,
  renderMultipleVRs,
  getPlaceholdersByCategory,
  createDefaultVRScript,
} from "@/domain/templates";
