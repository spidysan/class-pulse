import React from 'react';
import { supabase } from '../supabaseClient';
import { LayoutDashboard, BookOpen, Radio, Clipboard, BarChart3, FileText, Award, Bell, LogOut, Zap, ChevronLeft } from 'lucide-react';

export default function Layout({ children, profile, route, navigateTo }) {
  const isTeacher = profile?.role === 'teacher';
  const isLiveSession = route?.name === 'live-session';
  const isStudentSession = route?.name === 'student-session';

  const handleSignOut = async () => { await supabase.auth.signOut(); };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const teacherNav = [
    { section: 'WORKSPACE', items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'classes', label: 'My Classes', icon: BookOpen },
      { key: 'sessions', label: 'Sessions', icon: Radio },
    ]},
    { section: 'TOOLS', items: [
      { key: 'assignments', label: 'Assignments', icon: Clipboard },
      { key: 'analytics-home', label: 'Analytics', icon: BarChart3 },
    ]}
  ];

  const studentNav = [
    { section: 'NAVIGATION', items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'classrooms', label: 'My Classrooms', icon: BookOpen },
      { key: 'assignments', label: 'Assignments', icon: Clipboard },
      { key: 'scores', label: 'My Scores', icon: Award },
      { key: 'notes', label: 'Lecture Notes', icon: FileText },
    ]}
  ];

  const navGroups = isLiveSession || isStudentSession ? [] : isTeacher ? teacherNav : studentNav;
  const currentPage = route?.name || 'dashboard';

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* ─── Sidebar ─── */}
      <aside className="sidebar">


        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 mb-6">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--apple-blue)' }}>
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">ClassPulse</span>
        </div>

        {isLiveSession || isStudentSession ? (
          <div className="space-y-4">
            <button onClick={() => navigateTo('dashboard')} className="sidebar-item">
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>
            <div className="px-3 pt-3" style={{ borderTop: '1px solid var(--border-default)' }}>
              <p className="sidebar-section-label mb-2">Session</p>
              <p className="text-[11px] font-mono text-[var(--text-secondary)]">{route?.params?.sessionId?.substring(0, 14)}...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 flex-1">
            {navGroups.map((group, gi) => (
              <div key={gi}>
                <p className="sidebar-section-label">{group.section}</p>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <button key={item.key}
                      onClick={() => {
                        const targetId = item.key === 'classrooms' ? 'classrooms-section' :
                                         item.key === 'classes' ? 'classes-section' :
                                         item.key === 'sessions' ? 'sessions-section' :
                                         item.key === 'assignments' ? 'assignments-section' :
                                         item.key === 'notes' ? 'notes-section' : null;
                        
                        if (route.name !== 'dashboard') {
                          navigateTo('dashboard');
                          if (targetId) {
                            setTimeout(() => {
                              const el = document.getElementById(targetId);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 100);
                          }
                        } else {
                          if (item.key === 'dashboard' || item.key === 'scores') {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          } else if (targetId) {
                            const el = document.getElementById(targetId);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                        }
                      }}
                      className={`sidebar-item ${currentPage === item.key || (item.key === 'dashboard' && currentPage === 'dashboard') ? 'sidebar-item-active' : ''}`}
                    >
                      <item.icon className="w-[16px] h-[16px]" style={{ opacity: 0.7 }} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom user info */}
        <div className="mt-auto pt-4" style={{ borderTop: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
              style={{ background: isTeacher ? 'var(--apple-green)' : 'var(--apple-blue)' }}>
              {profile?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{profile?.name || 'User'}</p>
              <p className="text-[11px] text-[var(--text-tertiary)] truncate capitalize">{profile?.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 ml-[240px] min-h-screen flex flex-col">
        <header className="topbar">
          <div>
            <h1 className="text-[17px] font-semibold text-[var(--text-primary)]">
              {isLiveSession ? '🔴 Live Session' : isStudentSession ? '📝 Quiz in Progress' : `${getGreeting()}, ${profile?.name?.split(' ')[0] || 'User'}`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={isTeacher ? 'badge-teacher' : 'badge-student'}>{isTeacher ? 'Teacher' : 'Student'}</span>
            <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/[0.03] transition-colors">
              <Bell className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
            <button onClick={handleSignOut} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/[0.03] transition-colors" title="Sign out">
              <LogOut className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-7">{children}</main>
      </div>
    </div>
  );
}
