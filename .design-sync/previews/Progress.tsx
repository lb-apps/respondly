import { Progress } from "respondly";

export const Steps = () => (
  <div className="grid w-full max-w-sm gap-4">
    <Progress value={0} />
    <Progress value={35} />
    <Progress value={70} />
    <Progress value={100} />
  </div>
);

export const Labelled = () => (
  <div className="grid w-full max-w-sm gap-2">
    <div className="flex items-center justify-between text-sm">
      <span>Belgeler işleniyor</span>
      <span className="text-muted-foreground">8 / 12</span>
    </div>
    <Progress value={66} />
  </div>
);
