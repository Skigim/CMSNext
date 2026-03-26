import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import {
  MultiSelect,
  type MultiSelectOption,
} from "@/components/ui/multi-select";

const options: MultiSelectOption[] = [
  { label: "General", value: "general" },
  { label: "Important", value: "important" },
  { label: "Follow Up", value: "follow-up" },
];

function ControlledMultiSelect({
  initialValue = [],
}: {
  initialValue?: string[];
}) {
  const [value, setValue] = useState<string[]>(initialValue);

  return (
    <MultiSelect
      options={options}
      value={value}
      onValueChange={setValue}
      placeholder="Select categories"
      searchPlaceholder="Search categories"
      ariaLabel="Select note categories"
    />
  );
}

describe("MultiSelect", () => {
  it("calls onValueChange with toggled values from the controlled value prop", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <MultiSelect
        options={options}
        value={[]}
        onValueChange={onValueChange}
        placeholder="Select categories"
      />,
    );

    // ACT
    await user.click(screen.getByRole("button", { name: "Select categories" }));
    await user.click(screen.getByRole("option", { name: /Important/ }));

    // ASSERT
    expect(onValueChange).toHaveBeenNthCalledWith(1, ["important"]);

    // ARRANGE
    rerender(
      <MultiSelect
        options={options}
        value={["important"]}
        onValueChange={onValueChange}
        placeholder="Select categories"
      />,
    );

    // ACT
    await user.click(screen.getByRole("option", { name: /Important/ }));

    // ASSERT
    expect(onValueChange).toHaveBeenNthCalledWith(2, []);
  });

  it("renders compact summary text and keeps the popover open while selecting multiple options", async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<ControlledMultiSelect />);

    // ACT
    await user.click(
      screen.getByRole("button", {
        name: "Select note categories: Select categories",
      }),
    );
    await user.click(screen.getByText("General"));
    await user.click(screen.getByText("Follow Up"));

    // ASSERT
    expect(screen.getByPlaceholderText("Search categories")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Select note categories: 2 selected",
      }),
    ).toHaveTextContent("2 selected");
    expect(screen.getAllByText("Selected")).toHaveLength(2);
  });

  it("supports search filtering and keyboard selection through Command", async () => {
    // ARRANGE
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <MultiSelect
        options={options}
        value={[]}
        onValueChange={onValueChange}
        placeholder="Select categories"
        searchPlaceholder="Search categories"
      />,
    );

    // ACT
    await user.click(screen.getByRole("button", { name: "Select categories" }));
    await user.type(screen.getByPlaceholderText("Search categories"), "follow");
    await user.keyboard("{ArrowDown}{Enter}");

    // ASSERT
    expect(onValueChange).toHaveBeenCalledWith(["follow-up"]);
  });

  it("shows the selected option label when exactly one value is selected", async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<ControlledMultiSelect initialValue={["important"]} />);

    // ACT
    await user.click(
      screen.getByRole("button", {
        name: "Select note categories: Important",
      }),
    );

    // ASSERT
    expect(
      screen.getByRole("button", {
        name: "Select note categories: Important",
      }),
    ).toHaveTextContent("Important");
    expect(
      screen.getByRole("option", { name: /Important\s*Selected/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Selected")).toBeInTheDocument();
  });

  it("shows the empty state when search returns no results", async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<ControlledMultiSelect />);

    // ACT
    await user.click(
      screen.getByRole("button", {
        name: "Select note categories: Select categories",
      }),
    );
    await user.type(screen.getByPlaceholderText("Search categories"), "missing");

    // ASSERT
    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<ControlledMultiSelect />);

    // ACT
    await user.click(
      screen.getByRole("button", {
        name: "Select note categories: Select categories",
      }),
    );

    // ASSERT
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
