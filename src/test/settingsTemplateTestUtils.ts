import { vi } from "vitest";
import type { Template } from "@/types/template";

type TemplateContextMockValue = {
  templates: Template[];
  loading: boolean;
  error: string | null;
  refresh: ReturnType<typeof vi.fn>;
  getTemplatesByCategory: ReturnType<typeof vi.fn>;
  getTemplateById: ReturnType<typeof vi.fn>;
  addTemplate: ReturnType<typeof vi.fn>;
  updateTemplate: ReturnType<typeof vi.fn>;
  deleteTemplate: ReturnType<typeof vi.fn>;
  reorderTemplates: ReturnType<typeof vi.fn>;
};

export const settingsTemplateTestMocks = {
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "id"),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    lifecycle: vi.fn(),
  },
} as const;

export function createTemplateContextMockValue(
  overrides: Partial<TemplateContextMockValue> = {},
): TemplateContextMockValue {
  return {
    templates: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
    getTemplatesByCategory: vi.fn().mockReturnValue([]),
    getTemplateById: vi.fn(),
    addTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    reorderTemplates: vi.fn(),
    ...overrides,
  };
}
