import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelationshipsSection } from "@/components/case/CaseEditSections";
import type { Relationship } from "@/types/case";

describe("RelationshipsSection", () => {
  it("keeps relationship fields aligned and renders remove action outside inputs", () => {
    const relationships: Relationship[] = [
      { id: "rel-1", type: "Spouse", name: "Alex Example", phone: "1234567890" },
    ];

    render(
      <RelationshipsSection
        relationships={relationships}
        isEditing
        onRelationshipsChange={{
          add: vi.fn(),
          update: vi.fn(),
          remove: vi.fn(),
        }}
      />,
    );

    const typeSelect = screen.getByRole("combobox");
    const nameInput = screen.getByPlaceholderText("Name");
    const phoneInput = screen.getByPlaceholderText("Phone");
    const removeButton = screen.getByRole("button", { name: /remove relationship 1/i });

    expect(typeSelect).toHaveClass("h-8");
    expect(nameInput).toHaveClass("h-8");
    expect(phoneInput).toHaveClass("h-8");
    expect(removeButton).toHaveClass("h-8");
    expect(removeButton).not.toHaveClass("absolute");
    expect(nameInput.closest("div")).toContainElement(removeButton);
  });
});
