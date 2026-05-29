import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './pages/Auth';
import Layout from './components/Layout';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherLiveSession from './pages/TeacherLiveSession';
import ClassAnalytics from './pages/ClassAnalytics';
import StudentDashboard from './pages/StudentDashboard';
import StudentLiveSession from './pages/StudentLiveSession';

export default function App() {
  const [sessionUser, setSessionUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState({ name: 'dashboard', params: {} });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSessionUser(session.user);
        ensureProfileExists(session.user, 3);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSessionUser(session.user);
        ensureProfileExists(session.user, 3);
      } else {
        setSessionUser(null);
        setProfile(null);
        setRoute({ name: 'dashboard', params: {} });
        setLoading(false);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const ensureProfileExists = async (user, retriesLeft) => {
    try {
      const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (data) { setProfile(data); setLoading(false); return; }
      if (retriesLeft > 0) {
        setTimeout(() => ensureProfileExists(user, retriesLeft - 1), 1000);
      } else {
        const metadata = user.user_metadata || {};
        const fallbackProfile = {
          id: user.id, name: metadata.name || user.email.split('@')[0],
          email: user.email, role: metadata.role || 'student',
          college: metadata.college || 'University', department: metadata.department || 'Dept', semester: metadata.semester || '1'
        };
        await supabase.from('users').insert(fallbackProfile).catch(() => {});
        setProfile(fallbackProfile);
        setLoading(false);
      }
    } catch (e) { console.error('[ProfileFetch]', e); setLoading(false); }
  };

  const navigateTo = (pageName, params = {}) => { setRoute({ name: pageName, params }); };

  const handleAuthSuccess = (user) => {
    setSessionUser(user);
    ensureProfileExists(user, 3);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center select-none" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-full border-[3px] animate-spin mb-5" style={{ borderColor: 'rgba(0,122,255,0.15)', borderTopColor: 'var(--apple-blue)' }} />
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">ClassPulse</p>
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">Loading your classroom...</p>
        </div>
      </div>
    );
  }

  if (!sessionUser) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  const renderPage = () => {
    const isTeacher = profile?.role === 'teacher';
    if (isTeacher) {
      switch (route.name) {
        case 'live-session':
          return <TeacherLiveSession sessionId={route.params.sessionId} user={sessionUser} profile={profile} navigateTo={navigateTo} />;
        case 'analytics':
          return <ClassAnalytics sessionId={route.params.sessionId} navigateTo={navigateTo} />;
        default:
          return <TeacherDashboard user={sessionUser} profile={profile} navigateTo={navigateTo} />;
      }
    } else {
      switch (route.name) {
        case 'student-session':
          return <StudentLiveSession sessionId={route.params.sessionId} user={sessionUser} profile={profile} navigateTo={navigateTo} />;
        default:
          return <StudentDashboard user={sessionUser} profile={profile} navigateTo={navigateTo} />;
      }
    }
  };

  return (
    <Layout user={sessionUser} profile={profile} route={route} navigateTo={navigateTo}>
      {renderPage()}
    </Layout>
  );
}
