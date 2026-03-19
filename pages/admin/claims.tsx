import { useCallback, useEffect, useMemo, useState } from 'react';

type ClaimsFilter = 'pending' | 'settled' | 'failed' | 'all';
type ClaimStatus = 'pending' | 'processing' | 'settled' | 'failed';

type ActionLogEntry = {
  action: string;
  timestamp: string;
  admin?: string;
  utr_number?: string;
  failed_reason?: string;
};

type ClaimRow = {
  claimId?: string;
  sessionKey?: string;
  senderName?: string;
  recipientName?: string;
  phoneNumber?: string;
  upiId?: string;
  eidiAmount?: number | string;
  status?: string;
  claimedAt?: string;
  created_at?: string;
  settled_at?: string;
  paidAt?: string;
  failed_at?: string;
  utr_number?: string | null;
  notes?: string | null;
  failed_reason?: string | null;
  action_log?: ActionLogEntry[] | null;
};

const ADMIN_ID = 'admin';
const HIGH_VALUE_THRESHOLD = 10000;

function normalizeStatus(c: ClaimRow): ClaimStatus {
  const s = String(c?.status || 'pending').toLowerCase();
  if (s === 'paid') return 'settled';
  if (s === 'settled') return 'settled';
  if (s === 'processing') return 'processing';
  if (s === 'failed') return 'failed';
  return 'pending';
}

