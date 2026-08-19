import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentTitle,
} from "respondly";
import { Download, FileText } from "lucide-react";

export const Files = () => (
  <AttachmentGroup className="w-full max-w-sm">
    <Attachment>
      <AttachmentContent>
        <AttachmentTitle>Oda tipleri.pdf</AttachmentTitle>
        <AttachmentDescription>412 KB · PDF</AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction aria-label="İndir">
          <Download />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
    <Attachment>
      <AttachmentContent>
        <AttachmentTitle>Kahvaltı menüsü.docx</AttachmentTitle>
        <AttachmentDescription>88 KB · Word</AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions>
        <AttachmentAction aria-label="Aç">
          <FileText />
        </AttachmentAction>
      </AttachmentActions>
    </Attachment>
  </AttachmentGroup>
);
