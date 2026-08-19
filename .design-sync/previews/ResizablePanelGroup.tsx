import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "respondly";

export const TwoPane = () => (
  <ResizablePanelGroup direction="horizontal" className="h-48 w-full max-w-lg rounded-xl border">
    <ResizablePanel defaultSize={40}>
      <div className="h-full p-3 text-sm">
        <div className="font-medium">Konuşmalar</div>
        <div className="pt-1 text-muted-foreground">18 açık</div>
      </div>
    </ResizablePanel>
    <ResizableHandle withHandle />
    <ResizablePanel defaultSize={60}>
      <div className="h-full p-3 text-sm text-muted-foreground">Bir konuşma seçin</div>
    </ResizablePanel>
  </ResizablePanelGroup>
);
