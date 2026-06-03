import {
  Shield, Users, Settings,
  CheckCircle, XCircle, Edit3, Save, X, AlertTriangle, Crown,
  Zap, Target, Award, TrendingUp, Lock,
  RefreshCw, Calendar, MapPin
} from "lucide-react";

// ─── Supabase client init ───────────────────────────────────────────────────
let supabaseClient = null;

async function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  supabaseClient = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
  );
  return supabaseClient;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const ADMIN_NAME = "Jan Mošovský";
const ENTRY_FEE = 330;
const BANK_SHARE = 300;
const BONUS_SHARE = 30;
const PRIZE_SPLIT = { first: 0.60, second: 0.30, third: 0.10 };

const PHASE = {
  GROUP: "group",
  R16: "r16",
  QF: "qf",
  SF: "sf",
  FINAL: "final",
  R8: "r8",
};

const PHASE_LABEL = {
  group: "Základní skupiny",
  r16: "Šestnáctifinále",
  r8: "Osmifinále",
  qf: "Čtvrtfinále",
  sf: "Semifinále",
  final: "Finále",
};

const MULTIPLIER = { group: 1, r16: 2, r8: 2, qf: 2, sf: 2, final: 2 };

const DEFAULT_MATCHES = [
  { id: 1, phase: PHASE.GROUP, home: "Mexiko", away: "Soupeř A", label: "Skupina A – Zahajovací zápas", venue: "Mexico City", date: "2026-06-11", score_home: null, score_away: null, cancelled: false },
  { id: 2, phase: PHASE.GROUP, home: "USA", away: "Soupeř B", label: "Skupina D", venue: "Los Angeles", date: "2026-06-12", score_home: null, score_away: null, cancelled: false },
  { id: 3, phase: PHASE.GROUP, home: "Kanada", away: "Soupeř C", label: "Skupina B", venue: "Toronto", date: "2026-06-12", score_home: null, score_away: null, cancelled: false },
  { id: 4, phase: PHASE.GROUP, home: "Anglie", away: "Soupeř D", label: "Skupina C", venue: "—", date: "2026-06-13", score_home: null, score_away: null, cancelled: false },
  { id: 5, phase: PHASE.GROUP, home: "Argentina", away: "Soupeř E", label: "Skupina F", venue: "—", date: "2026-06-14", score_home: null, score_away: null, cancelled: false },
  { id: 6, phase: PHASE.R16, home: "1. Skupina K", away: "2. Skupina L", label: "Šestnáctifinále 1", venue: "—", date: "2026-06-28", score_home: null, score_away: null, cancelled: false },
  { id: 7, phase: PHASE.R8, home: "Vítěz Š1", away: "Vítěz Š2", label: "Osmifinále 1", venue: "—", date: "2026-07-04", score_home: null, score_away: null, cancelled: false },
  { id: 8, phase: PHASE.QF, home: "Vítěz OF1", away: "Vítěz OF2", label: "Čtvrtfinále 1", venue: "—", date: "2026-07-09", score_home: null, score_away: null, cancelled: false },
  { id: 9, phase: PHASE.SF, home: "Vítěz ČF1", away: "Vítěz ČF2", label: "Semifinále 1", venue: "—", date: "2026-07-14", score_home: null, score_away: null, cancelled: false },
  { id: 10, phase: PHASE.FINAL, home: "Vítěz SF1", away: "Vítěz SF2", label: "FINÁLE MS 2026", venue: "New York / New Jersey", date: "2026-07-19", score_home: null, score_away: null, cancelled: false },
];

const DEFAULT_PLAYERS = [
  "Jan Mošovský", "Petr Novák", "Tomáš Svoboda", "Martin Krejčí",
  "Lukáš Dvořák", "Jakub Procházka", "Ondřej Blažek", "Michal Horáček",
  "Pavel Šimánek", "David Kratochvíl",
];

