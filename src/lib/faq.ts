/**
 * Extracts Q&A pairs from a post's "## Frequently asked questions" section
 * (each question a bold line on its own, followed by its answer text) and
 * turns them into FAQPage JSON-LD — so the schema stays in sync with the
 * FAQ content instead of being duplicated by hand.
 */
/** Strips inline bold/italic markdown markers so schema text reads as plain prose. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractFaqSchema(body: string): Record<string, unknown> | null {
  const sectionMatch = body.match(/^##\s+Frequently asked questions\s*$([\s\S]*?)(?=^##\s|\s*$(?![\s\S]))/im);
  if (!sectionMatch) return null;

  const section = sectionMatch[1];
  const entries = [...section.matchAll(/^\*\*(.+?)\*\*\s*$\n([\s\S]*?)(?=^\*\*.+?\*\*\s*$|\s*$(?![\s\S]))/gm)];
  if (entries.length === 0) return null;

  const mainEntity = entries.map(([, question, answer]) => ({
    "@type": "Question",
    name: stripMarkdown(question),
    acceptedAnswer: {
      "@type": "Answer",
      text: stripMarkdown(answer),
    },
  }));

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}
