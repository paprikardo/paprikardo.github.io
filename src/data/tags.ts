// Interest tags for the paper radar. The weekly agent should only use these ids,
// and its prompt can be generated from this list (label + description).
export const tags = {
  "flavin-hydride": {
    label: "Flavin / NAD(P)H hydride transfer",
    description: "Design and engineering of flavoenzymes and NAD(P)H-dependent hydride transfer.",
  },
  plm: {
    label: "Protein language models",
    description: "ESM-style sequence models, embeddings, scaling, interpretability.",
  },
  "structure-prediction": {
    label: "Structure prediction",
    description: "AlphaFold-style structure and complex prediction, co-folding, dynamics.",
  },
  "plm-llm": {
    label: "PLM × LLM fusion",
    description: "Combining protein models with natural-language LLMs, agents, multimodal models.",
  },
  "design-models": {
    label: "Protein design models",
    description: "Generative backbone/sequence design: diffusion, flow matching, inverse folding.",
  },
  "function-prediction": {
    label: "Function prediction",
    description: "Predicting enzyme function, fitness, stability, binding from sequence/structure.",
  },
  "lab-in-loop": {
    label: "Wet lab in the loop",
    description: "Active learning, closed-loop / self-driving labs, design–build–test cycles.",
  },
  "ml-design": {
    label: "ML in protein design",
    description: "General machine-learning methodology applied to protein engineering.",
  },
  "data-generation": {
    label: "Data generation",
    description: "High-throughput assays and dataset creation for design and functional biology.",
  },
} as const;

export type TagId = keyof typeof tags;