function parseIsoToMs(value?: string | null): number {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

function isSameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function formatInr(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatTime(d: Date): string {
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDurationHours(ms: number): string {
  if (ms < 0) return '—';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function statusRank(status: ClaimStatus): number {
  if (status === 'pending') return 0;
  if (status === 'processing') return 1;
  if (status === 'failed') return 2;
  return 3; // settled
}

function statusBadgeStyles(status: ClaimStatus): { pill: string; color: string; border: string; bg: string } {
  if (status === 'pending')
    return { pill: 'pending', color: '#fcd34d', border: 'rgba(251,191,36,0.45)', bg: 'rgba(251,191,36,0.14)' };
  if (status === 'processing')
    return { pill: 'processing', color: '#93c5fd', border: 'rgba(59,130,246,0.45)', bg: 'rgba(59,130,246,0.14)' };
  if (status === 'failed')
    return { pill: 'failed', color: '#fca5a5', border: 'rgba(248,113,113,0.55)', bg: 'rgba(248,113,113,0.18)' };
  return { pill: 'settled', color: '#86efac', border: 'rgba(34,197,94,0.45)', bg: 'rgba(34,197,94,0.12)' };
}

export default function AdminClaims() {
  const [secret, setSecret] = useState('');
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [allClaims, setAllClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimsFilter, setClaimsFilter] = useState<ClaimsFilter>('pending');

  const [sortKey, setSortKey] = useState<'time' | 'amount' | 'status'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [kpis, setKpis] = useState({
    pendingCount: 0,
    pendingAmount: 0,
    highValuePendingCount: 0,
    settledTodayAmount: 0,
    failedCount: 0
  });

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [activeModal, setActiveModal] = useState<
    | null
    | { kind: 'settle'; claim: ClaimRow }
    | { kind: 'fail'; claim: ClaimRow }
    | { kind: 'edit'; claim: ClaimRow }
    | { kind: 'logs'; claim: ClaimRow }
  >(null);

  const [modalUtr, setModalUtr] = useState('');
  const [modalNotes, setModalNotes] = useState('');

  const [modalFailedReason, setModalFailedReason] = useState('');
  const [modalFailedNotes, setModalFailedNotes] = useState('');

  const [modalBusy, setModalBusy] = useState(false);

  const [copyAnimKey, setCopyAnimKey] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (value: string, animKey?: string) => {
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      if (animKey) {
        setCopyAnimKey(animKey);
        window.setTimeout(
          () => setCopyAnimKey((cur) => (cur === animKey ? null : cur)),
          320
        );
      }
      return true;
    } catch {
      window.alert('Copy failed. Select the text manually.');
    }
    return false;
  }, []);

  const computeKpis = useCallback((rows: ClaimRow[]) => {
    const nowMs = Date.now();

    const amounts = (v: ClaimRow) => Number(v?.eidiAmount) || 0;

    const pendingRows = rows.filter((r) => normalizeStatus(r) === 'pending');
    const failedRows = rows.filter((r) => normalizeStatus(r) === 'failed');
    const settledRows = rows.filter((r) => normalizeStatus(r) === 'settled');

    const pendingAmount = pendingRows.reduce((sum, r) => sum + amounts(r), 0);
    const highValuePendingCount = pendingRows.filter((r) => amounts(r) > HIGH_VALUE_THRESHOLD).length;

    const settledTodayAmount = settledRows.reduce((sum, r) => {
      const settledMs = parseIsoToMs(r.settled_at) || parseIsoToMs(r.paidAt);
      if (!settledMs) return sum;
      return isSameLocalDay(settledMs, nowMs) ? sum + amounts(r) : sum;
    }, 0);

    return {
      pendingCount: pendingRows.length,
      pendingAmount,
      highValuePendingCount,
      settledTodayAmount,
      failedCount: failedRows.length
    };
  }, []);

  const fetchClaims = useCallback(
    async (filter: ClaimsFilter) => {
      if (!secret.trim()) return;
      setLoading(true);

      const headers = { Authorization: `Bearer ${secret.trim()}` };
      try {
        const [tableRes, allRes] = await Promise.all([
          fetch(`/api/admin/pending-claims?filter=${encodeURIComponent(filter)}`, { headers }),
          fetch(`/api/admin/pending-claims?filter=all`, { headers })
        ]);

        const tableJson = await tableRes.json().catch(() => ({}));
        const allJson = await allRes.json().catch(() => ({}));

        if (!tableRes.ok) {
          window.alert((tableJson as { error?: string }).error || 'Could not load claims.');
          setClaims([]);
          setAllClaims([]);
          return;
        }

        const tableRows = Array.isArray((tableJson as any).claims) ? (tableJson as any).claims : [];
        const allRows = Array.isArray((allJson as any).claims) ? (allJson as any).claims : [];

        setClaims(tableRows);
        setAllClaims(allRows);
        setKpis(computeKpis(allRows));
        setLastUpdated(new Date());
      } finally {
        setLoading(false);
      }
    },
    [computeKpis, secret]
  );

  useEffect(() => {
    if (!secret.trim()) return;
    void fetchClaims(claimsFilter);
  }, [claimsFilter, fetchClaims, secret]);

  const phoneCounts = useMemo(() => {
    const counts = {} as Record<string, number>;
    return allClaims.reduce((acc, c) => {
      const p = String(c?.phoneNumber || '').trim();
      if (!p) return acc;
      return { ...acc, [p]: (acc[p] || 0) + 1 };
    }, counts);
  }, [allClaims]);

  const upiCounts = useMemo(() => {
    const counts = {} as Record<string, number>;
    return allClaims.reduce((acc, c) => {
      const u = String(c?.upiId || '').trim();
      if (!u) return acc;
      return { ...acc, [u]: (acc[u] || 0) + 1 };
    }, counts);
  }, [allClaims]);

  const sortedClaims = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const rows = [...claims];

    const scoreTime = (r: ClaimRow) => parseIsoToMs(r.claimedAt) || parseIsoToMs(r.created_at);
    const scoreAmount = (r: ClaimRow) => Number(r?.eidiAmount) || 0;
    const scoreStatus = (r: ClaimRow) => statusRank(normalizeStatus(r));

    const compare = (a: ClaimRow, b: ClaimRow) => {
      if (sortKey === 'time') return (scoreTime(a) - scoreTime(b)) * dir;
      if (sortKey === 'amount') return (scoreAmount(a) - scoreAmount(b)) * dir;
      return (scoreStatus(a) - scoreStatus(b)) * dir;
    };

    return rows.sort(compare);
  }, [claims, sortDir, sortKey]);

  const openSettle = useCallback((claim: ClaimRow, kind: 'settle' | 'edit') => {
    setModalBusy(false);
    setModalUtr(String(claim?.utr_number || '').trim());
    setModalNotes(String(claim?.notes || '').trim());
    setActiveModal({ kind, claim });
  }, []);

  const openFail = useCallback((claim: ClaimRow) => {
    setModalBusy(false);
    setModalFailedReason('');
    setModalFailedNotes('');
    setActiveModal({ kind: 'fail', claim });
  }, []);

  const openLogs = useCallback((claim: ClaimRow) => {
    setModalBusy(false);
    setActiveModal({ kind: 'logs', claim });
  }, []);

  const closeModal = useCallback(() => {
    if (modalBusy) return;
    setActiveModal(null);
    setModalUtr('');
    setModalNotes('');
    setModalFailedReason('');
    setModalFailedNotes('');
  }, [modalBusy]);

  const confirmSafety = useCallback(() => {
    return window.confirm('Have you completed the UPI transfer?');
  }, []);

  const settleClaim = useCallback(async () => {
    if (!activeModal || (activeModal.kind !== 'settle' && activeModal.kind !== 'edit')) return;
    if (!secret.trim()) return;
    const claimId = activeModal.claim?.claimId;
    if (!claimId) {
      window.alert('Missing claimId.');
      return;
    }
    const utr = modalUtr.trim();
    if (!utr) {
      window.alert('UTR / Transaction ID is required.');
      return;
    }

    if (activeModal.kind === 'settle') {
      if (!confirmSafety()) return;
    } else {
      if (!window.confirm('Save edited UTR / notes?')) return;
    }

    setModalBusy(true);
    try {
      const endpoint = activeModal.kind === 'edit' ? '/api/admin/edit-settlement' : '/api/admin/mark-paid';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret.trim()}`
        },
        body: JSON.stringify({
          claimId,
          utr_number: utr,
          notes: modalNotes || null
        })
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(body.error || 'Settlement update failed.');
        return;
      }

      setActiveModal(null);
      void fetchClaims(claimsFilter);
    } finally {
      setModalBusy(false);
    }
  }, [activeModal, confirmSafety, claimsFilter, fetchClaims, modalNotes, modalUtr, secret]);

  const failClaim = useCallback(async () => {
    if (!activeModal || activeModal.kind !== 'fail') return;
    if (!secret.trim()) return;
    const claimId = activeModal.claim?.claimId;
    if (!claimId) {
      window.alert('Missing claimId.');
      return;
    }
    const reason = modalFailedReason.trim();
    if (!reason) {
      window.alert('Failed reason is required.');
      return;
    }

    if (!window.confirm('Mark this claim as failed? (records only)')) return;

    setModalBusy(true);
    try {
      const res = await fetch('/api/admin/mark-failed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret.trim()}`
        },
        body: JSON.stringify({
          claimId,
          failed_reason: reason,
          notes: modalFailedNotes || null
        })
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(body.error || 'Mark failed failed.');
        return;
      }

      setActiveModal(null);
      void fetchClaims(claimsFilter);
    } finally {
      setModalBusy(false);
    }
  }, [activeModal, claimsFilter, fetchClaims, modalFailedNotes, modalFailedReason, secret]);

  const statusFor = (claim: ClaimRow): ClaimStatus => normalizeStatus(claim);

  const renderStatusPill = (claim: ClaimRow) => {
    const st = statusFor(claim);
    const styles = statusBadgeStyles(st);
    const label = st === 'pending' ? 'Pending' : st === 'processing' ? 'Processing' : st === 'failed' ? 'Failed' : 'Settled';
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.04em',
          color: styles.color,
          background: styles.bg,
          border: `1px solid ${styles.border}`
        }}
      >
        {label}
      </span>
    );
  };

  const activeClaim = activeModal?.claim;
  const activeStatus = activeClaim ? normalizeStatus(activeClaim) : 'pending';
  const activeAmount = activeClaim ? Number(activeClaim.eidiAmount) || 0 : 0;
  const activeLogs = (activeClaim?.action_log && Array.isArray(activeClaim.action_log) ? activeClaim.action_log : []) as ActionLogEntry[];

  return (
    <div className="sv-admin-root">
      <style>{`
        .sv-admin-root{
          min-height:100vh;
          background: radial-gradient(ellipse 120% 80% at 50% -20%, rgba(198,168,90,0.20), transparent 55%),
                      radial-gradient(ellipse 90% 60% at 90% 40%, rgba(30,58,138,0.18), transparent 50%),
                      linear-gradient(180deg,#030712 0%, #020617 40%, #000 100%);
          color:#e2e8f0;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .sv-admin-shell{
          max-width:1320px;
          margin:0 auto;
          padding:24px 16px 56px;
        }
        .sv-admin-header{
          display:flex;
          flex-direction:column;
          gap:6px;
          align-items:center;
          margin: 10px 0 18px;
        }
        .sv-admin-brandRow{
          display:flex;
          flex-wrap:wrap;
          align-items:baseline;
          justify-content:center;
          gap:10px;
        }
        .sv-admin-wordmark{
          font-family: ui-serif, Georgia, "Times New Roman", serif;
          font-size:22px;
          font-style:italic;
          letter-spacing:0.02em;
        }
        .sv-admin-product{
          font-size:12px;
          font-weight:900;
          letter-spacing:0.12em;
          color:#c6a87c;
          text-transform:uppercase;
        }
        .sv-admin-badge{
          font-size:10px;
          font-weight:900;
          letter-spacing:0.12em;
          text-transform:uppercase;
          padding:6px 10px;
          border-radius:999px;
          border:1px solid rgba(198,168,90,0.32);
          background: rgba(198,168,90,0.12);
          color:#e8d5b5;
        }
        .sv-admin-tagline{
          color:#94a3b8;
          font-size:14px;
          margin:0;
        }
        .sv-admin-loginCard{
          max-width:480px;
          margin: 38px auto 0;
          border-radius:20px;
          background: linear-gradient(165deg, rgba(15,23,42,0.82), rgba(2,6,23,0.92));
          border:1px solid rgba(148,163,184,0.12);
          box-shadow: 0 24px 80px rgba(0,0,0,0.55);
          padding:24px 22px;
          text-align:center;
        }
        .sv-admin-input{
          width:100%;
          box-sizing:border-box;
          margin-top:14px;
          padding:12px 14px;
          border-radius:12px;
          border:1px solid rgba(148,163,184,0.22);
          background: rgba(2,6,23,0.65);
          color:#f8fafc;
          outline:none;
        }
        .sv-admin-input:focus{
          border-color: rgba(198,168,90,0.55);
          box-shadow: 0 0 0 4px rgba(198,168,90,0.10);
        }
        .sv-admin-toolbar{
          display:flex;
          flex-wrap:wrap;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          margin: 18px 0 14px;
        }
        .sv-admin-seg{
          display:inline-flex;
          padding:4px;
          border-radius:14px;
          border:1px solid rgba(148,163,184,0.12);
          background: rgba(15,23,42,0.6);
          gap:6px;
        }
        .sv-admin-segBtn{
          cursor:pointer;
          border: none;
          padding:10px 14px;
          border-radius:10px;
          background: transparent;
          color:#94a3b8;
          font-size:13px;
          font-weight:800;
          letter-spacing:0.01em;
        }
        .sv-admin-segBtn:hover:not(:disabled){
          background: rgba(255,255,255,0.04);
          color:#e2e8f0;
        }
        .sv-admin-segBtn--active{
          background: linear-gradient(135deg, #c6a87c, #d4bc94);
          color:#020617;
          box-shadow: 0 6px 24px rgba(198,168,90,0.20);
        }
        .sv-admin-btn{
          cursor:pointer;
          border-radius:10px;
          padding:10px 14px;
          border:1px solid rgba(148,163,184,0.18);
          background: rgba(30,41,59,0.85);
          color:#e2e8f0;
          font-weight:800;
          font-size:13px;
        }
        .sv-admin-btn:hover{ filter: brightness(1.05); }
        .sv-admin-btn:disabled{ opacity:0.6; cursor:not-allowed; }
        .sv-admin-btnPrimary{
          background: rgba(34,197,94,0.20);
          border-color: rgba(34,197,94,0.35);
          color:#bbf7d0;
        }
        .sv-admin-btnDanger{
          background: rgba(248,113,113,0.16);
          border-color: rgba(248,113,113,0.34);
          color:#fecaca;
        }
        .sv-admin-select{
          padding:10px 12px;
          border-radius:10px;
          background: rgba(30,41,59,0.85);
          color:#e2e8f0;
          border:1px solid rgba(148,163,184,0.18);
          outline:none;
          font-weight:800;
        }
        .sv-admin-kpiGrid{
          display:grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap:12px;
          margin-bottom: 14px;
        }
        .sv-admin-kpiCard{
          border-radius:18px;
          border:1px solid rgba(148,163,184,0.10);
          background: linear-gradient(160deg, rgba(15,23,42,0.72), rgba(2,6,23,0.9));
          padding:16px 16px;
        }
        .sv-admin-kpiLabel{
          color:#64748b;
          font-size:11px;
          font-weight:1000;
          letter-spacing:0.12em;
          text-transform:uppercase;
        }
        .sv-admin-kpiValue{
          margin-top:8px;
          font-size:26px;
          font-weight:1000;
          color:#f8fafc;
          letter-spacing:-0.02em;
        }
        .sv-admin-kpiSub{
          margin-top:6px;
          color:#94a3b8;
          font-size:13px;
        }
        .sv-admin-kpi--amber .sv-admin-kpiLabel{ color:#ca8a04; }
        .sv-admin-kpi--amber .sv-admin-kpiValue{ color:#fde68a; }
        .sv-admin-kpi--green .sv-admin-kpiLabel{ color:#16a34a; }
        .sv-admin-kpi--green .sv-admin-kpiValue{ color:#86efac; }
        .sv-admin-kpi--slate .sv-admin-kpiLabel{ color:#94a3b8; }

        .sv-admin-tableCard{
          border-radius:20px;
          overflow:hidden;
          border:1px solid rgba(148,163,184,0.12);
          background: rgba(2,6,23,0.45);
          box-shadow: 0 24px 80px rgba(0,0,0,0.45);
        }
        .sv-admin-tableWrap{
          overflow:auto;
          max-height: 66vh;
        }
        table{
          width:100%;
          border-collapse:separate;
          border-spacing:0;
          font-size:13px;
        }
        thead th{
          position:sticky;
          top:0;
          z-index:2;
          text-align:left;
          padding:12px 12px;
          font-size:11px;
          font-weight:1000;
          letter-spacing:0.10em;
          text-transform:uppercase;
          color:#64748b;
          background: rgba(15,23,42,0.98);
          border-bottom: 1px solid rgba(148,163,184,0.12);
          backdrop-filter: blur(8px);
          white-space:nowrap;
        }
        tbody td{
          padding:10px 12px;
          vertical-align:top;
          color:#cbd5e1;
          border-bottom: 1px solid rgba(148,163,184,0.06);
        }
        tbody tr:hover td{
          background: rgba(198,168,90,0.04);
        }
        .sv-admin-mono{
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
          font-size:12px;
          color:#e2e8f0;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
          max-width: 180px;
          display:inline-block;
          vertical-align:bottom;
        }
        .sv-admin-actions{
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          align-items:center;
        }
        .sv-admin-muted{
          color:#94a3b8;
          font-size:12px;
          margin-top:6px;
          line-height:1.35;
        }
        .sv-admin-flag{
          display:inline-flex;
          padding:4px 10px;
          border-radius:999px;
          border:1px solid rgba(148,163,184,0.18);
          background: rgba(148,163,184,0.10);
          color:#94a3b8;
          font-weight:900;
          font-size:11px;
          letter-spacing:0.03em;
          text-transform:uppercase;
          margin-right:8px;
        }

        .sv-admin-modalOverlay{
          position:fixed;
          inset:0;
          background: rgba(0,0,0,0.70);
          display:flex;
          align-items:center;
          justify-content:center;
          padding: 20px;
          z-index: 1000;
        }
        .sv-admin-modal{
          width: min(720px, 100%);
          border-radius:18px;
          border:1px solid rgba(148,163,184,0.14);
          background: linear-gradient(165deg, rgba(15,23,42,0.92), rgba(2,6,23,0.96));
          box-shadow: 0 30px 120px rgba(0,0,0,0.65);
          overflow:hidden;
        }
        .sv-admin-modalHeader{
          padding: 16px 18px;
          border-bottom: 1px solid rgba(148,163,184,0.12);
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:12px;
        }
        .sv-admin-modalTitle{
          margin:0;
          font-size:16px;
          font-weight:1000;
          color:#f1f5f9;
        }
        .sv-admin-modalBody{
          padding: 16px 18px 18px;
        }
        .sv-admin-close{
          background: rgba(15,23,42,0.6);
          border: 1px solid rgba(148,163,184,0.18);
          color:#cbd5e1;
          border-radius:10px;
          padding:8px 12px;
          cursor:pointer;
          font-weight:900;
        }
        .sv-admin-fieldLabel{
          font-size:11px;
          letter-spacing:0.12em;
          text-transform:uppercase;
          color:#64748b;
          font-weight:1000;
          margin-bottom:8px;
        }
        textarea.sv-admin-textarea, input.sv-admin-input2{
          width:100%;
          padding: 12px 12px;
          border-radius:12px;
          border:1px solid rgba(148,163,184,0.20);
          background: rgba(2,6,23,0.65);
          color:#f8fafc;
          outline:none;
          font-weight:700;
        }
        textarea.sv-admin-textarea{
          min-height: 90px;
          resize: vertical;
        }
        textarea.sv-admin-textarea:focus, input.sv-admin-input2:focus{
          border-color: rgba(198,168,90,0.55);
          box-shadow: 0 0 0 4px rgba(198,168,90,0.10);
        }
        .sv-admin-grid2{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap:12px;
        }
        @media (max-width: 720px){
          .sv-admin-grid2{ grid-template-columns: 1fr; }
        }
        .sv-admin-logs{
          border-radius:14px;
          border:1px solid rgba(148,163,184,0.12);
          background: rgba(15,23,42,0.5);
          padding: 12px 12px;
          max-height: 320px;
          overflow:auto;
        }
        .sv-admin-logItem{
          padding:10px 10px;
          border-radius:12px;
          border:1px solid rgba(148,163,184,0.08);
          background: rgba(2,6,23,0.35);
          margin-bottom:10px;
        }
        .sv-admin-logAction{
          font-weight:1000;
          color:#e2e8f0;
        }
        .sv-admin-logMeta{
          margin-top:6px;
          color:#94a3b8;
          font-size:12px;
          line-height:1.35;
        }
        @keyframes sv-copy-pop{
          0% { transform: scale(1); }
          30% { transform: scale(0.92); }
          65% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div className="sv-admin-shell">
        <header className="sv-admin-header">
          <div className="sv-admin-brandRow">
            <span className="sv-admin-wordmark">SealedVow</span>
            <span className="sv-admin-product">EIDI CLAIMS</span>
            <span className="sv-admin-badge">Admin</span>
          </div>
          <p className="sv-admin-tagline">Payouts are done manually via UPI — this console records settlement data for audit.</p>
        </header>

        {!secret.trim() ? (
          <div className="sv-admin-loginCard">
            <div className="sv-admin-product" style={{ color: '#c6a87c', letterSpacing: '0.18em' }}>
              Enter admin secret
            </div>
            <p className="sv-admin-muted" style={{ marginTop: 10, marginBottom: 0 }}>
              This page lists claims and lets you record UTR / reasons. It does not send money.
            </p>
            <input
              type="password"
              className="sv-admin-input"
              placeholder="Admin secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="off"
            />
          </div>
        ) : (
          <>
            <div className="sv-admin-toolbar">
              <div className="sv-admin-seg" role="tablist" aria-label="Claims filter">
                {(['pending', 'settled', 'failed', 'all'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={key === claimsFilter ? 'sv-admin-segBtn sv-admin-segBtn--active' : 'sv-admin-segBtn'}
                    onClick={() => {
                      setClaimsFilter(key);
                      void fetchClaims(key);
                    }}
                    disabled={loading}
                  >
                    {key === 'pending' ? 'Yet to settle' : key === 'settled' ? 'Settled' : key === 'failed' ? 'Failed' : 'All'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="sv-admin-select"
                  value={`${sortKey}:${sortDir}`}
                  onChange={(e) => {
                    const [k, d] = e.target.value.split(':');
                    setSortKey(k as any);
                    setSortDir(d as any);
                  }}
                  disabled={loading}
                  aria-label="Sort"
                >
                  <option value="time:desc">Sort: Time (new → old)</option>
                  <option value="time:asc">Sort: Time (old → new)</option>
                  <option value="amount:desc">Sort: Amount (high → low)</option>
                  <option value="amount:asc">Sort: Amount (low → high)</option>
                  <option value="status:asc">Sort: Status (priority)</option>
                  <option value="status:desc">Sort: Status (reverse)</option>
                </select>

                <button
                  type="button"
                  className="sv-admin-btn"
                  onClick={() => void fetchClaims(claimsFilter)}
                  disabled={loading}
                >
                  {loading ? 'Loading…' : `Refresh${lastUpdated ? '' : ''}`}
                </button>
              </div>
            </div>

            <div className="sv-admin-kpiGrid">
              <div className="sv-admin-kpiCard sv-admin-kpi--amber">
                <div className="sv-admin-kpiLabel">Pending total</div>
                <div className="sv-admin-kpiValue">₹{formatInr(kpis.pendingAmount)}</div>
                <div className="sv-admin-kpiSub">{kpis.pendingCount} pending claims</div>
              </div>
              <div className="sv-admin-kpiCard sv-admin-kpi--green">
                <div className="sv-admin-kpiLabel">Settled today</div>
                <div className="sv-admin-kpiValue">₹{formatInr(kpis.settledTodayAmount)}</div>
                <div className="sv-admin-kpiSub">Recorded settlements (local day)</div>
              </div>
              <div className="sv-admin-kpiCard sv-admin-kpi--slate">
                <div className="sv-admin-kpiLabel">High value pending</div>
                <div className="sv-admin-kpiValue">{kpis.highValuePendingCount}</div>
                <div className="sv-admin-kpiSub">Amount &gt; ₹{formatInr(HIGH_VALUE_THRESHOLD)}</div>
              </div>
            </div>

            <div className="sv-admin-tableCard">
              {loading ? (
                <div style={{ padding: 18, color: '#94a3b8' }}>Loading…</div>
              ) : sortedClaims.length === 0 ? (
                <div style={{ padding: 18, color: '#94a3b8' }}>
                  No claims in this view.
                </div>
              ) : (
                <div className="sv-admin-tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Receiver</th>
                        <th>Phone</th>
                        <th>UPI</th>
                        <th>Amount</th>
                        <th>Sender</th>
                        <th>Claimed</th>
                        <th>Pending age</th>
                        <th>Session</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedClaims.map((c) => {
                        const st = normalizeStatus(c);
                        const amount = Number(c.eidiAmount) || 0;
                        const phone = String(c.phoneNumber || '').trim();
                        const upi = String(c.upiId || '').trim();

                        const isDupPhone = phone ? (phoneCounts[phone] || 0) > 1 : false;
                        const isDupUpi = upi ? (upiCounts[upi] || 0) > 1 : false;
                        const isHighValue = st === 'pending' && amount > HIGH_VALUE_THRESHOLD;

                        const claimedMs = parseIsoToMs(c.claimedAt) || parseIsoToMs(c.created_at);
                        const ageLabel =
                          st === 'pending' && claimedMs ? formatDurationHours(Date.now() - claimedMs) : '—';

                        return (
                          <tr key={c.claimId || `${c.sessionKey || ''}-${phone}-${upi}`}>
                            <td>
                              <div>{renderStatusPill(c)}</div>
                              {isHighValue ? <div className="sv-admin-flag">High value</div> : null}
                              {st === 'pending' && (isDupPhone || isDupUpi) ? (
                                <div style={{ marginTop: 8, fontSize: 12, color: '#fca5a5', fontWeight: 900 }}>
                                  {isDupPhone ? 'Duplicate phone' : ''}{isDupPhone && isDupUpi ? ' · ' : ''}{isDupUpi ? 'Duplicate UPI' : ''}
                                </div>
                              ) : null}
                            </td>

                            <td>
                              <div style={{ fontWeight: 900, color: '#e2e8f0' }}>{c.recipientName || '—'}</div>
                              <div className="sv-admin-muted">Session: {c.sessionKey ? <span className="sv-admin-mono">{c.sessionKey}</span> : '—'}</div>
                            </td>

                            <td>
                              {phone ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span className="sv-admin-mono" style={{ maxWidth: 140 }}>{phone}</span>
                                  <button
                                    type="button"
                                    className="sv-admin-btn"
                                    style={{
                                      padding: 0,
                                      width: 34,
                                      height: 34,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderRadius: 10,
                                      fontSize: 14,
                                      lineHeight: '14px',
                                      transformOrigin: 'center',
                                      animation: copyAnimKey === `ph-${c.claimId || ''}` ? 'sv-copy-pop 320ms ease' : 'none'
                                    }}
                                    onClick={() => void copyToClipboard(phone, `ph-${c.claimId || ''}`)}
                                    title="Copy phone"
                                    aria-label="Copy phone"
                                  >
                                    []
                                  </button>
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>

                            <td>
                              {upi ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span className="sv-admin-mono" style={{ maxWidth: 160 }}>{upi}</span>
                                  <button
                                    type="button"
                                    className="sv-admin-btn"
                                    style={{
                                      padding: 0,
                                      width: 34,
                                      height: 34,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderRadius: 10,
                                      fontSize: 14,
                                      lineHeight: '14px',
                                      transformOrigin: 'center',
                                      animation: copyAnimKey === `upi-${c.claimId || ''}` ? 'sv-copy-pop 320ms ease' : 'none'
                                    }}
                                    onClick={() => void copyToClipboard(upi, `upi-${c.claimId || ''}`)}
                                    title="Copy UPI"
                                    aria-label="Copy UPI"
                                  >
                                    []
                                  </button>
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>

                            <td style={{ color: '#fde68a', fontWeight: 1000 }}>₹{formatInr(amount)}</td>

                            <td>{c.senderName || '—'}</td>

                            <td style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              {claimedMs ? formatTime(new Date(claimedMs)) : '—'}
                            </td>

                            <td style={{ color: '#94a3b8' }}>{ageLabel}</td>

                            <td>
                              {c.sessionKey ? <span className="sv-admin-mono">{c.sessionKey}</span> : '—'}
                            </td>

                            <td>
                              <div className="sv-admin-actions">
                                {st === 'pending' ? (
                                  <>
                                    <button type="button" className="sv-admin-btn sv-admin-btnPrimary" onClick={() => openSettle(c, 'settle')}>
                                      Settle
                                    </button>
                                    <button type="button" className="sv-admin-btn sv-admin-btnDanger" onClick={() => openFail(c)}>
                                      Fail
                                    </button>
                                    <button type="button" className="sv-admin-btn" onClick={() => openLogs(c)}>
                                      Logs
                                    </button>
                                  </>
                                ) : st === 'settled' ? (
                                  <>
                                    <button type="button" className="sv-admin-btn" onClick={() => openSettle(c, 'edit')}>
                                      Edit UTR/Notes
                                    </button>
                                    <button type="button" className="sv-admin-btn sv-admin-btnDanger" onClick={() => void fetch('/api/admin/revert-claim-pending', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret.trim()}` },
                                      body: JSON.stringify({ claimId: c.claimId })
                                    }).then(async (r) => {
                                      const b = await r.json().catch(() => ({}));
                                      if (!r.ok) window.alert(b.error || 'Undo failed.');
                                      else void fetchClaims(claimsFilter);
                                    })}>
                                      Undo
                                    </button>
                                    <button type="button" className="sv-admin-btn" onClick={() => openLogs(c)}>
                                      Logs
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button type="button" className="sv-admin-btn sv-admin-btnDanger" onClick={() => void fetch('/api/admin/revert-claim-pending', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret.trim()}` },
                                      body: JSON.stringify({ claimId: c.claimId })
                                    }).then(async (r) => {
                                      const b = await r.json().catch(() => ({}));
                                      if (!r.ok) window.alert(b.error || 'Undo failed.');
                                      else void fetchClaims(claimsFilter);
                                    })}>
                                      Undo
                                    </button>
                                    <button type="button" className="sv-admin-btn sv-admin-btnPrimary" onClick={() => openSettle(c, 'settle')}>
                                      Settle anyway
                                    </button>
                                    <button type="button" className="sv-admin-btn" onClick={() => openLogs(c)}>
                                      Logs
                                    </button>
                                  </>
                                )}
                              </div>
                              {st === 'failed' ? (
                                <div className="sv-admin-muted" style={{ marginTop: 8 }}>
                                  Reason: <span style={{ color: '#fecaca', fontWeight: 900 }}>{c.failed_reason || '—'}</span>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="sv-admin-muted" style={{ marginTop: 14 }}>
              {lastUpdated ? `Last loaded: ${formatTime(lastUpdated)}` : null} · Manual UPI transfer is required before settlement is recorded.
            </div>
          </>
        )}

        {activeModal ? (
          <div className="sv-admin-modalOverlay" onClick={closeModal} role="dialog" aria-modal="true">
            <div className="sv-admin-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sv-admin-modalHeader">
                <h3 className="sv-admin-modalTitle">
                  {activeModal.kind === 'settle'
                    ? 'Settle payout (record UTR)'
                    : activeModal.kind === 'edit'
                      ? 'Edit UTR / notes'
                      : activeModal.kind === 'fail'
                        ? 'Mark failed (with reason)'
                        : 'Claim logs & details'}
                </h3>
                <button type="button" className="sv-admin-close" onClick={closeModal} disabled={modalBusy}>
                  Close
                </button>
              </div>

              <div className="sv-admin-modalBody">
                {activeModal.kind === 'logs' ? (
                  <>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        {renderStatusPill(activeClaim)}
                        <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 900 }}>
                          Amount: ₹{formatInr(activeAmount)}
                        </span>
                      </div>
                      <div className="sv-admin-muted" style={{ marginTop: 10 }}>
                        Receiver: <span style={{ color: '#e2e8f0', fontWeight: 900 }}>{activeClaim?.recipientName || '—'}</span> ·
                        Phone: <span style={{ color: '#e2e8f0', fontWeight: 900 }}>{activeClaim?.phoneNumber || '—'}</span> ·
                        UPI: <span style={{ color: '#e2e8f0', fontWeight: 900 }}>{activeClaim?.upiId || '—'}</span>
                      </div>
                    </div>

                    <div className="sv-admin-logs">
                      {activeLogs.length === 0 ? (
                        <div style={{ color: '#94a3b8' }}>No logs stored.</div>
                      ) : (
                        activeLogs.map((l, idx) => (
                          <div key={`${l.timestamp}-${idx}`} className="sv-admin-logItem">
                            <div className="sv-admin-logAction">{l.action}</div>
                            <div className="sv-admin-logMeta">
                              Time: {l.timestamp ? formatTime(new Date(parseIsoToMs(l.timestamp) || Date.now())) : '—'}<br />
                              Admin: {l.admin || '—'}<br />
                              {l.utr_number ? `UTR: ${l.utr_number}\n` : null}
                              {l.failed_reason ? `Failed reason: ${l.failed_reason}\n` : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : activeModal.kind === 'fail' ? (
                  <>
                    <div className="sv-admin-grid2">
                      <div>
                        <div className="sv-admin-fieldLabel">Amount</div>
                        <input className="sv-admin-input2" value={`₹${formatInr(activeAmount)}`} disabled />
                        <div className="sv-admin-muted">This amount cannot be changed here.</div>
                      </div>
                      <div>
                        <div className="sv-admin-fieldLabel">UPI (receiver)</div>
                        <input className="sv-admin-input2" value={String(activeClaim?.upiId || '')} disabled />
                      </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <div className="sv-admin-fieldLabel">Failed reason (required)</div>
                      <input
                        className="sv-admin-input2"
                        value={modalFailedReason}
                        onChange={(e) => setModalFailedReason(e.target.value)}
                        placeholder="e.g. UPI transfer rejected / incorrect UTR format / recipient did not receive"
                        disabled={modalBusy}
                      />
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <div className="sv-admin-fieldLabel">Optional note</div>
                      <textarea
                        className="sv-admin-textarea"
                        value={modalFailedNotes}
                        onChange={(e) => setModalFailedNotes(e.target.value)}
                        placeholder="Any internal note for audit"
                        disabled={modalBusy}
                      />
                    </div>

                    <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button type="button" className="sv-admin-btn" onClick={closeModal} disabled={modalBusy}>Cancel</button>
                      <button type="button" className="sv-admin-btn sv-admin-btnDanger" onClick={() => void failClaim()} disabled={modalBusy}>
                        {modalBusy ? 'Saving…' : 'Mark as failed'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="sv-admin-grid2">
                      <div>
                        <div className="sv-admin-fieldLabel">Amount</div>
                        <input className="sv-admin-input2" value={`₹${formatInr(activeAmount)}`} disabled />
                        <div className="sv-admin-muted">UTR is required to record this settlement.</div>
                      </div>
                      <div>
                        <div className="sv-admin-fieldLabel">Receiver UPI</div>
                        <input className="sv-admin-input2" value={String(activeClaim?.upiId || '')} disabled />
                      </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <div className="sv-admin-fieldLabel">UTR / Transaction ID (required)</div>
                      <input
                        className="sv-admin-input2"
                        value={modalUtr}
                        onChange={(e) => setModalUtr(e.target.value)}
                        placeholder="Enter UTR"
                        disabled={modalBusy}
                      />
                      <div className="sv-admin-muted">Any non-empty string is accepted.</div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <div className="sv-admin-fieldLabel">Optional note</div>
                      <textarea
                        className="sv-admin-textarea"
                        value={modalNotes}
                        onChange={(e) => setModalNotes(e.target.value)}
                        placeholder="Optional audit note"
                        disabled={modalBusy}
                      />
                    </div>

                    <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button type="button" className="sv-admin-btn" onClick={closeModal} disabled={modalBusy}>Cancel</button>
                      <button type="button" className="sv-admin-btn sv-admin-btnPrimary" onClick={() => void settleClaim()} disabled={modalBusy}>
                        {modalBusy ? 'Saving…' : activeModal.kind === 'edit' ? 'Save changes' : 'Confirm & settle'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

