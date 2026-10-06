/**
 * Compile-time stand-in for the optional peer `@huggingface/transformers`, so the core
 * type-checks without installing it. Only `pipeline` is used, and only through `embed.ts`.
 */
declare module '@huggingface/transformers' {
  export const pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<unknown>;
}
