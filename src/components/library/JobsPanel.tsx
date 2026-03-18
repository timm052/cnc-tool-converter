import { useState, useMemo } from 'react';
import { X, Briefcase, Download, Trash2, Pencil, ChevronLeft, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { LibraryTool } from '../../types/libraryTool';
import type { Job } from '../../types/job';
import { loadJobs, saveJob, deleteJob, createJob } from '../../lib/jobStore';

// ── CSV export ────────────────────────────────────────────────────────────────

function downloadJobCsv(job: Job, tools: LibraryTool[]) {
  const jobTools = tools.filter(t => job.toolIds.includes(t.id));
  const header = ['T#', 'Description', 'Type', 'Diameter', 'Flutes', 'RPM', 'Feed'];
  const rows = jobTools.map(t => [
    `T${t.toolNumber}`,
    t.description ?? '',
    t.type,
    String(t.geometry?.diameter ?? ''),
    String(t.geometry?.numberOfFlutes ?? ''),
    String(t.cutting?.spindleRpm ?? ''),
    String(t.cutting?.feedCutting ?? ''),
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `${job.name.replace(/\s+/g, '-').toLowerCase()}-tools.csv`,
  });
  a.click();
}

// ── PDF export ────────────────────────────────────────────────────────────────

function downloadJobPdf(job: Job, tools: LibraryTool[]) {
  const jobTools = tools.filter(t => job.toolIds.includes(t.id));
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(job.name, 14, y);
  y += 8;

  if (job.description) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(job.description, 14, y);
    y += 6;
  }

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleDateString()}  •  ${jobTools.length} tool${jobTools.length !== 1 ? 's' : ''}`, 14, y);
  y += 10;

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('T#', 14, y);
  doc.text('Description', 28, y);
  doc.text('Diameter', 130, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  for (const t of jobTools) {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(`T${t.toolNumber}`, 14, y);
    doc.text(t.description ?? '', 28, y);
    doc.text(String(t.geometry?.diameter ?? ''), 130, y);
    y += 5;
  }

  doc.save(`${job.name.replace(/\s+/g, '-').toLowerCase()}-tools.pdf`);
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface JobsPanelProps {
  allTools: LibraryTool[];
  allMachineGroups: string[];
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function JobsPanel({ allTools, allMachineGroups, onClose }: JobsPanelProps) {
  const [jobs, setJobs] = useState<Job[]>(loadJobs);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  // Editor form state
  const [formName,        setFormName]        = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formGroup,       setFormGroup]       = useState('');
  const [formToolIds,     setFormToolIds]     = useState<Set<string>>(new Set());
  const [toolSearch,      setToolSearch]      = useState('');

  function openNew() {
    const job = createJob('New Job');
    setEditingJob(job);
    setFormName(job.name);
    setFormDescription('');
    setFormGroup('');
    setFormToolIds(new Set());
    setToolSearch('');
  }

  function openEdit(job: Job) {
    setEditingJob(job);
    setFormName(job.name);
    setFormDescription(job.description ?? '');
    setFormGroup(job.machineGroup ?? '');
    setFormToolIds(new Set(job.toolIds));
    setToolSearch('');
  }

  function handleSave() {
    if (!editingJob || !formName.trim()) return;
    const updated: Job = {
      ...editingJob,
      name:         formName.trim(),
      description:  formDescription.trim() || undefined,
      machineGroup: formGroup || undefined,
      toolIds:      [...formToolIds],
      updatedAt:    Date.now(),
    };
    saveJob(updated);
    const all = loadJobs();
    setJobs(all);
    setEditingJob(null);
  }

  function handleDelete(id: string) {
    deleteJob(id);
    setJobs(loadJobs());
  }

  function toggleTool(id: string) {
    setFormToolIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const filteredTools = useMemo(() => {
    const q = toolSearch.toLowerCase();
    if (!q) return allTools;
    return allTools.filter(t =>
      t.description.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q) ||
      String(t.toolNumber).includes(q),
    );
  }, [allTools, toolSearch]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700 shrink-0 flex items-center gap-3">
          <Briefcase size={16} className="text-slate-400 shrink-0" />
          <h2 className="text-base font-semibold text-slate-100 flex-1">Jobs</h2>
          {!editingJob && (
            <button
              type="button"
              onClick={openNew}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              + New Job
            </button>
          )}
          <button onClick={onClose} title="Close" className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* ── List view ── */}
          {!editingJob && (
            <>
              {jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <Briefcase size={36} className="text-slate-600" />
                  <p className="text-sm text-slate-400">No jobs yet.</p>
                  <p className="text-xs text-slate-500">Click &ldquo;+ New Job&rdquo; to create a tool list for a job or programme.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobs.map(job => {
                    const count = job.toolIds.length;
                    return (
                      <div key={job.id} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-100 truncate">{job.name}</p>
                            {job.description && (
                              <p className="text-xs text-slate-400 mt-0.5 truncate">{job.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEdit(job)}
                              title="Edit job"
                              className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(job.id)}
                              title="Delete job"
                              className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>{count} tool{count !== 1 ? 's' : ''}</span>
                          {job.machineGroup && <span>· {job.machineGroup}</span>}
                          <span>· {new Date(job.updatedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => downloadJobCsv(job, allTools)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 transition-colors"
                          >
                            <Download size={11} />
                            CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadJobPdf(job, allTools)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 transition-colors"
                          >
                            <FileText size={11} />
                            PDF
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Editor view ── */}
          {editingJob && (
            <div className="space-y-5">
              {/* Back button */}
              <button
                type="button"
                onClick={() => setEditingJob(null)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ChevronLeft size={13} />
                Back to jobs
              </button>

              {/* Name */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Job name</p>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Bracket Op1, Cover plate…"
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Description (optional)</p>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Notes about this job or programme…"
                  rows={2}
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Machine group */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Machine group (optional)</p>
                <select
                  value={formGroup}
                  onChange={e => setFormGroup(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">All groups</option>
                  {allMachineGroups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Tool checklist */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                  Tools ({formToolIds.size} selected)
                </p>
                <input
                  type="text"
                  value={toolSearch}
                  onChange={e => setToolSearch(e.target.value)}
                  placeholder="Search tools…"
                  className="w-full mb-2 px-2.5 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-700/60">
                  {filteredTools.length === 0 && (
                    <div className="px-3 py-4 text-xs text-slate-500 text-center">No tools match your search.</div>
                  )}
                  {filteredTools.map(t => (
                    <label
                      key={t.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-700/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formToolIds.has(t.id)}
                        onChange={() => toggleTool(t.id)}
                        className="w-3.5 h-3.5 rounded border-slate-500 bg-slate-700 text-blue-500"
                      />
                      <span className="font-mono text-xs text-blue-400 w-8 shrink-0">T{t.toolNumber}</span>
                      <span className="text-sm text-slate-300 flex-1 truncate">{t.description}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 shrink-0">{t.type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {editingJob && (
          <div className="px-5 py-4 border-t border-slate-700 shrink-0 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditingJob(null)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!formName.trim()}
              className={[
                'px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
                formName.trim()
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              Save Job
            </button>
          </div>
        )}
      </div>
    </>
  );
}
