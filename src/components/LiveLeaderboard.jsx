import React from 'react';
import { Trophy, AlertTriangle } from 'lucide-react';

const AVATAR_COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5AC8FA', '#FF2D55'];
const getAvatarColor = (name) => AVATAR_COLORS[name?.charCodeAt(0) % AVATAR_COLORS.length || 0];
const getInitials = (name) => name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
const MEDAL = ['#FFD60A', '#86868B', '#CD7F32'];

export default function LiveLeaderboard({ leaderboardData, showFlags = true }) {
  const sorted = [...(leaderboardData || [])].sort((a, b) => b.score !== a.score ? b.score - a.score : a.avgTime - b.avgTime);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4" style={{ color: '#FFD60A' }} />
          Leaderboard
        </h3>
        <span className="text-[12px] text-[var(--text-secondary)]">{sorted.length} active</span>
      </div>

      <div className="space-y-1">
        {sorted.length === 0 ? <p className="text-[13px] text-[var(--text-secondary)] py-6 text-center">Waiting for responses...</p> :
          sorted.map((s, idx) => {
            const flagged = showFlags && s.flaggedCount > 0;
            return (
              <div key={s.studentId} className="flex items-center gap-3 p-2.5 rounded-xl transition-all"
                style={flagged ? { background: 'rgba(255,59,48,0.04)' } : {}}>
                <span className="w-5 text-center text-[13px] font-bold" style={{ color: idx < 3 ? MEDAL[idx] : 'var(--text-tertiary)' }}>{idx + 1}</span>
                <div className="avatar" style={{ background: getAvatarColor(s.name), width: 28, height: 28, fontSize: 11 }}>{getInitials(s.name)}</div>
                <p className="flex-1 text-[13px] font-medium truncate">{s.name}</p>
                <div className="text-right shrink-0">
                  <span className="text-[13px] font-bold">{s.score * 10} <span className="text-[11px] font-normal text-[var(--text-tertiary)]">pts</span></span>
                  {flagged && <span className="badge badge-red text-[9px] ml-1.5"><AlertTriangle className="w-2.5 h-2.5 mr-0.5" />{s.flaggedCount}</span>}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
