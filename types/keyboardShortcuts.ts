export type ShortcutCategory = "navigation" | "actions" | "ui";

export interface ShortcutDefinition {
  id: string;
  label: string;
  description?: string;
  category: ShortcutCategory;
  defaultBinding: string;
  enabled: boolean;
}

export interface ShortcutConfig {
  shortcuts: Record<
    string,
    {
      customBinding?: string;
      enabled: boolean;
    }
  >;
}

export interface ResolvedShortcut extends ShortcutDefinition {
  binding: string;
}