// ─── Scoring logic ───────────────────────────────────────────────────────────
function calcPoints(match, tipH, tipA) {
  if (match.cancelled) return 0;
  if (match.score_home === null || match.score_away === null) return null;
  if (tipH === null || tipH === undefined || tipA === null || tipA === undefined) return null;
  const tH = Number(tipH), tA = Number(tipA);
  const rH = match.score_home, rA = match.score_away;
  const mult = MULTIPLIER[match.phase] || 1;
  if (tH === rH && tA === rA) return 5 * mult;
  if ((rH - rA) === (tH - tA)) return 3 * mult;
  const rWin = rH > rA ? "H" : rH < rA ? "A" : "D";
  const tWin = tH > tA ? "H" : tH < tA ? "A" : "D";
  if (rWin === tWin) return 1 * mult;
  return 0;
}

function computeLeaderboard(players, matches, tips) {
  return players
    .filter(p => p.paid)
    .map(player => {
      let total = 0, exact = 0, similar = 0, finalPts = 0, sfPts = 0, qfPts = 0;
      matches.forEach(m => {
        const tip = (tips[player.id] || {})[m.id];
        const pts = calcPoints(m, tip?.home, tip?.away);
        if (pts === null || pts === undefined) return;
        total += pts;
        const mult = MULTIPLIER[m.phase] || 1;
        if (pts === 5 * mult) exact++;
        else if (pts === 3 * mult) similar++;
        if (m.phase === PHASE.FINAL) finalPts += pts;
        if (m.phase === PHASE.SF) sfPts += pts;
        if (m.phase === PHASE.QF) qfPts += pts;
      });
      return { ...player, total, exact, similar, finalPts, sfPts, qfPts };
    })
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.exact !== a.exact) return b.exact - a.exact;
      if (b.similar !== a.similar) return b.similar - a.similar;
      if (b.finalPts !== a.finalPts) return b.finalPts - a.finalPts;
      if (b.sfPts !== a.sfPts) return b.sfPts - a.sfPts;
      if (b.qfPts !== a.qfPts) return b.qfPts - a.qfPts;
      return 0;
    })
    .map((p, idx, arr) => {
      let tie = false;
      if (idx > 0) {
        const prev = arr[idx - 1];
        if (p.total === prev.total && p.exact === prev.exact && p.similar === prev.similar &&
          p.finalPts === prev.finalPts && p.sfPts === prev.sfPts && p.qfPts === prev.qfPts) {
          tie = true;
        }
      }
      if (idx < arr.length - 1) {
        const next = arr[idx + 1];
        if (p.total === next.total && p.exact === next.exact && p.similar === next.similar &&
          p.finalPts === next.finalPts && p.sfPts === next.sfPts && p.qfPts === next.qfPts) {
          tie = true;
        }
      }
      return { ...p, rank: idx + 1, tie };
    });
}

// ─── Utility ─────────────────────────────────────────────────────────────────
function formatDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
}

function formatCZK(n) {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(n);
}

