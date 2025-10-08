import { Toaster } from "./components/ui/sonner";
import { AppProviders } from "./components/providers/AppProviders";
import { FileStorageIntegrator } from "./components/providers/FileStorageIntegrator";
import { AppContent } from "./components/app/AppContent";
import { createLogger } from "./utils/logger";

const logger = createLogger("App");

export default function App() {
  logger.lifecycle("Rendering main App component");

  return (
    <AppProviders>
      <FileStorageIntegrator>
        <AppContent />
        <Toaster />
      </FileStorageIntegrator>
    </AppProviders>
  );
}