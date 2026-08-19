import { ChartContainer, ChartTooltip, ChartTooltipContent } from "respondly";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

const data = [
  { day: "Pzt", konusma: 24 },
  { day: "Sal", konusma: 31 },
  { day: "Çar", konusma: 28 },
  { day: "Per", konusma: 40 },
  { day: "Cum", konusma: 52 },
  { day: "Cmt", konusma: 47 },
  { day: "Paz", konusma: 33 },
];

const config = {
  konusma: { label: "Konuşma", color: "var(--chart-1)" },
};

export const Bars = () => (
  <ChartContainer config={config} className="h-56 w-full max-w-md">
    <BarChart data={data}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
      <ChartTooltip content={<ChartTooltipContent />} />
      <Bar dataKey="konusma" fill="var(--color-konusma)" radius={6} />
    </BarChart>
  </ChartContainer>
);
