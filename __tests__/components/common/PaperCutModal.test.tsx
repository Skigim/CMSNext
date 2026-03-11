import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PaperCutModal } from "@/components/common/PaperCutModal";

describe("PaperCutModal", () => {
  it("submits with Ctrl+Enter", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <PaperCutModal
        open={true}
        onOpenChange={onOpenChange}
        route="/dashboard"
        context="quick case"
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/feedback/i), "This flow is clunky");
    await user.keyboard("{Control>}{Enter}{/Control}");

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("This flow is clunky");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
