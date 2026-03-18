/**
 * TemplatePickerPanel — slide-over that lists saved tool templates.
 *
 * User can:
 *  - Stamp out a new tool from a template (calls onStamp with next tool number)
 *  - Delete a template
 *
 * Templates are stored in IndexedDB via LibraryContext.
 */

import { useState } from 'react';
import { X, Copy, Trash2, BookTemplate } from 'lucide-react';
import { useLibrary } from '../../contexts/LibraryContext';
import type { LibraryTool } from '../../types/libraryTool';

interface TemplatePickerPanelProps {
  /** Next available tool number to suggest */
  nextToolNumber: number;
  onStamp:        (tool: LibraryTool) => void;
  onClose:        () => void;
}

export default function TemplatePickerPanel({ nextToolNumber, onStamp, onClose }: TemplatePickerPanelProps) {
  const { templates, deleteTemplate } = useLibrary();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleStamp(templateId: string) {
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) return;
    const now = Date.now();
    const tool: LibraryTool = {
      ...tmpl.toolData,
      id:          crypto.randomUUID(),
      toolNumber:  nextToolNumber,
      addedAt:     now,
      updatedAt:   now,
    };
    onStamp(tool);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[380px] bg-slate-800 border-l border-slate-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <BookTemplate size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-slate-100">New from Template</h2>
          </div>
          <button type="button" title="Close" onClick={onClose} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {templates.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <BookTemplate size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No templates yet</p>
              <p className="text-xs mt-1">Open a tool in the editor and click <span className="text-slate-300">Save as Template</span>.</p>
            </div>
          ) : (
            templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3 flex items-start justify-between gap-3 hover:border-slate-600 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{tmpl.name}</p>
                  {tmpl.description && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{tmpl.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                    <span className="capitalize">{tmpl.toolData.type}</span>
                    <span>Ø {tmpl.toolData.geometry.diameter} {tmpl.toolData.unit}</span>
                    {tmpl.toolData.geometry.numberOfFlutes && (
                      <span>{tmpl.toolData.geometry.numberOfFlutes}fl</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {confirmDeleteId === tmpl.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => { deleteTemplate(tmpl.id); setConfirmDeleteId(null); }}
                        className="px-2 py-1 rounded text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStamp(tmpl.id)}
                        title="Create tool from template"
                        className="p-1.5 rounded text-emerald-400 hover:text-white hover:bg-emerald-600/30 transition-colors"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(tmpl.id)}
                        title="Delete template"
                        className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-700 shrink-0">
          <p className="text-xs text-slate-500">
            Tool number <span className="text-slate-300 font-mono">T{nextToolNumber}</span> will be assigned.
            You can change it in the editor after stamping.
          </p>
        </div>
      </div>
    </>
  );
}
