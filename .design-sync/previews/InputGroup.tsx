import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "respondly";
import { Search } from "lucide-react";

export const WithIcon = () => (
  <InputGroup className="max-w-sm">
    <InputGroupAddon>
      <Search />
    </InputGroupAddon>
    <InputGroupInput placeholder="Konuşmalarda ara" />
  </InputGroup>
);

export const WithButton = () => (
  <InputGroup className="max-w-sm">
    <InputGroupInput placeholder="mcp.oteliniz.com" />
    <InputGroupAddon align="inline-end">
      <InputGroupButton>Bağlan</InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
);

export const WithText = () => (
  <InputGroup className="max-w-sm">
    <InputGroupAddon>
      <InputGroupText>https://</InputGroupText>
    </InputGroupAddon>
    <InputGroupInput placeholder="oteliniz.com" />
  </InputGroup>
);
