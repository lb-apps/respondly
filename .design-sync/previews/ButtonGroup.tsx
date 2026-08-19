import { Button, ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "respondly";
import { Archive, Bot, UserRound } from "lucide-react";

export const Default = () => (
  <ButtonGroup>
    <Button variant="outline">
      <Bot /> Asistan
    </Button>
    <Button variant="outline">
      <UserRound /> Devral
    </Button>
    <Button variant="outline">
      <Archive /> Arşivle
    </Button>
  </ButtonGroup>
);

export const WithText = () => (
  <ButtonGroup>
    <ButtonGroupText>Sırala</ButtonGroupText>
    <ButtonGroupSeparator />
    <Button variant="outline">En yeni</Button>
    <Button variant="outline">En eski</Button>
  </ButtonGroup>
);
