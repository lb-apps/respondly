import {
  Avatar,
  AvatarFallback,
  Bubble,
  BubbleContent,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "respondly";

export const Conversation = () => (
  <MessageGroup className="w-full max-w-md">
    <Message>
      <MessageAvatar>
        <Avatar size="sm"><AvatarFallback>AY</AvatarFallback></Avatar>
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>Ayşe Yılmaz</MessageHeader>
        <Bubble variant="muted">
          <BubbleContent>Spa için randevu alabilir miyim?</BubbleContent>
        </Bubble>
        <MessageFooter>10:24</MessageFooter>
      </MessageContent>
    </Message>
    <Message align="end">
      <MessageContent>
        <Bubble align="end">
          <BubbleContent>Tabii, yarın 15:00 ve 17:00 uygun. Hangisini ayırayım?</BubbleContent>
        </Bubble>
        <MessageFooter>10:25 · Asistan</MessageFooter>
      </MessageContent>
    </Message>
  </MessageGroup>
);
