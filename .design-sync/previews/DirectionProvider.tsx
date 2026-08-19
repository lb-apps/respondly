import { Button, DirectionProvider, Input } from "respondly";

export const RightToLeft = () => (
  <DirectionProvider dir="rtl">
    <div dir="rtl" className="grid w-72 gap-2">
      <Input placeholder="ابحث عن جهة اتصال" />
      <div className="flex gap-2">
        <Button size="sm">حفظ</Button>
        <Button size="sm" variant="outline">إلغاء</Button>
      </div>
    </div>
  </DirectionProvider>
);
