export interface JourneyRecommendation {
  number: number;
  reason?: string;
}

const JSON_OBJECT_RE =
  /\{\s*"journey_number"\s*:\s*(\d+)\s*(?:,\s*"reason"\s*:\s*"((?:\\.|[^"\\])*)")?\s*\}/i;

function parseRecommendationObject(raw: string): JourneyRecommendation | null {
  const match = raw.match(JSON_OBJECT_RE);
  if (!match) return null;

  const number = Number(match[1]);
  if (!Number.isFinite(number) || number < 1) return null;

  const reason = match[2]?.replace(/\\"/g, '"').trim();
  return { number, reason: reason || undefined };
}

function stripRecommendationFromReply(reply: string, rawJson: string): string {
  let cleaned = reply.replace(rawJson, "").trim();
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  return cleaned;
}

/**
 * Extrai o bloco JSON de recomendação de jornada (formato do prompt iClinica)
 * e remove da resposta visível ao cuidador.
 */
export function extractJourneyRecommendation(rawReply: string): {
  reply: string;
  recommendation: JourneyRecommendation | null;
} {
  const trimmed = rawReply.trim();
  if (!trimmed) {
    return { reply: rawReply, recommendation: null };
  }

  const fenced = trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);
  if (fenced) {
    const recommendation = parseRecommendationObject(fenced[1]);
    if (recommendation) {
      return {
        reply: stripRecommendationFromReply(trimmed, fenced[0]),
        recommendation,
      };
    }
  }

  const lines = trimmed.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line.startsWith("{")) continue;

    const recommendation = parseRecommendationObject(line);
    if (!recommendation) continue;

    const withoutLine = lines
      .slice(0, i)
      .concat(lines.slice(i + 1))
      .join("\n")
      .trim();

    return {
      reply: withoutLine || trimmed,
      recommendation,
    };
  }

  const inline = trimmed.match(JSON_OBJECT_RE);
  if (inline) {
    const recommendation = parseRecommendationObject(inline[0]);
    if (recommendation) {
      return {
        reply: stripRecommendationFromReply(trimmed, inline[0]),
        recommendation,
      };
    }
  }

  const fromText = extractJourneyNumberFromText(trimmed);
  if (fromText) {
    return { reply: trimmed, recommendation: fromText };
  }

  return { reply: rawReply, recommendation: null };
}

function extractJourneyNumberFromText(text: string): JourneyRecommendation | null {
  const patterns = [
    /jornada\s*(\d{1,2})\s*[—\-–:]/i,
    /jornada\s*(\d{1,2})\b/i,
    /\bJ(\d{1,2})\s*[—\-–:]/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const number = Number(match[1]);
    if (Number.isFinite(number) && number >= 1 && number <= 99) {
      return { number, reason: "mencionada na conversa" };
    }
  }

  return null;
}