// ─── Hooks for Supabase ───────────────────────────────────────────────────────
function useSupabaseData() {
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState(DEFAULT_MATCHES);
  const [tips, setTips] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(false);

  const initDefault = useCallback(() => {
    const defaultPlayers = DEFAULT_PLAYERS.map((name, i) => ({
      id: i + 1, name, paid: name === ADMIN_NAME
    }));
    setPlayers(defaultPlayers);
    setMatches(DEFAULT_MATCHES);
    setTips({});
    setOffline(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const sb = await getSupabase();
        const [{ data: pData, error: pErr }, { data: mData, error: mErr }, { data: tData, error: tErr }] =
          await Promise.all([
            sb.from("players").select("*").order("id"),
            sb.from("matches").select("*").order("id"),
            sb.from("tips").select("*"),
          ]);
        if (pErr || mErr || tErr) throw pErr || mErr || tErr;
        if (!mounted) return;
        if (pData?.length) setPlayers(pData);
        else initDefault();
        if (mData?.length) setMatches(mData);
        const tipsMap = {};
        (tData || []).forEach(t => {
          if (!tipsMap[t.player_id]) tipsMap[t.player_id] = {};
          tipsMap[t.player_id][t.match_id] = { home: t.tip_home, away: t.tip_away };
        });
        setTips(tipsMap);
      } catch (e) {
        console.warn("Supabase unavailable, running offline:", e.message);
        if (mounted) initDefault();
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [initDefault]);

  const saveTip = useCallback(async (playerId, matchId, home, away) => {
    setTips(prev => ({
      ...prev,
      [playerId]: { ...(prev[playerId] || {}), [matchId]: { home, away } }
    }));
    if (offline) return;
    try {
      const sb = await getSupabase();
      await sb.from("tips").upsert({ player_id: playerId, match_id: matchId, tip_home: home, tip_away: away },
        { onConflict: "player_id,match_id" });
    } catch (e) { console.warn("Save tip failed:", e.message); }
  }, [offline]);

  const updatePlayer = useCallback(async (id, fields) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...fields } : p));
    if (offline) return;
    try {
      const sb = await getSupabase();
      await sb.from("players").update(fields).eq("id", id);
    } catch (e) { console.warn("Update player failed:", e.message); }
  }, [offline]);

  const updateMatch = useCallback(async (id, fields) => {
    setMatches(prev => prev.map(m => m.id === id ? { ...m, ...fields } : m));
    if (offline) return;
    try {
      const sb = await getSupabase();
      await sb.from("matches").update(fields).eq("id", id);
    } catch (e) { console.warn("Update match failed:", e.message); }
  }, [offline]);

  return { players, matches, tips, loading, error, offline, saveTip, updatePlayer, updateMatch };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreBadge({ points, multiplier }) {
  if (points === null || points === undefined) return null;
  const colors = {
    exact: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
    similar: "bg-sky-500/20 text-sky-300 border border-sky-500/40",
    win: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
    zero: "bg-slate-700/50 text-slate-500 border border-slate-600/30",
  };
  const maxExact = 5 * (multiplier || 1);
  const maxSimilar = 3 * (multiplier || 1);
  const maxWin = 1 * (multiplier || 1);
  const cls = points === maxExact ? colors.exact : points === maxSimilar ? colors.similar : points === maxWin ? colors.win : colors.zero;
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>
      +{points} b
    </span>
  );
}

