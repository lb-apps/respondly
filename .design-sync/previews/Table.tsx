import { Badge, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "respondly";

export const Default = () => (
  <Table>
    <TableCaption>Son 24 saatteki konuşmalar</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Kişi</TableHead>
        <TableHead>Kanal</TableHead>
        <TableHead>Durum</TableHead>
        <TableHead className="text-right">Son mesaj</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>Ayşe Yılmaz</TableCell>
        <TableCell>WhatsApp</TableCell>
        <TableCell><Badge variant="secondary">Asistan</Badge></TableCell>
        <TableCell className="text-right">2 dk önce</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>Mehmet Kaya</TableCell>
        <TableCell>WhatsApp</TableCell>
        <TableCell><Badge>Devralındı</Badge></TableCell>
        <TableCell className="text-right">18 dk önce</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>Zeynep Demir</TableCell>
        <TableCell>WhatsApp</TableCell>
        <TableCell><Badge variant="outline">Kapandı</Badge></TableCell>
        <TableCell className="text-right">dün</TableCell>
      </TableRow>
    </TableBody>
  </Table>
);
