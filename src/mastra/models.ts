/** Curated OpenRouter models offered in the assistant config UI. */
export interface ModelOption {
  id: string
  label: string
  hint: string
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "anthropic/claude-sonnet-5",
    label: "Claude Sonnet 5",
    hint: "Önerilen — en doğal Türkçe, kaynağa en sadık yanıtlar",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    hint: "Daha hızlı ve ekonomik, yanıtları biraz daha dağınık",
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    hint: "En ekonomik seçenek, tonu daha kalıpçı",
  },
  {
    id: "openai/gpt-5-mini",
    label: "GPT-5 mini",
    hint: "Dengeli kalite/maliyet",
  },
]

export const TONE_OPTIONS: { id: string; label: string }[] = [
  { id: "sıcak ve samimi", label: "Sıcak ve samimi" },
  { id: "kibar ve profesyonel", label: "Kibar ve profesyonel" },
  { id: "kısa ve net", label: "Kısa ve net" },
  { id: "neşeli ve enerjik", label: "Neşeli ve enerjik" },
]