function MatchCard({ match, tip, onTipChange, readOnly, showResult }) {
  const mult = MULTIPLIER[match.phase] || 1;
  const pts = calcPoints(match, tip?.home, tip?.away);
  const isPlayed = match.score_home !== null && match.score_away !== null;
  const isPlayoff = mult > 1;

  return (
    <div className={`relative rounded-2xl overflow-hidden border transition-all duration-200 ${
      match.cancelled
        ? "border-slate-700/40 bg-slate-800/30 opacity-50"
        : isPlayed
        ? "border-emerald-700/30 bg-gradient-to-br from-slate-800/60 to-slate-900/80"
        : "border-slate-700/50 bg-gradient-to-br from-slate-800/40 to-slate-900/60 hover:border-slate-600/60"
    }`}>
      {isPlayoff && (
        <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500/20 to-transparent px-3 py-1">
          <span className="text-amber-400 text-xs font-bold tracking-wider">×2</span>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Calendar size={11} />
            <span>{formatDate(match.date)}</span>
            {match.venue && match.venue !== "—" && (
              <>
                <MapPin size={11} />
                <span>{match.venue}</span>
              </>
            )}
          </div>
          {match.cancelled && (
            <span className="text-xs bg-red-900/40 text-red-400 border border-red-700/40 px-2 py-0.5 rounded-full">Zrušeno</span>
          )}
          {isPlayed && !match.cancelled && showResult && (
            <ScoreBadge points={pts} multiplier={mult} />
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 text-right">
            <span className="font-bold text-slate-100 text-sm">{match.home}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isPlayed && !match.cancelled ? (
              <div className="flex items-center gap-1 bg-slate-700/50 rounded-xl px-3 py-1.5">
                <span className="text-emerald-300 font-black text-lg tabular-nums">{match.score_home}</span>
                <span className="text-slate-500 font-bold">:</span>
                <span className="text-emerald-300 font-black text-lg tabular-nums">{match.score_away}</span>
              </div>
            ) : (
              <div className="text-slate-600 font-bold text-sm px-2">vs</div>
            )}
          </div>
          <div className="flex-1 text-left">
            <span className="font-bold text-slate-100 text-sm">{match.away}</span>
          </div>
        </div>

        {!readOnly && !match.cancelled && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="text-xs text-slate-500 mr-1">Tvůj tip:</span>
            <div className="flex items-center gap-2 bg-slate-700/40 rounded-xl px-3 py-2">
              <input
                type="number" min="0" max="20"
                value={tip?.home ?? ""}
                onChange={e => onTipChange(match.id, Number(e.target.value), tip?.away ?? "")}
                disabled={isPlayed}
                className="w-10 text-center bg-transparent text-white font-bold text-lg outline-none tabular-nums disabled:opacity-40"
                placeholder="?"
              />
              <span className="text-slate-500 font-bold">:</span>
              <input
                type="number" min="0" max="20"
                value={tip?.away ?? ""}
                onChange={e => onTipChange(match.id, tip?.home ?? "", Number(e.target.value))}
                disabled={isPlayed}
                className="w-10 text-center bg-transparent text-white font-bold text-lg outline-none tabular-nums disabled:opacity-40"
                placeholder="?"
              />
            </div>
            {isPlayed && pts !== null && <ScoreBadge points={pts} multiplier={mult} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Leaderboard ────────────────────────────────────────────────────────
function LeaderboardTab({ players, matches, tips }) {
  const board = useMemo(() => computeLeaderboard(players, matches, tips), [players, matches, tips]);
  const paidCount = players.filter(p => p.paid).length;
  const bank = paidCount * BANK_SHARE;
  const prizes = {
    first: Math.round(bank * PRIZE_SPLIT.first),
    second: Math.round(bank * PRIZE_SPLIT.second),
    third: Math.round(bank * PRIZE_SPLIT.third),
  };
  const last = board[board.length - 1];

  const rankIcon = (rank) => {
    if (rank === 1) return <Crown size={16} className="text-yellow-400" />;
    if (rank === 2) return <Award size={16} className="text-slate-300" />;
    if (rank === 3) return <Award size={16} className="text-amber-600" />;
    return <span className="text-slate-600 text-sm font-mono w-4 text-center">{rank}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Prize pool */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "1. místo", val: prizes.first, icon: "🥇", pct: "60%" },
          { label: "2. místo", val: prizes.second, icon: "🥈", pct: "30%" },
          { label: "3. místo", val: prizes.third, icon: "🥉", pct: "10%" },
        ].map(p => (
          <div key={p.label} className="rounded-2xl bg-gradient-to-b from-slate-800/80 to-slate-900/80 border border-slate-700/40 p-4 text-center">
            <div className="text-2xl mb-1">{p.icon}</div>
            <div className="text-xs text-slate-500 mb-1">{p.label}</div>
            <div className="font-black text-emerald-300 text-lg leading-tight">{formatCZK(p.val)}</div>
            <div className="text-xs text-slate-600">{p.pct}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Celkový bank: <span className="text-emerald-400 font-bold">{formatCZK(bank)}</span></span>
        <span className="text-slate-500">Platících: <span className="text-white font-bold">{paidCount}</span></span>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden border border-slate-700/40">
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-0 bg-slate-800/60 px-4 py-2.5 text-xs text-slate-500 font-semibold tracking-wide uppercase border-b border-slate-700/40">
          <span className="w-8">#</span>
          <span>Hráč</span>
          <span className="w-10 text-center">✓</span>
          <span className="w-10 text-center">~</span>
          <span className="w-14 text-right">Body</span>
        </div>
        {board.length === 0 && (
          <div className="py-12 text-center text-slate-600">Zatím žádní platící hráči</div>
        )}
        {board.map((p, idx) => (
          <div key={p.id} className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-0 items-center px-4 py-3 border-b border-slate-800/60 last:border-0 transition-colors ${
            idx < 3 ? "bg-gradient-to-r from-slate-800/40 to-transparent" : "hover:bg-slate-800/20"
          }`}>
            <div className="w-8 flex justify-center">{rankIcon(p.rank)}</div>
            <div>
              <div className="font-semibold text-slate-100 text-sm">{p.name}</div>
              {p.tie && <div className="text-xs text-amber-500 flex items-center gap-1"><AlertTriangle size={10} /> Shoda – rozhodne los</div>}
            </div>
            <div className="w-10 text-center text-xs text-emerald-400 font-mono">{p.exact}</div>
            <div className="w-10 text-center text-xs text-sky-400 font-mono">{p.similar}</div>
            <div className="w-14 text-right">
              <span className={`font-black text-base ${idx === 0 ? "text-emerald-300" : idx < 3 ? "text-slate-200" : "text-slate-400"}`}>
                {p.total}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Consolation */}
      {last && (
        <div className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-900/40 p-4 text-center">
          <div className="text-2xl mb-1">🧀</div>
          <div className="text-slate-400 text-sm font-semibold">Cena útěchy – Mísa syrečků</div>
          <div className="text-slate-500 text-xs mt-1">Pro posledního hráče: <span className="text-slate-300">{last.name}</span> ({last.total} bodů)</div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Player Tips ────────────────────────────────────────────────────────
function PlayerTab({ players, matches, tips, saveTip }) {
  const [selectedId, setSelectedId] = useState(null);
  const [localTips, setLocalTips] = useState({});

  useEffect(() => {
    if (selectedId) setLocalTips((tips[selectedId] || {}));
  }, [selectedId, tips]);

  const handleTipChange = useCallback((matchId, home, away) => {
    setLocalTips(prev => ({ ...prev, [matchId]: { home, away } }));
    if (selectedId) saveTip(selectedId, matchId, home, away);
  }, [selectedId, saveTip]);

  const selectedPlayer = players.find(p => p.id === selectedId);
  const grouped = useMemo(() => {
    const order = [PHASE.GROUP, PHASE.R16, PHASE.R8, PHASE.QF, PHASE.SF, PHASE.FINAL];
    return order.map(phase => ({
      phase,
      matches: matches.filter(m => m.phase === phase),
    })).filter(g => g.matches.length > 0);
  }, [matches]);

  return (
    <div className="space-y-5">
      {/* Player selector */}
      <div className="rounded-2xl border border-slate-700/40 bg-slate-800/50 p-4">
        <label className="block text-xs text-slate-500 mb-2 uppercase tracking-wide">Vyber své jméno</label>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
          {players.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                selectedId === p.id
                  ? "bg-emerald-600/30 border border-emerald-500/50 text-emerald-200"
                  : "bg-slate-700/30 border border-slate-700/30 text-slate-300 hover:border-slate-600/50"
              }`}
            >
              <div className="flex items-center gap-2">
                {p.paid ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />}
                {p.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {!selectedPlayer && (
        <div className="text-center py-12 text-slate-600">
          <Target size={40} className="mx-auto mb-3 opacity-30" />
          <p>Vyber své jméno pro zadání tipů</p>
        </div>
      )}

      {selectedPlayer && !selectedPlayer.paid && (
        <div className="rounded-xl border border-amber-700/40 bg-amber-900/20 p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-500 shrink-0" />
          <span className="text-amber-300 text-sm">Tvoje platba 330 Kč nebyla potvrzena náčelníkem. Tipy můžeš zadávat, ale nebudou se počítat do žebříčku.</span>
        </div>
      )}

      {selectedPlayer && grouped.map(({ phase, matches: phaseMatches }) => (
        <div key={phase}>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-slate-800" />
            <div className="flex items-center gap-2">
              {MULTIPLIER[phase] > 1 && <Zap size={13} className="text-amber-400" />}
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{PHASE_LABEL[phase]}</span>
            </div>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <div className="space-y-3">
            {phaseMatches.map(m => (
              <MatchCard
                key={m.id}
                match={m}
                tip={localTips[m.id]}
                onTipChange={handleTipChange}
                showResult={true}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Admin ──────────────────────────────────────────────────────────────
function AdminTab({ players, matches, tips, updatePlayer, updateMatch }) {
  const [adminPass, setAdminPass] = useState("");
  const [authed, setAuthed] = useState(false);
  const [editMatch, setEditMatch] = useState(null);
  const [editFields, setEditFields] = useState({});

  const handleAuth = () => {
    if (adminPass === "stechovice2026") setAuthed(true);
    else alert("Špatné heslo, náčelníku!");
  };

  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Shield size={40} className="text-emerald-600" />
        <h2 className="text-xl font-bold text-slate-200">Zóna Náčelníka</h2>
        <p className="text-slate-500 text-sm">Přístup jen pro Jana Mošovského</p>
        <div className="flex gap-2 w-full max-w-xs">
          <input
            type="password"
            placeholder="Heslo..."
            value={adminPass}
            onChange={e => setAdminPass(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAuth()}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white outline-none focus:border-emerald-600"
          />
          <button onClick={handleAuth} className="bg-emerald-700 hover:bg-emerald-600 px-4 rounded-xl text-white font-semibold transition-colors">
            <Lock size={16} />
          </button>
        </div>
      </div>
    );
  }

  const startEdit = (m) => {
    setEditMatch(m.id);
    setEditFields({ home: m.home, away: m.away, score_home: m.score_home ?? "", score_away: m.score_away ?? "", cancelled: m.cancelled });
  };

  const saveEdit = () => {
    updateMatch(editMatch, {
      home: editFields.home,
      away: editFields.away,
      score_home: editFields.score_home === "" ? null : Number(editFields.score_home),
      score_away: editFields.score_away === "" ? null : Number(editFields.score_away),
      cancelled: editFields.cancelled,
    });
    setEditMatch(null);
  };

  return (
    <div className="space-y-6">
      {/* Players / Payments */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-emerald-500" />
          <h3 className="font-bold text-slate-200">Správa plateb</h3>
          <span className="text-xs text-slate-500 ml-1">– {players.filter(p => p.paid).length} z {players.length} zaplaceno</span>
        </div>
        <div className="rounded-2xl border border-slate-700/40 overflow-hidden">
          {players.map((p, i) => (
            <div key={p.id} className={`flex items-center justify-between px-4 py-3 ${i < players.length - 1 ? "border-b border-slate-800" : ""}`}>
              <span className="text-sm text-slate-200">{p.name}</span>
              <button
                onClick={() => updatePlayer(p.id, { paid: !p.paid })}
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  p.paid
                    ? "bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 hover:bg-emerald-600/30"
                    : "bg-slate-700/50 text-slate-500 border border-slate-700/40 hover:border-slate-600"
                }`}
              >
                {p.paid ? <CheckCircle size={13} /> : <XCircle size={13} />}
                {p.paid ? "Zaplaceno 330 Kč" : "Nezaplaceno"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Matches */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Edit3 size={16} className="text-emerald-500" />
          <h3 className="font-bold text-slate-200">Správa zápasů</h3>
        </div>
        <div className="space-y-3">
          {matches.map(m => (
            <div key={m.id} className="rounded-2xl border border-slate-700/40 bg-slate-800/40 overflow-hidden">
              {editMatch === m.id ? (
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Domácí</label>
                      <input value={editFields.home} onChange={e => setEditFields(f => ({ ...f, home: e.target.value }))}
                        className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-600" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Hosté</label>
                      <input value={editFields.away} onChange={e => setEditFields(f => ({ ...f, away: e.target.value }))}
                        className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-600" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Skóre domácí</label>
                      <input type="number" min="0" value={editFields.score_home}
                        onChange={e => setEditFields(f => ({ ...f, score_home: e.target.value }))}
                        className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-600" placeholder="—" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Skóre hosté</label>
                      <input type="number" min="0" value={editFields.score_away}
                        onChange={e => setEditFields(f => ({ ...f, score_away: e.target.value }))}
                        className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-600" placeholder="—" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editFields.cancelled} onChange={e => setEditFields(f => ({ ...f, cancelled: e.target.checked }))}
                      className="rounded accent-red-500" />
                    <span className="text-sm text-slate-300">Zrušený zápas (0 bodů pro všechny)</span>
                  </label>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                      <Save size={14} /> Uložit
                    </button>
                    <button onClick={() => setEditMatch(null)} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                      <X size={14} /> Zrušit
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      {m.home} vs {m.away}
                      {m.cancelled && <span className="ml-2 text-xs text-red-400">[ZRUŠENO]</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {PHASE_LABEL[m.phase]} · {formatDate(m.date)}
                      {m.score_home !== null && (
                        <span className="ml-2 text-emerald-400 font-mono">{m.score_home}:{m.score_away}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => startEdit(m)} className="text-slate-500 hover:text-emerald-400 transition-colors p-2">
                    <Edit3 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("leaderboard");
  const { players, matches, tips, loading, offline, saveTip, updatePlayer, updateMatch } = useSupabaseData();

  const tabs = [
    { id: "leaderboard", label: "Žebříček", icon: TrendingUp },
    { id: "player", label: "Tipování", icon: Target },
    { id: "admin", label: "Náčelník", icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <div className="text-slate-400 text-sm">Načítám Tipovačku…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-900/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-24 w-72 h-72 bg-teal-900/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-slate-800/30 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 pb-24">
        {/* Header */}
        <div className="pt-8 pb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-emerald-600" />
            <span className="text-emerald-500 text-xs font-bold tracking-[0.25em] uppercase">MS 2026</span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-emerald-600" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            ⚽ Štěchovická
          </h1>
          <h2 className="text-2xl font-black tracking-tight text-emerald-400 -mt-1">
            Tipovačka 2026
          </h2>
          {offline && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded-full px-3 py-1">
              <AlertTriangle size={11} />
              Offline režim – data se ukládají jen lokálně
            </div>
          )}
        </div>

        {/* Tab content */}
        <div className="min-h-[60vh]">
          {tab === "leaderboard" && <LeaderboardTab players={players} matches={matches} tips={tips} />}
          {tab === "player" && <PlayerTab players={players} matches={matches} tips={tips} saveTip={saveTip} />}
          {tab === "admin" && <AdminTab players={players} matches={matches} tips={tips} updatePlayer={updatePlayer} updateMatch={updateMatch} />}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/80">
        <div className="max-w-lg mx-auto flex">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-all ${
                tab === t.id
                  ? "text-emerald-400"
                  : "text-slate-600 hover:text-slate-400"
              }`}
            >
              <t.icon size={20} className={tab === t.id ? "text-emerald-400" : ""} />
              {t.label}
              {tab === t.id && <div className="absolute bottom-0 w-12 h-0.5 bg-emerald-500 rounded-full" style={{ position: "relative" }} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
