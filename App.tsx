import { Toaster } from "@/components/ui/sonner";
import { AppProviders } from "@/components/providers/AppProviders";
import { FileStorageIntegrator } from "@/components/providers/FileStorageIntegrator";
import { AppContent } from "@/components/app/AppContent";
import { createLogger } from "@/utils/logger";
import { usePaperCutCapture } from "@/hooks/usePaperCutCapture";
import { PaperCutModal } from "@/components/common/PaperCutModal";

const logger = createLogger("App");

export default function App() {
  logger.lifecycle("Rendering main App component");
  const paperCut = usePaperCutCapture();

  return (
    <AppProviders>
      <FileStorageIntegrator>
        <AppContent />
        <PaperCutModal
          open={paperCut.isOpen}
          onOpenChange={(open) => (open ? paperCut.openModal() : paperCut.closeModal())}
          route={paperCut.currentRoute}
          context={paperCut.currentContext}
          onSubmit={paperCut.submitPaperCut}
        />
        <Toaster />
      </FileStorageIntegrator>
    </AppProviders>
  );
}