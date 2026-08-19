import { Marker, MarkerContent, MarkerIcon } from "respondly";
import { Sparkles } from "lucide-react";

export const Default = () => (
  <div className="grid max-w-md gap-2">
    <Marker>
      <MarkerIcon>
        <Sparkles />
      </MarkerIcon>
      <MarkerContent>Asistan bu yanıtı bilgi kütüphanesinden üretti.</MarkerContent>
    </Marker>
  </div>
);
