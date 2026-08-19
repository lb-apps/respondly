import {
  Avatar,
  AvatarFallback,
  Bubble,
  BubbleContent,
  Message,
  MessageAvatar,
  MessageContent,
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "respondly";

const TURNS = [
  { id: "1", from: "guest", text: "Merhaba, odada mini bar var mı?" },
  { id: "2", from: "assistant", text: "Evet, tüm odalarımızda mini bar bulunuyor." },
  { id: "3", from: "guest", text: "Peki geç çıkış mümkün mü?" },
  { id: "4", from: "assistant", text: "14:00'e kadar geç çıkış müsaitliğe bağlı olarak ücretsiz." },
];

export const Thread = () => (
  <MessageScrollerProvider>
    <MessageScroller className="h-64 w-full max-w-md rounded-xl border">
      <MessageScrollerViewport>
        <MessageScrollerContent className="gap-3 p-3">
          {TURNS.map((t) => (
            <MessageScrollerItem key={t.id} id={t.id}>
              <Message align={t.from === "assistant" ? "end" : "start"}>
                {t.from === "guest" ? (
                  <MessageAvatar>
                    <Avatar size="sm"><AvatarFallback>AY</AvatarFallback></Avatar>
                  </MessageAvatar>
                ) : null}
                <MessageContent>
                  <Bubble
                    variant={t.from === "assistant" ? "default" : "muted"}
                    align={t.from === "assistant" ? "end" : "start"}
                  >
                    <BubbleContent>{t.text}</BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
            </MessageScrollerItem>
          ))}
        </MessageScrollerContent>
      </MessageScrollerViewport>
    </MessageScroller>
  </MessageScrollerProvider>
);
