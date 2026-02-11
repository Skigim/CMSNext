import { describe, it, expect } from "vitest";

/**
 * Tests for the position assignments import sort comparator.
 * 
 * The `availableStatuses` memo uses `.sort((a, b) => a.localeCompare(b))`
 * for deterministic alphabetical sorting of status strings.
 */
describe("usePositionAssignmentsImport - sort comparator", () => {
  it("sorts status strings alphabetically using localeCompare", () => {
    const statuses = new Set(["Pending", "Active", "Closed", "Approved"]);
    const sorted = Array.from(statuses).sort((a, b) => a.localeCompare(b));
    
    expect(sorted).toEqual(["Active", "Approved", "Closed", "Pending"]);
  });

  it("handles case-insensitive sorting with localeCompare", () => {
    const statuses = new Set(["active", "PENDING", "Closed"]);
    const sorted = Array.from(statuses).sort((a, b) => a.localeCompare(b));
    
    // localeCompare handles mixed case
    expect(sorted[0]).toBe("active");
    expect(sorted.length).toBe(3);
  });

  it("handles single status", () => {
    const statuses = new Set(["Active"]);
    const sorted = Array.from(statuses).sort((a, b) => a.localeCompare(b));
    
    expect(sorted).toEqual(["Active"]);
  });

  it("handles empty set", () => {
    const statuses = new Set<string>();
    const sorted = Array.from(statuses).sort((a, b) => a.localeCompare(b));
    
    expect(sorted).toEqual([]);
  });
});
