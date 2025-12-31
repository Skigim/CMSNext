import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: StorybookConfig = {
  stories: [
    '../components/**/*.mdx',
    '../components/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    // Removed: @storybook/addon-onboarding (causes checklist state errors)
    // Removed: @chromatic-com/storybook (not needed for local dev)
    // Removed: @storybook/addon-vitest (requires additional config)
  ],
  framework: '@storybook/react-vite',
  viteFinal: async (config) => {
    // Mirror the @ alias from the main vite.config.ts
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, '../'),
    };

    // Allow all hosts for GitHub Codespaces / devcontainer environments
    config.server = config.server || {};
    config.server.allowedHosts = true;
    
    // Configure HMR for Codespaces (uses forwarded ports)
    config.server.hmr = {
      // Use the forwarded port from Codespaces
      clientPort: 443,
      protocol: 'wss',
    };

    return config;
  },
};

export default config;