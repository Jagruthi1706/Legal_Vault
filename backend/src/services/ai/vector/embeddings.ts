const DIMENSIONS = 256;

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);

const hashToken = (token: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % DIMENSIONS;
};

export const embedLocal = (text: string): number[] => {
  const vector = new Array<number>(DIMENSIONS).fill(0);
  for (const token of tokenize(text)) {
    vector[hashToken(token)] += 1;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }
  return vector.map((value) => value / magnitude);
};

export interface EmbeddingClient {
  embed(text: string): Promise<number[]>;
}

export class LocalEmbeddingClient implements EmbeddingClient {
  async embed(text: string): Promise<number[]> {
    return embedLocal(text);
  }
}

export class OpenAIEmbeddingClient implements EmbeddingClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async embed(text: string): Promise<number[]> {
    const response = await this.fetchImpl('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: this.model, input: text }),
    });
    if (!response.ok) {
      throw new Error(`Embedding request failed (${response.status}).`);
    }
    const json = (await response.json()) as { data?: Array<{ embedding: number[] }> };
    const embedding = json.data?.[0]?.embedding;
    if (!embedding) {
      throw new Error('Embedding response did not include a vector.');
    }
    return embedding;
  }
}

export const createEmbeddingClient = (input: {
  provider: 'mock' | 'openai';
  apiKey?: string;
  embeddingModel: string;
}): EmbeddingClient => {
  if (input.provider === 'openai' && input.apiKey) {
    return new OpenAIEmbeddingClient(input.apiKey, input.embeddingModel);
  }
  return new LocalEmbeddingClient();
};
