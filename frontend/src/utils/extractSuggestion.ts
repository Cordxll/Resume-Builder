/**
 * Extract the actual suggested content from an AI response.
 * Prioritizes structured format (IMPROVED: "...") then falls back to other patterns.
 */
export function extractSuggestion(text: string): string | null {
  if (!text) return null;

  // Pattern 1 (PRIORITY): Look for our structured format "IMPROVED:\n"..."
  // This is the format we explicitly request from the AI
  const improvedMatch = text.match(/IMPROVED:\s*\n?"([^"]+)"/i);
  if (improvedMatch && improvedMatch[1]) {
    return improvedMatch[1].trim();
  }

  // Pattern 2: Look for quoted content after common markers
  const markerPatterns = [
    /(?:IMPROVED|REVISED|SUGGESTION|UPDATED|REWRITTEN|HERE(?:'S| IS)):\s*\n*"([^"]{15,})"/i,
    /(?:Try|Revised|Suggestion|Improved):\s*"([^"]{15,})"/i,
  ];

  for (const pattern of markerPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Pattern 3: Content in double quotes that's at least 20 chars
  // Look for the longest quoted string (likely the full suggestion)
  const doubleQuoteMatches = text.match(/"([^"]{20,})"/g);
  if (doubleQuoteMatches && doubleQuoteMatches.length > 0) {
    // Filter out quotes that look like they're from the "CURRENT TEXT" section
    const validMatches = doubleQuoteMatches
      .map(m => m.slice(1, -1)) // Remove quotes
      .filter(m => !text.includes(`CURRENT TEXT:\n"${m}"`)); // Exclude original text

    if (validMatches.length > 0) {
      // Return the longest match (most likely to be the full suggestion)
      return validMatches.sort((a, b) => b.length - a.length)[0];
    }
  }

  // Pattern 4: After arrow format (Before → After)
  const arrowMatch = text.match(/(?:After|→)\s*:?\s*"([^"]{15,})"/i);
  if (arrowMatch && arrowMatch[1]) {
    return arrowMatch[1].trim();
  }

  // Pattern 5: Look for bullet point format (• or -)
  const bulletMatch = text.match(/[•\-]\s*([^\n]{20,})/);
  if (bulletMatch && bulletMatch[1]) {
    return bulletMatch[1].trim();
  }

  // Pattern 6: If response is short enough (under 250 chars) and looks like a single suggestion
  // (no multiple paragraphs, no "WHY:" section), use the whole thing
  const trimmed = text.trim();
  if (
    trimmed.length < 250 &&
    !trimmed.includes('\n\n') &&
    !trimmed.toLowerCase().includes('why:') &&
    !trimmed.toLowerCase().includes('current text')
  ) {
    return trimmed;
  }

  return null;
}

/**
 * Detect if a user message is a structured inline-edit prompt
 * (sent by handleAskAIForEdit) vs. a normal chat message.
 */
export function isInlineEditPrompt(text: string): boolean {
  return text.includes('CURRENT TEXT:') && text.includes('IMPROVED:');
}

/**
 * Extract a clean display version of an inline-edit user message.
 * Turns the structured prompt into something readable for the sidebar.
 */
export function formatUserEditMessage(text: string): string {
  if (!isInlineEditPrompt(text)) return text;

  const requestMatch = text.match(/REQUEST:\s*(.+?)(?:\n|$)/i);
  const request = requestMatch ? requestMatch[1].trim() : '';

  // Get a short preview of the text being edited
  const currentMatch = text.match(/CURRENT TEXT:\s*\n?"([^"]*?)"/i);
  const preview = currentMatch ? currentMatch[1].trim() : '';
  const shortPreview = preview.length > 60 ? preview.slice(0, 60) + '...' : preview;

  if (request && shortPreview) {
    return `${request}\n\nEditing: "${shortPreview}"`;
  }
  return request || text;
}

/**
 * Format an agent response for clean sidebar display.
 * Strips IMPROVED/WHY markers and shows a natural message.
 */
export function formatAgentEditResponse(text: string): string {
  if (!text) return text;

  // Check if this is a structured IMPROVED/WHY response
  const hasImproved = /IMPROVED:\s*\n?"/i.test(text);

  if (!hasImproved) return text;

  const suggestion = extractSuggestion(text);
  const explanation = extractExplanation(text);

  const parts: string[] = [];

  if (suggestion) {
    parts.push(`**Suggested:** "${suggestion}"`);
  }
  if (explanation) {
    parts.push(`\n${explanation}`);
  }

  return parts.length > 0 ? parts.join('\n') : text;
}

/**
 * Extract the explanation/reasoning from an AI response.
 * Looks for WHY: section or other explanatory patterns.
 */
export function extractExplanation(text: string): string | null {
  if (!text) return null;

  // Pattern 1: Look for WHY: section
  const whyMatch = text.match(/WHY:\s*\n?([\s\S]*?)$/i);
  if (whyMatch && whyMatch[1]?.trim()) {
    return whyMatch[1].trim();
  }

  // Pattern 2: Look for EXPLANATION: section
  const explainMatch = text.match(/EXPLANATION:\s*\n?([\s\S]*?)$/i);
  if (explainMatch && explainMatch[1]?.trim()) {
    return explainMatch[1].trim();
  }

  // Pattern 3: Look for REASON: section
  const reasonMatch = text.match(/REASON:\s*\n?([\s\S]*?)$/i);
  if (reasonMatch && reasonMatch[1]?.trim()) {
    return reasonMatch[1].trim();
  }

  // Pattern 4: Text after the quoted suggestion
  const afterQuoteMatch = text.match(/"[^"]{15,}"\s*\n+([\s\S]+)/);
  if (afterQuoteMatch && afterQuoteMatch[1]?.trim()) {
    const remainder = afterQuoteMatch[1].trim();
    // Clean up any label prefixes
    return remainder.replace(/^(WHY|EXPLANATION|REASON|CHANGES):\s*/i, '').trim();
  }

  return null;
}
