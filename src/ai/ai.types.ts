export interface CrystalCandidate {
  label: string;
  isCrystalRound: boolean;
  crystalFamily: string;
  aliases: string[];
  dominantColors: string[];
  transparency: string;
  pattern: string;
  inclusions: string;
  estimatedSizeMm: number;
  bbox: { x: number; y: number; width: number; height: number };
  confidence: Record<string, number>;
}

export interface BraceletCandidateInput {
  colors: string[];
  wristCm: number;
  referenceDescription?: string;
  inventory: Array<{
    materialId: string;
    name: string;
    colors: string[];
    transparency: string;
    pattern: string;
    specs: Array<{ specId: string; size: number; price: number }>;
  }>;
}

export interface GeneratedBraceletCandidate {
  title: string;
  rationale: string;
  beads: Array<{ materialId: string; specId: string }>;
}
