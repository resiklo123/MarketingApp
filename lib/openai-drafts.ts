import OpenAI from "openai";
import { z } from "zod";

const DraftsSchema = z.object({
  fb: z.object({
    caption: z.string(),
    hashtags: z.string(),
  }),
  ig: z.object({
    caption: z.string(),
    hashtags: z.string(),
  }),
  tiktok: z.object({
    caption: z.string(),
    hashtags: z.string(),
  }),
  youtube: z.object({
    title: z.string(),
    description: z.string(),
  }),
  website: z.object({
    snippet: z.string(),
  }),
});

export type DraftsJson = z.infer<typeof DraftsSchema>;

export type DraftPromptInput = {
  machine: string;
  topic: string;
  location?: string | null;
  ctaUrl: string;
  platforms: string[];
};

function buildUserPrompt(input: DraftPromptInput): string {
  const loc = input.location ? `Location: ${input.location}\n` : "";
  return [
    `Create social and web copy for Resiklo (waste / recycling / sustainability).`,
    `Machine: ${input.machine}`,
    `Topic: ${input.topic}`,
    loc,
    `Primary CTA URL (use verbatim in copy where appropriate): ${input.ctaUrl}`,
    `Requested platforms (only include these in JSON keys; still return full schema with empty strings for unused): ${input.platforms.join(", ")}`,
    ``,
    `Return ONLY valid JSON matching this shape (no markdown fences):`,
    `{`,
    `  "fb": { "caption": "...", "hashtags": "#tag1 #tag2" },`,
    `  "ig": { "caption": "...", "hashtags": "#tag1 #tag2" },`,
    `  "tiktok": { "caption": "...", "hashtags": "#tag1 #tag2" },`,
    `  "youtube": { "title": "...", "description": "..." },`,
    `  "website": { "snippet": "..." }`,
    `}`,
  ].join("\n");
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const body = fence ? fence[1]!.trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object found in model output");
  return body.slice(start, end + 1);
}

function parseDraftsOutput(raw: string): DraftsJson {
  const jsonText = extractJsonObject(raw);
  const parsed = JSON.parse(jsonText) as unknown;
  return DraftsSchema.parse(parsed);
}

export async function generateDraftsJson(input: DraftPromptInput): Promise<DraftsJson> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const client = new OpenAI({ apiKey });
  const system = `You are a marketing copywriter. Output strictly valid JSON. No markdown. Keep hashtags concise.`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: process.env.CONTENTOPS_OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: buildUserPrompt(input) },
        ],
      });
      const raw = completion.choices[0]?.message?.content ?? "";
      return parseDraftsOutput(raw);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("OpenAI drafting failed");
}
