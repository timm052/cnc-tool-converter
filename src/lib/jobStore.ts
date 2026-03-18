import type { Job } from '../types/job';

const KEY = 'cnc-tool-jobs';

export function loadJobs(): Job[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

function save(jobs: Job[]): void {
  localStorage.setItem(KEY, JSON.stringify(jobs));
}

export function saveJob(job: Job): void {
  const jobs = loadJobs();
  const idx = jobs.findIndex(j => j.id === job.id);
  if (idx >= 0) jobs[idx] = job; else jobs.push(job);
  save(jobs);
}

export function deleteJob(id: string): void {
  save(loadJobs().filter(j => j.id !== id));
}

export function createJob(name: string, description?: string, machineGroup?: string): Job {
  return { id: crypto.randomUUID(), name, description, machineGroup, toolIds: [], createdAt: Date.now(), updatedAt: Date.now() };
}
