export const PUG_ADMIN_CSS = `
  .ps-wrap { max-width: 900px; margin: 0 auto; padding: 28px 20px 80px; }
  .ps-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
  .ps-title { font-size: 22px; font-weight: 700; color: #f1f5f9; margin: 0; }
  .ps-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; transition: all 0.15s; }
  .ps-btn-primary { background: #3b82f6; color: #fff; }
  .ps-btn-primary:hover { background: #2563eb; }
  .ps-btn-ghost { background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.08); }
  .ps-btn-ghost:hover { background: rgba(255,255,255,0.09); color: #e2e8f0; }
  .ps-btn-danger { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
  .ps-btn-danger:hover { background: rgba(239,68,68,0.2); }
  .ps-btn-success { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.2); }
  .ps-btn-success:hover { background: rgba(34,197,94,0.25); }
  .ps-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .ps-empty { text-align: center; padding: 60px 20px; color: #475569; }
  .ps-empty p { margin: 8px 0 0; font-size: 14px; }

  /* Cards */
  .ps-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 20px 24px; display: flex; align-items: center; gap: 20px; margin-bottom: 10px; cursor: pointer; transition: all 0.15s; text-decoration: none; color: inherit; }
  .ps-card:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.12); }
  .ps-card-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .ps-card-icon-open { background: rgba(59,130,246,0.15); color: #60a5fa; }
  .ps-card-icon-invite { background: rgba(168,85,247,0.15); color: #c084fc; }
  .ps-card-icon-default { background: rgba(100,116,139,0.15); color: #94a3b8; }
  .ps-card-body { flex: 1; min-width: 0; }
  .ps-card-name { font-size: 15px; font-weight: 600; color: #f1f5f9; margin: 0 0 4px; }
  .ps-card-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .ps-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .ps-badge-open { background: rgba(59,130,246,0.15); color: #60a5fa; }
  .ps-badge-invite { background: rgba(168,85,247,0.15); color: #c084fc; }
  .ps-badge-active { background: rgba(34,197,94,0.15); color: #4ade80; }
  .ps-badge-inactive { background: rgba(100,116,139,0.12); color: #64748b; }
  .ps-badge-danger { background: rgba(239,68,68,0.15); color: #f87171; }
  .ps-badge-warning { background: rgba(234,179,8,0.15); color: #facc15; }
  .ps-badge-na { background: rgba(59,130,246,0.12); color: #60a5fa; }
  .ps-badge-emea { background: rgba(168,85,247,0.12); color: #c084fc; }
  .ps-badge-pacific { background: rgba(34,197,94,0.12); color: #4ade80; }
  .ps-card-detail { font-size: 12px; color: #64748b; }
  .ps-card-arrow { color: #334155; transition: color 0.15s; }
  .ps-card:hover .ps-card-arrow { color: #64748b; }

  /* Edit form */
  .ps-back { display: inline-flex; align-items: center; gap: 6px; color: #64748b; font-size: 13px; cursor: pointer; background: none; border: none; padding: 0; margin-bottom: 24px; transition: color 0.15s; }
  .ps-back:hover { color: #94a3b8; }
  .ps-form-title { font-size: 20px; font-weight: 700; color: #f1f5f9; margin: 0 0 28px; }
  .ps-section { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 24px; margin-bottom: 20px; }
  .ps-section-title { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; margin: 0 0 18px; }
  .ps-field { margin-bottom: 16px; }
  .ps-field:last-child { margin-bottom: 0; }
  .ps-label { display: block; font-size: 12px; font-weight: 500; color: #64748b; margin-bottom: 6px; }
  .ps-input { width: 100%; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 9px 12px; color: #e2e8f0; font-size: 14px; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
  .ps-input:focus { border-color: #3b82f6; }
  .ps-select { cursor: pointer; }
  .ps-select option { background: #1e293b; color: #e2e8f0; }
  .ps-row { display: grid; gap: 16px; }
  .ps-row-2 { grid-template-columns: 1fr 1fr; }
  .ps-row-3 { grid-template-columns: 1fr 1fr 1fr; }
  .ps-check-row { display: flex; align-items: center; gap: 10px; }
  .ps-check-row input[type=checkbox] { width: 16px; height: 16px; accent-color: #3b82f6; cursor: pointer; }
  .ps-check-label { font-size: 14px; color: #cbd5e1; cursor: pointer; }

  /* Pill toggles (for roles, regions) */
  .ps-pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .ps-pill { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: #94a3b8; transition: all 0.15s; user-select: none; }
  .ps-pill-active { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.3); color: #60a5fa; }
  .ps-pill:hover { border-color: rgba(255,255,255,0.2); }

  /* Filter tabs */
  .ps-tabs { display: flex; gap: 1px; margin-bottom: 20px; padding: 1px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; width: fit-content; }
  .ps-tab { padding: 6px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; background: transparent; color: #64748b; transition: all 0.15s; }
  .ps-tab:hover { color: #94a3b8; }
  .ps-tab-active { background: #3b82f6; color: #fff; }

  /* Save bar */
  .ps-save-bar { display: flex; align-items: center; gap: 12px; margin-top: 24px; }
  .ps-save-msg { font-size: 13px; display: flex; align-items: center; gap: 6px; }
  .ps-save-ok { color: #4ade80; }
  .ps-save-err { color: #f87171; }

  /* Spinner */
  .ps-spin { animation: ps-spin 1s linear infinite; }
  @keyframes ps-spin { to { transform: rotate(360deg); } }

  /* Status colors for lobby dashboard */
  .ps-status-open { background: rgba(34,197,94,0.15); color: #4ade80; }
  .ps-status-ready { background: rgba(234,179,8,0.15); color: #facc15; }
  .ps-status-drafting { background: rgba(59,130,246,0.15); color: #60a5fa; }
  .ps-status-map_vote { background: rgba(168,85,247,0.15); color: #c084fc; }
  .ps-status-banning { background: rgba(249,115,22,0.15); color: #fb923c; }
  .ps-status-in_progress { background: rgba(6,182,212,0.15); color: #22d3ee; }
  .ps-status-reporting { background: rgba(100,116,139,0.15); color: #94a3b8; }

  /* Region control cards */
  .ps-region-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; }
  .ps-region-card-open { border-color: rgba(34,197,94,0.3); }
  .ps-region-card-closing { border-color: rgba(234,179,8,0.3); }

  /* Map pool */
  .ps-map-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .ps-map-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .ps-map-type { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 16px; }
  .ps-map-type-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #475569; margin: 0 0 12px; }
  .ps-map-item { display: flex; align-items: center; gap: 8px; padding: 5px 0; }
  .ps-map-item input[type=checkbox] { width: 14px; height: 14px; accent-color: #3b82f6; cursor: pointer; flex-shrink: 0; }
  .ps-map-item label { font-size: 13px; color: #94a3b8; cursor: pointer; transition: color 0.1s; user-select: none; }
  .ps-map-item:has(input:checked) label { color: #e2e8f0; }
  .ps-map-empty { font-size: 12px; color: #334155; font-style: italic; }

  /* Time windows */
  .ps-tw { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; }
  .ps-tw-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .ps-tw-title { font-size: 12px; font-weight: 600; color: #64748b; }
`

export function formatDate(dateStr?: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
