// Pure PFMEA & 5-Whys Risk Matrix Engine

export function getRPNTier(rpn) {
  if (rpn >= 200) return { label: 'Critical', key: 'critical' };
  if (rpn >= 100) return { label: 'High', key: 'high' };
  if (rpn >= 50) return { label: 'Moderate', key: 'moderate' };
  return { label: 'Low', key: 'low' };
}

export function computeFMEAMetrics(fmeaState) {
  const rows = Array.isArray(fmeaState?.rows) ? fmeaState.rows : [];
  const enriched = rows
    .map((r) => {
      const sev = Math.max(1, Math.min(10, Math.round(Number(r.sev) || 1)));
      const occ = Math.max(1, Math.min(10, Math.round(Number(r.occ) || 1)));
      const det = Math.max(1, Math.min(10, Math.round(Number(r.det) || 1)));
      const rpn = sev * occ * det;
      return { ...r, sev, occ, det, rpn, tier: getRPNTier(rpn) };
    })
    .sort((a, b) => b.rpn - a.rpn);

  const maxRPN = enriched.length > 0 ? enriched[0].rpn : 0;
  const avgRPN = enriched.length > 0 ? enriched.reduce((s, r) => s + r.rpn, 0) / enriched.length : 0;
  const criticalCount = enriched.filter((r) => r.rpn >= 200).length;
  const openCount = enriched.filter((r) => r.status !== 'Closed').length;

  return {
    rows: enriched,
    totalCount: enriched.length,
    maxRPN,
    avgRPN,
    criticalCount,
    openCount,
    topRow: enriched[0] || null,
    chainsCount: Array.isArray(fmeaState?.chains) ? fmeaState.chains.length : 0,
  };
}
