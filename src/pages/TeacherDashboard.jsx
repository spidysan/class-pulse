import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, BookOpen, Users, Play, Clipboard, Send, ChevronRight } from 'lucide-react';

const AVATAR_COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5AC8FA', '#FF2D55'];
const getAvatarColor = (name) => AVATAR_COLORS[name?.charCodeAt(0) % AVATAR_COLORS.length || 0];
const getInitials = (name) => name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';

export default function TeacherDashboard({ user, profile, navigateTo, isDemoMode }) {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [totalStudentCount, setTotalStudentCount] = useState(0);
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [classSemester, setClassSemester] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentDesc, setAssignmentDesc] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [grades, setGrades] = useState({});

  // ─── Demo Data ────────────────────────────────
  const DEMO_CLASSES = [
    { id: 'demo-c1', name: 'Data Structures & Algorithms', subject: 'CS201', teacher_id: user.id, join_code: '482910', created_at: '2026-01-15' },
    { id: 'demo-c2', name: 'Machine Learning', subject: 'CS401', teacher_id: user.id, join_code: '731258', created_at: '2026-02-01' },
    { id: 'demo-c3', name: 'Operating Systems', subject: 'CS301', teacher_id: user.id, join_code: '509123', created_at: '2026-03-10' },
  ];
  const DEMO_STUDENTS = [
    { id: 's1', name: 'Arjun Menon', email: 'arjun@iitm.edu', college: 'IIT Madras', department: 'CS', semester: '4' },
    { id: 's2', name: 'Sneha Reddy', email: 'sneha@iitm.edu', college: 'IIT Madras', department: 'CS', semester: '4' },
    { id: 's3', name: 'Rahul Kumar', email: 'rahul@iitm.edu', college: 'IIT Madras', department: 'CS', semester: '4' },
    { id: 's4', name: 'Divya Nair', email: 'divya@iitm.edu', college: 'IIT Madras', department: 'CS', semester: '4' },
    { id: 's5', name: 'Karthik Sharma', email: 'karthik@iitm.edu', college: 'IIT Madras', department: 'CS', semester: '4' },
  ];
  const DEMO_SESSIONS = [
    { id: 'demo-s1', class_id: 'demo-c1', is_active: false, created_at: '2026-05-20T09:00:00Z', timer_duration: 15, summary: 'Covered binary trees, AVL rotations, and heap sort.' },
    { id: 'demo-s2', class_id: 'demo-c1', is_active: false, created_at: '2026-05-22T09:00:00Z', timer_duration: 20, summary: 'Graph traversal: BFS, DFS, shortest path algorithms.' },
    { id: 'demo-s3', class_id: 'demo-c1', is_active: false, created_at: '2026-05-25T09:00:00Z', timer_duration: 15, summary: 'Dynamic programming fundamentals and memoization.' },
  ];
  const DEMO_ASSIGNMENTS = [
    { id: 'demo-a1', class_id: 'demo-c1', title: 'Implement Red-Black Tree', description: 'Build a self-balancing BST with insert and delete.', due_date: '2026-06-01T23:59:00Z', created_at: '2026-05-20' },
    { id: 'demo-a2', class_id: 'demo-c1', title: 'Graph Algorithms Lab', description: 'Implement Dijkstra and A* search.', due_date: '2026-06-05T23:59:00Z', created_at: '2026-05-22' },
  ];
  const DEMO_SUBMISSIONS = [
    { id: 'demo-sub1', assignment_id: 'demo-a1', student_id: 's1', content: 'Completed', grade: 'A', submitted_at: '2026-05-28', assignments: { title: 'Implement Red-Black Tree' }, users: { name: 'Arjun Menon' } },
    { id: 'demo-sub2', assignment_id: 'demo-a1', student_id: 's2', content: 'Completed', grade: 'A+', submitted_at: '2026-05-27', assignments: { title: 'Implement Red-Black Tree' }, users: { name: 'Sneha Reddy' } },
    { id: 'demo-sub3', assignment_id: 'demo-a1', student_id: 's3', content: 'Completed', grade: '', submitted_at: '2026-05-29', assignments: { title: 'Implement Red-Black Tree' }, users: { name: 'Rahul Kumar' } },
  ];

  useEffect(() => {
    if (isDemoMode) {
      setClasses(DEMO_CLASSES);
      setSelectedClass(DEMO_CLASSES[0]);
      setStudents(DEMO_STUDENTS);
      setSessions(DEMO_SESSIONS);
      setAssignments(DEMO_ASSIGNMENTS);
      setSubmissions(DEMO_SUBMISSIONS);
      setTotalStudentCount(42);
      const g = {}; DEMO_SUBMISSIONS.forEach(s => { g[s.id] = s.grade || ''; }); setGrades(g);
    } else {
      fetchClasses();
    }
  }, [user]);
  useEffect(() => { if (selectedClass && !isDemoMode) fetchClassDetails(selectedClass.id); }, [selectedClass]);

  const fetchClasses = async () => {
    try {
      const { data } = await supabase.from('classes').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false });
      setClasses(data || []);
      if (data?.length > 0 && !selectedClass) setSelectedClass(data[0]);
    } catch (e) { console.error(e); }
  };

  const fetchClassDetails = async (classId) => {
    try {
      const { data: enr } = await supabase.from('enrollments').select('student_id, users:student_id (id, name, email, college, department, semester)').eq('class_id', classId);
      setStudents(enr?.map(e => e.users).filter(Boolean) || []);
      const { count } = await supabase.from('enrollments').select('*', { count: 'exact', head: true }).in('class_id', classes.map(c => c.id));
      setTotalStudentCount(count || 0);
      const { data: sess } = await supabase.from('sessions').select('*').eq('class_id', classId).order('created_at', { ascending: false });
      setSessions(sess || []);
      const { data: asgn } = await supabase.from('assignments').select('*').eq('class_id', classId).order('created_at', { ascending: false });
      setAssignments(asgn || []);
      if (asgn?.length) {
        const { data: subs } = await supabase.from('submissions').select('*, assignments:assignment_id(title), users:student_id(name)').in('assignment_id', asgn.map(a => a.id)).order('submitted_at', { ascending: false });
        setSubmissions(subs || []);
        const g = {}; subs?.forEach(s => { g[s.id] = s.grade || ''; }); setGrades(g);
      } else { setSubmissions([]); }
    } catch (e) { console.error(e); }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!className || !subject) return;
    setLoading(true); setMsg('');
    const joinCode = Math.floor(100000 + Math.random() * 900000).toString();
    if (isDemoMode) {
      const newClass = { id: `demo-c${Date.now()}`, name: className, subject, teacher_id: user.id, join_code: joinCode, created_at: new Date().toISOString() };
      setClasses(prev => [newClass, ...prev]); setSelectedClass(newClass);
      setClassName(''); setSubject(''); setClassSemester(''); setMsg('Class created! (Demo)');
      setLoading(false); return;
    }
    try {
      const { data, error } = await supabase.from('classes').insert({ name: className, subject, teacher_id: user.id, join_code: joinCode }).select().single();
      if (error) throw error;
      setClassName(''); setSubject(''); setClassSemester(''); setMsg('Class created!');
      fetchClasses(); if (data) setSelectedClass(data);
    } catch (error) { setMsg(`Error: ${error.message}`); }
    setLoading(false);
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!assignmentTitle || !dueDate || !selectedClass) return;
    if (isDemoMode) {
      const a = { id: `demo-a${Date.now()}`, class_id: selectedClass.id, title: assignmentTitle, description: assignmentDesc, due_date: new Date(dueDate).toISOString(), created_at: new Date().toISOString() };
      setAssignments(prev => [a, ...prev]); setAssignmentTitle(''); setAssignmentDesc(''); setDueDate('');
      return;
    }
    try {
      await supabase.from('assignments').insert({ class_id: selectedClass.id, title: assignmentTitle, description: assignmentDesc, due_date: new Date(dueDate).toISOString() });
      setAssignmentTitle(''); setAssignmentDesc(''); setDueDate(''); fetchClassDetails(selectedClass.id);
    } catch (error) { alert(`Error: ${error.message}`); }
  };

  const handleUpdateGrade = async (subId) => {
    if (isDemoMode) { alert('Grade saved! (Demo)'); return; }
    try {
      await supabase.from('submissions').update({ grade: grades[subId] }).eq('id', subId);
      alert('Saved!'); fetchClassDetails(selectedClass.id);
    } catch (e) { alert(e.message); }
  };

  const handleStartSession = async () => {
    if (!selectedClass) return;
    if (isDemoMode) {
      navigateTo('live-session', { sessionId: `demo-session-${Date.now()}` });
      return;
    }
    try {
      const { data, error } = await supabase.from('sessions').insert({ class_id: selectedClass.id, timer_duration: 15, is_active: true }).select().single();
      if (error) throw error;
      navigateTo('live-session', { sessionId: data.id });
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-6 select-none fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card stat-card-blue"><p className="stat-number">{totalStudentCount}</p><p className="stat-label">Total Students</p></div>
        <div className="stat-card stat-card-green"><p className="stat-number">{sessions.length}</p><p className="stat-label">Sessions Run</p></div>
        <div className="stat-card stat-card-orange"><p className="stat-number">91%</p><p className="stat-label">Avg Accuracy</p></div>
        <div className="stat-card stat-card-purple"><p className="stat-number">{classes.length}</p><p className="stat-label">Active Classes</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-2 space-y-5">
          {/* My Classes */}
          <div className="card" id="classes-section">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">My Classes</h3>
              <button onClick={() => document.getElementById('create-class-form')?.scrollIntoView({ behavior: 'smooth' })} className="btn-outline text-[12px] py-1.5 px-3">+ New Class</button>
            </div>
            <div className="space-y-1">
              {classes.length === 0 ? <p className="text-[13px] text-[var(--text-secondary)] py-4">No classes yet.</p> :
                classes.map(cls => (
                  <button key={cls.id} onClick={() => setSelectedClass(cls)}
                    className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition-all ${selectedClass?.id === cls.id ? '' : 'hover:bg-black/[0.02]'}`}
                    style={selectedClass?.id === cls.id ? { background: 'rgba(0,122,255,0.06)' } : {}}>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: selectedClass?.id === cls.id ? 'var(--apple-blue)' : 'var(--text-tertiary)' }} />
                      <div>
                        <p className="text-[13px] font-medium text-[var(--text-primary)]">{cls.name}</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">{cls.subject}</p>
                      </div>
                    </div>
                    <span className={`badge text-[10px] ${selectedClass?.id === cls.id ? 'badge-blue' : ''}`} style={selectedClass?.id !== cls.id ? { background: 'rgba(0,0,0,0.03)', color: 'var(--text-tertiary)' } : {}}>
                      {selectedClass?.id === cls.id ? 'Active' : 'Idle'}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          {/* Create Class */}
          <div className="card" id="create-class-form">
            <h4 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">Create New Class</h4>
            <form onSubmit={handleCreateClass} className="space-y-3">
              <input type="text" placeholder="Class name" value={className} onChange={e => setClassName(e.target.value)} className="input-dark" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} className="input-dark" />
                <input type="text" placeholder="Semester" value={classSemester} onChange={e => setClassSemester(e.target.value)} className="input-dark" />
              </div>
              <button type="submit" disabled={loading} className="w-full btn-primary disabled:opacity-50">{loading ? 'Creating...' : 'Create Class'}</button>
              {msg && <p className="text-[12px] font-medium text-center" style={{ color: msg.includes('Error') ? 'var(--apple-red)' : '#248A3D' }}>{msg}</p>}
            </form>
          </div>

          {/* Post Assignment */}
          <div className="card" id="assignments-section">
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-3">Post Assignment</h3>
            <form onSubmit={handleCreateAssignment} className="space-y-3">
              <input type="text" placeholder="Title" value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)} className="input-dark" />
              <input type="text" placeholder="Description" value={assignmentDesc} onChange={e => setAssignmentDesc(e.target.value)} className="input-dark" />
              <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input-dark" />
              <button type="submit" className="w-full btn-primary">Post Assignment</button>
            </form>
            {assignments.length > 0 && (
              <div className="mt-3 space-y-2">
                {assignments.map(a => (
                  <div key={a.id} className="flex justify-between items-center p-3 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                    <div><p className="text-[13px] font-medium">{a.title}</p><p className="text-[11px] text-[var(--text-secondary)]">{a.description}</p></div>
                    <span className="badge badge-amber text-[10px]">Due {new Date(a.due_date).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submissions */}
          {submissions.length > 0 && (
            <div className="card">
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-3">Submissions</h3>
              <div className="space-y-2">
                {submissions.map(sub => (
                  <div key={sub.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="flex items-center gap-3">
                      <div className="avatar" style={{ background: getAvatarColor(sub.users?.name) }}>{getInitials(sub.users?.name)}</div>
                      <div><p className="text-[13px] font-medium">{sub.users?.name}</p><p className="text-[11px] text-[var(--text-secondary)]">{sub.assignments?.title}</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="Grade" value={grades[sub.id] || ''} onChange={e => setGrades({ ...grades, [sub.id]: e.target.value })}
                        className="input-dark w-16 text-center text-[12px]" style={{ padding: '5px', borderRadius: '8px' }} />
                      <button onClick={() => handleUpdateGrade(sub.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: 'var(--apple-blue)' }}>
                        <Send className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right */}
        <div className="space-y-5">
          {selectedClass ? (
            <>
              <div className="card">
                <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Active Classroom</p>
                <h2 className="text-[22px] font-bold text-[var(--text-primary)] mt-1 tracking-tight">{selectedClass.name}</h2>
                <p className="text-[13px] text-[var(--text-secondary)]">{selectedClass.subject}</p>
                <div className="mt-4 p-3 rounded-xl" style={{ background: 'var(--bg-primary)' }}>
                  <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Join Code</p>
                  <p className="text-[28px] font-bold font-mono tracking-[0.2em] text-[var(--text-primary)] mt-0.5">
                    {selectedClass.join_code?.substring(0, 3)} {selectedClass.join_code?.substring(3)}
                  </p>
                </div>
                <button onClick={handleStartSession} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
                  <Play className="w-4 h-4 fill-current" /> Start Live Session
                </button>
              </div>

              <div className="card">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-[15px] font-semibold">Students</h3>
                  <span className="text-[12px] text-[var(--text-secondary)]">{students.length} enrolled</span>
                </div>
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {students.length === 0 ? <p className="text-[13px] text-[var(--text-secondary)] py-4">No students yet.</p> :
                    students.map(s => (
                      <div key={s.id} className="flex items-center gap-3 py-1.5">
                        <div className="avatar" style={{ background: getAvatarColor(s.name) }}>{getInitials(s.name)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate">{s.name}</p>
                          <p className="text-[11px] text-[var(--text-secondary)] truncate">{s.department} · Sem {s.semester}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="card" id="sessions-section">
                <h3 className="text-[15px] font-semibold mb-3">Recent Sessions</h3>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {sessions.length === 0 ? <p className="text-[13px] text-[var(--text-secondary)] py-2">No sessions yet.</p> :
                    sessions.map(s => (
                      <button key={s.id} onClick={() => navigateTo('analytics', { sessionId: s.id })}
                        className="w-full text-left p-3 rounded-xl flex justify-between items-center group hover:bg-black/[0.02] transition-all">
                        <div>
                          <p className="text-[12px] font-mono text-[var(--text-secondary)]">{s.id.substring(0, 8)}...</p>
                          <p className="text-[11px] text-[var(--text-tertiary)]">{new Date(s.created_at).toLocaleDateString()}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                </div>
              </div>
            </>
          ) : (
            <div className="card text-center py-12">
              <BookOpen className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
              <h3 className="text-[15px] font-semibold">No Class Selected</h3>
              <p className="text-[13px] text-[var(--text-secondary)] mt-1">Create or select a class.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
