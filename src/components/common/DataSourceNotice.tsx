import { AlertTriangle } from 'lucide-react';

interface DataSourceNoticeProps {
  label?: string;
  detail: string;
}

export function DataSourceNotice({ label = 'Demo data', detail }: DataSourceNoticeProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-200/80">{detail}</p>
      </div>
    </div>
  );
}
