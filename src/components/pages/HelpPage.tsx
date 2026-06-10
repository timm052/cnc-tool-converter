import { Check, X, HelpCircle } from 'lucide-react';
import { registry } from '../../converters';

export default function HelpPage() {
  const formats = registry.getAllFormats();

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Page header */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-b border-slate-700">
        <HelpCircle size={20} className="text-blue-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Help &amp; Format Reference</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Supported file formats and what can be imported or exported.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/80 border-b border-slate-700">
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Format</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Extensions</th>
                <th className="px-4 py-2.5 text-center font-medium text-slate-400 w-20">Import</th>
                <th className="px-4 py-2.5 text-center font-medium text-slate-400 w-20">Export</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-400">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {formats.map((f) => (
                <tr key={f.id} className="bg-slate-800/30 hover:bg-slate-800/60">
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-slate-200">{f.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{f.description}</div>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-slate-400">
                    {f.fileExtensions.join(', ')}
                  </td>
                  <td className="px-4 py-3 align-top text-center">
                    {f.canImport
                      ? <Check size={16} className="inline text-emerald-400" />
                      : <X size={16} className="inline text-slate-600" />}
                  </td>
                  <td className="px-4 py-3 align-top text-center">
                    {f.canExport
                      ? <Check size={16} className="inline text-emerald-400" />
                      : <X size={16} className="inline text-slate-600" />}
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-slate-400">
                    {f.notes?.map((n, i) => <p key={i}>{n}</p>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-5 space-y-2">
          <h2 className="text-sm font-semibold text-slate-200">Tips</h2>
          <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
            <li>Use the <strong className="text-slate-300">Converter</strong> page to convert a file from one format to another.</li>
            <li>Use the <strong className="text-slate-300">Tool Manager</strong> to build and maintain a persistent tool library, independent of any single format.</li>
            <li>The <strong className="text-slate-300">CSV (spreadsheet)</strong> format is the app's own interchange format — use it for backups or to move a library between formats with no loss.</li>
            <li>Formats marked Import only cannot be used as a conversion target.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
