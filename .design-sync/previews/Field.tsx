import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  Input,
} from "respondly";

export const Default = () => (
  <FieldSet className="max-w-sm">
    <FieldLegend>Organizasyon</FieldLegend>
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="field-name">Görünen ad</FieldLabel>
        <Input id="field-name" defaultValue="Dora Hotel" />
        <FieldDescription>Misafirlere bu isimle görünürsünüz.</FieldDescription>
      </Field>
      <Field data-invalid>
        <FieldLabel htmlFor="field-slug">Adres</FieldLabel>
        <Input id="field-slug" defaultValue="dora hotel" aria-invalid />
        <FieldError>Adres yalnızca harf, rakam ve tire içerebilir.</FieldError>
      </Field>
    </FieldGroup>
  </FieldSet>
);
