import { Button, Spinner } from "respondly";

export const Default = () => (
  <div className="flex items-center gap-4">
    <Spinner />
    <Spinner className="size-6" />
    <Spinner className="size-8 text-primary" />
  </div>
);

export const InContext = () => (
  <div className="flex items-center gap-3 text-sm text-muted-foreground">
    <Spinner />
    Konuşmalar yükleniyor…
    <Button size="sm" variant="ghost">
      Vazgeç
    </Button>
  </div>
);
