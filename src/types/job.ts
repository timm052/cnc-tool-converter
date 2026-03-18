export interface Job {
  id: string;
  name: string;
  description?: string;
  machineGroup?: string;
  toolIds: string[];
  createdAt: number;
  updatedAt: number;
}
