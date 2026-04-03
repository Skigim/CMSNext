import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "@/components/ui/sonner";

const sonnerMock = vi.fn();
const useThemeMock = vi.fn();

vi.mock("sonner", () => ({
  Toaster: (props: unknown) => {
    sonnerMock(props);
    return <div data-testid="sonner-toaster" />;
  },
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => useThemeMock(),
}));

describe("Toaster", () => {
  beforeEach(() => {
    sonnerMock.mockClear();
    useThemeMock.mockReset();
  });

  it("uses light Sonner mode and readable description tokens for sterling", () => {
    // ARRANGE
    useThemeMock.mockReturnValue({ theme: "sterling" });

    // ACT
    render(<Toaster />);

    // ASSERT
    const [props] = sonnerMock.mock.calls[0] ?? [];
    expect(props).toMatchObject({
      theme: "light",
      toastOptions: {
        classNames: {
          description: "text-muted-foreground",
        },
      },
    });
  });

  it("preserves caller toast classNames while merging the description token", () => {
    // ARRANGE
    useThemeMock.mockReturnValue({ theme: "light" });

    // ACT
    render(
      <Toaster
        toastOptions={{
          classNames: {
            toast: "custom-toast",
            description: "tracking-tight",
          },
        }}
      />,
    );

    // ASSERT
    const [props] = sonnerMock.mock.calls[0] ?? [];
    expect(props).toMatchObject({
      toastOptions: {
        classNames: {
          toast: "custom-toast",
          description: "text-muted-foreground tracking-tight",
        },
      },
    });
  });

  it("uses dark Sonner mode for the dark theme", () => {
    // ARRANGE
    useThemeMock.mockReturnValue({ theme: "dark" });

    // ACT
    render(<Toaster />);

    // ASSERT
    const [props] = sonnerMock.mock.calls[0] ?? [];
    expect(props).toMatchObject({
      theme: "dark",
    });
  });
});
