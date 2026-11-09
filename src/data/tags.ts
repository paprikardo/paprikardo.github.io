// Interest tags for the paper radar — shared by the website and the weekly agent.
// label/description: shown on the site and given to Claude as the tag definitions.
// keywords: cheap pre-filter before Claude sees anything (lower-case substrings).
export const tags = {
  "flavin-hydride": {
    label: "Flavin / NAD(P)H hydride transfer",
    description: "Design and engineering of flavoenzymes, FAD/FMN cofactors and NAD(P)H-dependent hydride transfer.",
    keywords: ["flavin", "flavoenzyme", "flavoprotein", " fad", " fmn", "nadph", "nadh", "nad(p)h", "hydride", "oxidoreductase", "reductase", "ene-reductase", "old yellow enzyme", "monooxygenase", "cofactor"],
  },
  plm: {
    label: "Protein language models",
    description: "ESM-style sequence models, embeddings, scaling, interpretability.",
    keywords: ["protein language model", "plm", "esm-2", "esm2", "esm3", "esm c", "progen", "protein embedding", "sequence model"],
  },
  "structure-prediction": {
    label: "Structure prediction",
    description: "AlphaFold-style structure and complex prediction, co-folding, conformational ensembles.",
    keywords: ["structure prediction", "alphafold", "rosettafold", "co-folding", "cofolding", "boltz", "chai-1", "esmfold", "protein folding", "conformational ensemble"],
  },
  "plm-llm": {
    label: "PLM × LLM fusion",
    description: "Combining protein models with natural-language LLMs, multimodal models, LLM agents for biology.",
    keywords: ["large language model", "llm", "multimodal", "text-protein", "protein-text", "natural language", "agentic", "ai scientist", "agent"],
  },
  "design-models": {
    label: "Protein design models",
    description: "Generative backbone/sequence design: diffusion, flow matching, inverse folding, binder design.",
    keywords: ["protein design", "de novo design", "rfdiffusion", "proteinmpnn", "inverse folding", "binder design", "diffusion model", "flow matching", "generative model", "enzyme design"],
  },
  "function-prediction": {
    label: "Function prediction",
    description: "Predicting enzyme function, fitness, stability or binding from sequence/structure.",
    keywords: ["function prediction", "fitness prediction", "variant effect", "stability prediction", "ec number", "enzyme function", "mutational effect", "deep mutational", "zero-shot"],
  },
  "lab-in-loop": {
    label: "Wet lab in the loop",
    description: "Active learning, closed-loop and self-driving labs, design–build–test–learn cycles.",
    keywords: ["active learning", "closed-loop", "self-driving lab", "autonomous lab", "design-build-test", "lab-in-the-loop", "bayesian optimization", "directed evolution", "machine learning-guided"],
  },
  "ml-design": {
    label: "ML in protein design",
    description: "General machine-learning methodology applied to protein engineering.",
    keywords: ["machine learning", "deep learning", "neural network", "protein engineering", "transformer", "graph neural"],
  },
  "data-generation": {
    label: "Data generation",
    description: "High-throughput assays and dataset creation for design and functional biology.",
    keywords: ["high-throughput", "dataset", "benchmark", "deep mutational scanning", "screening", "massively parallel", "library", "ultrahigh-throughput"],
  },
} as const;

export type TagId = keyof typeof tags;
