import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "respondly";
import { useForm } from "react-hook-form";

// react-hook-form is merged onto the bundle global (cfg.extraEntries), so the
// form context here is the same one FormField reads inside the bundle.
export const Default = () => {
  const form = useForm({
    defaultValues: { name: "Dora Hotel", slug: "dora hotel" },
    mode: "onChange",
  });

  return (
    <Form {...form}>
      <form className="grid w-full max-w-sm gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Otel adı</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>Misafirlere bu isimle görünürsünüz.</FormDescription>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="slug"
          rules={{ pattern: { value: /^[a-z0-9-]+$/, message: "Yalnızca harf, rakam ve tire." } }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adres</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-fit">
          Kaydet
        </Button>
      </form>
    </Form>
  );
};
