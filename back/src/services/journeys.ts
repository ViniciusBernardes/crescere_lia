import {
  fetchIclinicaJourneys,
  isIclinicaIntegrationEnabled,
  type IclinicaJourney,
} from "./iclinica.js";

export interface JourneyItemDto {
  n: number;
  icon: string;
  title: string;
  sub: string;
  color: string;
  meda_dimension?: string | null;
  competencies?: string[];
  activation_signals?: string[];
  questions?: IclinicaJourney["questions"];
  attachments?: NonNullable<IclinicaJourney["attachments"]>;
}

const FALLBACK_JOURNEYS: JourneyItemDto[] = [
  { n: 1, icon: "🤗", title: "Acolhimento e Chegada", sub: '"Você não está sozinho"', color: "#8B6BB1" },
  { n: 2, icon: "🧩", title: "Compreendendo o TEA", sub: '"Informação que acolhe e aproxima"', color: "#9B75C7" },
  { n: 3, icon: "💭", title: "Sentimentos diante do diagnóstico", sub: '"Tudo que você sente merece espaço"', color: "#7B5BA8" },
  { n: 4, icon: "🔍", title: "Autoavaliação e Autopercepção", sub: '"Como você está, de verdade?"', color: "#6347A0" },
  { n: 5, icon: "🌱", title: "Cuidar de Si para Continuar", sub: '"Você também precisa de cuidado"', color: "#8B6BB1" },
  { n: 6, icon: "🛠️", title: "Estratégias de Manejo com a Criança", sub: '"Compreender antes de reagir"', color: "#9B75C7" },
  { n: 7, icon: "🤝", title: "A Rede de Apoio", sub: '"Cuidar é um trabalho coletivo"', color: "#7B5BA8" },
  { n: 8, icon: "📋", title: "Direitos, Deveres e Orientações", sub: '"Informação também é cuidado"', color: "#6347A0" },
  { n: 9, icon: "🌊", title: "Momentos de Crise", sub: '"Quando tudo parece demais"', color: "#8B6BB1" },
  { n: 10, icon: "⚡", title: "Como o Cérebro Aprende", sub: '"Entender o cérebro muda o cuidado"', color: "#9B75C7" },
  { n: 11, icon: "🌟", title: "Potencialidades, Identidade e Futuro", sub: '"Para além do diagnóstico"', color: "#7B5BA8" },
  { n: 12, icon: "🏫", title: "Escola, Sociedade e Inclusão", sub: '"Cuidar também é enfrentar o mundo"', color: "#6347A0" },
];

function formatSubtitle(subtitle: string | null): string {
  if (!subtitle) return "";
  const trimmed = subtitle.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed;
  return `"${trimmed}"`;
}

export function mapIclinicaJourney(j: IclinicaJourney): JourneyItemDto {
  return {
    n: j.number,
    icon: j.icon || "🗺️",
    title: j.title,
    sub: formatSubtitle(j.subtitle),
    color: j.color || "#8B6BB1",
    meda_dimension: j.meda_dimension,
    competencies: j.competencies ?? [],
    activation_signals: j.activation_signals ?? [],
    questions: j.questions ?? [],
    attachments: (j.attachments ?? []).filter((item) => Boolean(item.url)),
  };
}

export async function resolveJourneysForTenant(
  tenantSlug: string,
): Promise<{ journeys: JourneyItemDto[]; source: "iclinica" | "fallback" }> {
  if (!isIclinicaIntegrationEnabled()) {
    return { journeys: FALLBACK_JOURNEYS, source: "fallback" };
  }

  try {
    const remote = await fetchIclinicaJourneys(tenantSlug);
    if (remote.length === 0) {
      return { journeys: FALLBACK_JOURNEYS, source: "fallback" };
    }

    return {
      journeys: remote.map(mapIclinicaJourney).sort((a, b) => a.n - b.n),
      source: "iclinica",
    };
  } catch (error) {
    console.warn("[journeys] Falha ao carregar do iClinica:", error);
    return { journeys: FALLBACK_JOURNEYS, source: "fallback" };
  }
}

export function getFallbackJourneys(): JourneyItemDto[] {
  return FALLBACK_JOURNEYS;
}
