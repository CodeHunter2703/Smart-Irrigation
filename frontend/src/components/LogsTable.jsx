import { RefreshCw, AlertTriangle, Info, CheckCircle2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const TYPE_CONFIG = {
    INFO: { icon: Info, cls: 'text-blue-500', bg: 'bg-blue-50', badge: 'badge-gray' },
    WARN: { icon: AlertTriangle, cls: 'text-amber-500', bg: 'bg-amber-50', badge: 'badge-yellow' },
    ERROR: { icon: AlertTriangle, cls: 'text-red-500', bg: 'bg-red-50', badge: 'badge-red' },
    OK: { icon: CheckCircle2, cls: 'text-green-500', bg: 'bg-green-50', badge: 'badge-green' },
}

function timeAgo(ts) {
    try { return formatDistanceToNow(new Date(ts), { addSuffix: true }) } catch { return ts }
}

function formatTs(ts) {
    try {
        const d = new Date(ts)
        return d.toLocaleString('en-IN', {
            month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false,
        })
    } catch { return ts }
}

export default function LogsTable({ logs, onRefresh }) {
    if (!logs || logs.length === 0) {
        return (
            <div className="card text-center py-16 text-surface-400">
                <RefreshCw size={24} className="mx-auto mb-3 opacity-40" />
                <p className="font-medium">No events logged yet</p>
                <p className="text-sm mt-1">Logs will appear as the system runs</p>
                <button onClick={onRefresh} className="btn-secondary mt-4 mx-auto">
                    Refresh
                </button>
            </div>
        )
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="section-title">Event Logs</h2>
                    <p className="text-sm text-surface-400 mt-0.5">{logs.length} events — most recent first</p>
                </div>
                <button
                    id="logs-refresh-btn"
                    onClick={onRefresh}
                    className="btn-secondary py-2 px-3 text-sm"
                >
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </div>

            <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-surface-100">
                                <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider w-24">
                                    Type
                                </th>
                                <th className="text-left px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
                                    Message
                                </th>
                                <th className="text-right px-5 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider w-44 hidden sm:table-cell">
                                    Timestamp
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, idx) => {
                                const cfg = TYPE_CONFIG[log.type] || TYPE_CONFIG['INFO']
                                const Icon = cfg.icon
                                return (
                                    <tr key={log._id || idx} className="log-row border-b border-surface-50 last:border-0">
                                        <td className="px-5 py-3.5">
                                            <span className={`${cfg.badge} text-xs gap-1`}>
                                                <Icon size={11} />
                                                {log.type || 'INFO'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-sm text-surface-800 font-medium">{log.message}</p>
                                            <p className="text-xs text-surface-400 mt-0.5 sm:hidden">{timeAgo(log.timestamp)}</p>
                                        </td>
                                        <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                                            <p className="text-xs text-surface-500 font-mono">{formatTs(log.timestamp)}</p>
                                            <p className="text-xs text-surface-400">{timeAgo(log.timestamp)}</p>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
