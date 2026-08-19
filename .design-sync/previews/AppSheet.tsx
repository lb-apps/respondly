import { AppSheet, Button, Input, Label } from "respondly";

export const RightPanel = () => (
  <AppSheet
    open
    onOpenChange={() => {}}
    title="MCP sunucusu ekle"
    description="Kendi sistemlerinizi asistana bağlayın."
    footer={<Button>Bağlan</Button>}
  >
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="mcp-name">Sunucu adı</Label>
        <Input id="mcp-name" defaultValue="Rezervasyon motoru" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="mcp-url">Uç nokta</Label>
        <Input id="mcp-url" defaultValue="https://mcp.doraholiday.com/mcp" />
      </div>
    </div>
  </AppSheet>
);
