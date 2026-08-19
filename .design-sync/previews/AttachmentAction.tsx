import { AttachmentAction } from "respondly";
import { Download, Trash2 } from "lucide-react";

export const Actions = () => (
  <div className="flex items-center gap-2">
    <AttachmentAction aria-label="İndir">
      <Download />
    </AttachmentAction>
    <AttachmentAction aria-label="Sil">
      <Trash2 />
    </AttachmentAction>
  </div>
);
