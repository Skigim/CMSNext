export interface Case {
  id: string;
  mcn: string;
  name: string;
  status: string;
  personId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}
