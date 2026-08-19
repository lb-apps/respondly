import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "respondly";

export const Default = () => (
  <TooltipProvider>
    <Tooltip open>
      <TooltipTrigger asChild>
        <Button variant="outline">Devral</Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Asistanı durdurup konuşmayı sen sürdür</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
