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
}: Readonly<{
  initialValue?: string[];
}>) {
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

function MultiSelectWithNextAction() {
  const [value, setValue] = useState<string[]>([]);

  return (
    <div>
      <MultiSelect
        options={options}
        value={value}
        onValueChange={setValue}
        placeholder="Select categories"
      />
      <button type="button">Next action</button>
    </div>
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
    await user.click(screen.getByRole("menuitemcheckbox", { name: /Important/ }));

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
    await user.click(screen.getByRole("menuitemcheckbox", { name: /Important/ }));

    // ASSERT
    expect(onValueChange).toHaveBeenNthCalledWith(2, []);
  });

  it("renders compact summary text and keeps the menu open while selecting multiple options", async () => {
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
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Select note categories: 2 selected",
      }),
    ).toHaveTextContent("2 selected");
    expect(screen.getAllByRole("menuitemcheckbox", { checked: true })).toHaveLength(2);
  });

  it("supports arrow navigation, space selection, and escape closing through the keyboard", async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<ControlledMultiSelect />);

    // ACT
    await user.tab();
    expect(
      screen.getByRole("button", {
        name: "Select note categories: Select categories",
      }),
    ).toHaveFocus();
    await user.keyboard(" ");
    await user.keyboard("{ArrowDown}{ArrowDown} ");

    // ASSERT
    expect(
      screen.getByRole("button", {
        name: "Select note categories: Follow Up",
      }),
    ).toBeInTheDocument();

    // ACT
    await user.keyboard("{Escape}");

    // ASSERT
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Select note categories: Follow Up",
      }),
    ).toHaveFocus();
  });

  it("closes on Tab and advances focus to the next control", async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<MultiSelectWithNextAction />);

    // ACT
    await user.tab();
    await user.keyboard(" ");
    await user.keyboard("{ArrowDown}{ArrowDown} ");
    await user.keyboard("{Tab}");

    // ASSERT
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next action" })).toHaveFocus();
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
    const importantOption = screen.getByRole("menuitemcheckbox", { name: /Important/ });

    expect(importantOption).toBeInTheDocument();
    expect(importantOption).toHaveAttribute("data-state", "checked");
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
    expect(
      await axe(document.body, {
        rules: {
          region: { enabled: false },
        },
      }),
    ).toHaveNoViolations();
  });
});
