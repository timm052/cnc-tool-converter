import { useMemo } from 'react';
import {
  LayoutDashboard, AlertTriangle, Wrench, RefreshCw, ArrowLeftRight,
  Library, Plus, Package, Cpu,
} from 'lucide-react';
import type { Page } from '../../App';
import type { ToolManagerIntent } from './ToolManagerPage';
import { useLibrary } from '../../contexts/LibraryContext';
import { useMachines } from '../../contexts/MachineContext';
import { useSettings } from '../../contexts/SettingsContext';
import { isLowStock, isRegrindDue, countByType } from '../../lib/libraryStats';
import { getDueMachines } from '../../lib/maintenanceCheck';
import { loadLastSync } from '../../lib/remoteSync';

interface DashboardPageProps {
  onNavigate: (page: Page) => void;
  onOpenToolManager: (intent?: ToolManagerIntent) => void;
}

function Card({ title, icon: Icon, children, accent }: {
  title: string;
  icon: typeof LayoutDashboard;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon size={15} className={accent ?? 'text-slate-400'} />
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ViewLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
    >
      {children} →
    </button>
  );
}

export default function DashboardPage({ onNavigate, onOpenToolManager }: DashboardPageProps) {
  const { tools } = useLibrary();
  const { machines } = useMachines();
  const { settings } = useSettings();

  const lowStockTools = useMemo(() => tools.filter(isLowStock), [tools]);
  const regrindTools  = useMemo(() => tools.filter(isRegrindDue), [tools]);
  const topTypes      = useMemo(() => countByType(tools).slice(0, 5), [tools]);
  const dueMachines   = useMemo(() => getDueMachines(machines, settings.maintenanceLeadDays), [machines, settings.maintenanceLeadDays]);
  const lastSync      = useMemo(() => loadLastSync(), []);

  const goToToolLibrary = () => { onOpenToolManager(); onNavigate('tools'); };
  const goToLowStock    = () => { onOpenToolManager({ panel: 'low-stock' }); onNavigate('tools'); };
  const goToAddTool     = () => { onOpenToolManager({ openNew: true }); onNavigate('tools'); };

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* Page header */}
      <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-b border-slate-700">
        <LayoutDashboard size={20} className="text-blue-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            At-a-glance overview of your tool library and machines.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">

          {/* Library summary */}
          <Card title="Library" icon={Package} accent="text-blue-400">
            <p className="text-2xl font-semibold text-slate-100">{tools.length}</p>
            <p className="text-xs text-slate-500 -mt-2">tool{tools.length === 1 ? '' : 's'} in library</p>
            {topTypes.length > 0 && (
              <ul className="text-xs text-slate-400 space-y-1">
                {topTypes.map(({ type, count }) => (
                  <li key={type} className="flex items-center justify-between">
                    <span className="capitalize truncate">{type}</span>
                    <span className="text-slate-500">{count}</span>
                  </li>
                ))}
              </ul>
            )}
            <ViewLink onClick={goToToolLibrary}>Open Tool Library</ViewLink>
          </Card>

          {/* Low stock */}
          <Card title="Low Stock" icon={AlertTriangle} accent={lowStockTools.length > 0 ? 'text-red-400' : 'text-slate-400'}>
            <p className="text-2xl font-semibold text-slate-100">{lowStockTools.length}</p>
            <p className="text-xs text-slate-500 -mt-2">
              tool{lowStockTools.length === 1 ? '' : 's'} at or below reorder point
            </p>
            {lowStockTools.length > 0 && <ViewLink onClick={goToLowStock}>View low stock</ViewLink>}
          </Card>

          {/* Regrind due */}
          <Card title="Regrind Due" icon={Wrench} accent={regrindTools.length > 0 ? 'text-amber-400' : 'text-slate-400'}>
            <p className="text-2xl font-semibold text-slate-100">{regrindTools.length}</p>
            <p className="text-xs text-slate-500 -mt-2">
              tool{regrindTools.length === 1 ? '' : 's'} past the regrind threshold
            </p>
            {regrindTools.length > 0 && <ViewLink onClick={goToToolLibrary}>View Tool Library</ViewLink>}
          </Card>

          {/* Maintenance due */}
          <Card title="Maintenance Due" icon={Cpu} accent={dueMachines.length > 0 ? 'text-orange-400' : 'text-slate-400'}>
            <p className="text-2xl font-semibold text-slate-100">{dueMachines.length}</p>
            <p className="text-xs text-slate-500 -mt-2">
              machine{dueMachines.length === 1 ? '' : 's'} due for service
            </p>
            {dueMachines.length > 0 && (
              <ul className="text-xs text-slate-400 space-y-1">
                {dueMachines.slice(0, 5).map((m) => (
                  <li key={m.id} className="truncate">{m.name}</li>
                ))}
              </ul>
            )}
            {dueMachines.length > 0 && <ViewLink onClick={() => onNavigate('machines')}>View Machines</ViewLink>}
          </Card>

          {/* Sync status */}
          {settings.remoteDbUrl && (
            <Card title="Remote Sync" icon={RefreshCw} accent="text-cyan-400">
              <div className="text-xs text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Last pushed</span>
                  <span className="text-slate-300">
                    {lastSync.pushedAt ? new Date(lastSync.pushedAt).toLocaleString() : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last pulled</span>
                  <span className="text-slate-300">
                    {lastSync.pulledAt ? new Date(lastSync.pulledAt).toLocaleString() : '—'}
                  </span>
                </div>
                {lastSync.toolCount != null && (
                  <div className="flex items-center justify-between">
                    <span>Synced tools</span>
                    <span className="text-slate-300">{lastSync.toolCount}</span>
                  </div>
                )}
              </div>
              <ViewLink onClick={goToToolLibrary}>Manage sync</ViewLink>
            </Card>
          )}

          {/* Quick actions */}
          <Card title="Quick Actions" icon={LayoutDashboard} accent="text-violet-400">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onNavigate('converter')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-700 transition-colors"
              >
                <ArrowLeftRight size={14} />
                Convert files
              </button>
              <button
                type="button"
                onClick={goToToolLibrary}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-700 transition-colors"
              >
                <Library size={14} />
                Open Tool Library
              </button>
              <button
                type="button"
                onClick={goToAddTool}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-700 transition-colors"
              >
                <Plus size={14} />
                Add Tool
              </button>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
