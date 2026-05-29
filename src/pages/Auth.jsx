import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Mic, ShieldCheck, Award, Zap } from 'lucide-react';

export default function Auth({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState('teacher');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [college, setCollege] = useState('');
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('1');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true); setErrorMsg(''); setSuccessMsg('');
    if (isSignUp) {
      if (!name || !email || !password || !college || !department) { setErrorMsg('Please fill in all fields.'); setLoading(false); return; }
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, role, college, department, semester: role === 'student' ? semester : '' } } });
      if (error) setErrorMsg(error.message);
      else { setSuccessMsg('Account created! Check your email or sign in.'); setIsSignUp(false); }
    } else {
      if (!email || !password) { setErrorMsg('Enter email and password.'); setLoading(false); return; }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErrorMsg(error.message);
      else if (data?.user) onAuthSuccess(data.user);
    }
    setLoading(false);
  };

  const features = [
    { icon: Mic, color: 'var(--apple-blue)', label: 'Live Transcription', desc: 'Real-time voice to text for lectures' },
    { icon: ShieldCheck, color: 'var(--apple-green)', label: 'Anti-Cheat Shield', desc: 'Canvas rendering with tab-lock security' },
    { icon: Award, color: 'var(--apple-orange)', label: 'Live Leaderboards', desc: 'Real-time scores and rankings' },
  ];

  return (
    <div className="min-h-screen flex select-none" style={{ background: 'var(--bg-primary)' }}>
      {/* Left — Branding */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-16">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--apple-blue)' }}>
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-[var(--text-primary)]">ClassPulse</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-[48px] font-bold leading-[1.08] tracking-tight text-[var(--text-primary)]">
            The classroom<br />that thinks<br />with you.
          </h1>
          <p className="text-[17px] text-[var(--text-secondary)] mt-4 leading-relaxed">
            AI-powered live transcription, instant quiz generation, and real-time analytics — all in one beautiful interface.
          </p>

          <div className="space-y-3 mt-10">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: f.color }}>
                  <f.icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--text-primary)]">{f.label}</p>
                  <p className="text-[12px] text-[var(--text-secondary)]">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[12px] text-[var(--text-tertiary)]">© 2026 ClassPulse · Built for educators</p>
      </div>

      {/* Right — Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-[380px] space-y-6 fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--apple-blue)' }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-[var(--text-primary)]">ClassPulse</span>
          </div>

          <div>
            <h2 className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight">{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
            <p className="text-[15px] text-[var(--text-secondary)] mt-1">{isSignUp ? 'Set up your classroom profile' : 'Sign in to your classroom'}</p>
          </div>

          {/* Segmented Control */}
          <div className="flex p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.04)' }}>
            <button onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2 text-[13px] font-semibold rounded-lg transition-all ${!isSignUp ? 'bg-white shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
              Sign In
            </button>
            <button onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2 text-[13px] font-semibold rounded-lg transition-all ${isSignUp ? 'bg-white shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
              Create Account
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-3.5">
            {isSignUp && (
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Full Name</label>
                <input type="text" placeholder="Prof. Kumar" value={name} onChange={(e) => setName(e.target.value)} className="input-dark" />
              </div>
            )}
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Email</label>
              <input type="email" placeholder="you@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} className="input-dark" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Password</label>
              <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="input-dark" />
            </div>
            {isSignUp && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">College</label>
                    <input type="text" placeholder="IIT Madras" value={college} onChange={(e) => setCollege(e.target.value)} className="input-dark" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Department</label>
                    <input type="text" placeholder="CS" value={department} onChange={(e) => setDepartment(e.target.value)} className="input-dark" />
                  </div>
                </div>
                {role === 'student' && (
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Semester</label>
                    <select value={semester} onChange={(e) => setSemester(e.target.value)} className="input-dark">{[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}</select>
                  </div>
                )}
              </>
            )}

            {/* Role Picker */}
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-2">I am a</label>
              <div className="grid grid-cols-2 gap-3">
                {['teacher', 'student'].map(r => (
                  <button key={r} type="button" onClick={() => setRole(r)}
                    className="p-3 rounded-xl text-center text-[13px] font-medium transition-all"
                    style={{
                      background: role === r ? 'rgba(0,122,255,0.06)' : 'transparent',
                      border: role === r ? '2px solid var(--apple-blue)' : '1px solid var(--border-default)',
                      color: role === r ? 'var(--apple-blue)' : 'var(--text-secondary)',
                    }}>
                    <span className="text-xl block mb-0.5">{r === 'teacher' ? '👨‍🏫' : '👨‍🎓'}</span>
                    <span className="capitalize">{r}</span>
                  </button>
                ))}
              </div>
            </div>

            {errorMsg && <p className="text-[12px] font-medium text-[var(--apple-red)] text-center p-2.5 rounded-lg" style={{ background: 'rgba(255,59,48,0.06)' }}>{errorMsg}</p>}
            {successMsg && <p className="text-[12px] font-medium text-[#248A3D] text-center p-2.5 rounded-lg" style={{ background: 'rgba(52,199,89,0.06)' }}>{successMsg}</p>}

            <button type="submit" disabled={loading} className="w-full btn-primary py-2.5 disabled:opacity-50">
              {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-[12px] text-[var(--text-tertiary)]">
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); setSuccessMsg(''); }} className="font-medium text-[var(--apple-blue)]">
              {isSignUp ? 'Sign In' : 'Create Account'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
