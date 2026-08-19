import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "respondly";
import { MessageSquareDashed } from "lucide-react";

export const Default = () => (
  <Empty className="max-w-md">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <MessageSquareDashed />
      </EmptyMedia>
      <EmptyTitle>Henüz konuşma yok</EmptyTitle>
      <EmptyDescription>
        WhatsApp numaranıza ilk mesaj geldiğinde konuşmalar burada listelenir.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button size="sm">WhatsApp'ı bağla</Button>
    </EmptyContent>
  </Empty>
);
