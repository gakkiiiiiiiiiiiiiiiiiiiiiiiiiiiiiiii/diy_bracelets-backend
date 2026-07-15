export interface BraceletCodeV1 {
  v: 1;
  wristCm: number;
  beads: Array<{ materialId: string; specId: string }>;
  styleRef?: string;
}
