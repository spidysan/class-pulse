import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BookOpen, Send, CheckCircle, X } from 'lucide-react';

export default function StudentDashboard({ user, profile, navigateTo, isDemoMode }) {
  const [enrollments, setEnrollments] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinMsg, setJoinMsg] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [submissionTexts, setSubmissionTexts] = useState({});
  const [pastSessions, setPastSessions] = useState([]);
  const [viewingSummary, setViewingSummary] = useState(null);
  const [totalScore, setTotalScore] = useState(0);
  const [classAccuracy, setClassAccuracy] = useState(0);
  const [classRank, setClassRank] = useState(1);

  // ─── Demo Data ────────────────────────────────
  const DEMO_ENROLLED = [
    { id: 'demo-c1', name: 'Data Structures & Algorithms', subject: 'CS201', join_code: '482910' },
    { id: 'demo-c2', name: 'Machine Learning', subject: 'CS401', join_code: '731258' },
  ];
  const DEMO_ASSIGNMENTS_S = [
    { id: 'demo-a1', class_id: 'demo-c1', title: 'Implement Red-Black Tree', description: 'Build a self-balancing BST.', due_date: '2026-06-01T23:59:00Z' },
    { id: 'demo-a2', class_id: 'demo-c1', title: 'Graph Algorithms Lab', description: 'Implement Dijkstra and A*.', due_date: '2026-06-05T23:59:00Z' },
  ];
  const DEMO_SUBMISSIONS_S = [
    { id: 'demo-sub1', assignment_id: 'demo-a1', student_id: user.id, file_url: 'Solution submitted', grade: 'A', submitted_at: '2026-05-28' },
  ];
  const DEMO_SESSIONS_S = [
    { id: 'demo-s1', class_id: 'demo-c1', is_active: false, created_at: '2026-05-20T09:00:00Z', summary: 'Binary trees, AVL rotations, and heap sort. Key takeaway: balanced trees maintain O(log n) operations.' },
    { id: 'demo-s2', class_id: 'demo-c1', is_active: false, created_at: '2026-05-22T09:00:00Z', summary: 'Graph traversal using BFS and DFS. Discussed applications in social networks and GPS routing.' },
    { id: 'demo-s3', class_id: 'demo-c1', is_active: true, created_at: '2026-05-29T09:00:00Z', summary: '' },
  ];

  useEffect(() => {
    if (isDemoMode) {
      setEnrollments(DEMO_ENROLLED);
      setSelectedClass(DEMO_ENROLLED[0]);
      setAssignments(DEMO_ASSIGNMENTS_S);
      setSubmissions(DEMO_SUBMISSIONS_S);
      setPastSessions(DEMO_SESSIONS_S);
      setTotalScore(18);
    } else {
      fetchEnrollments();
    }
  }, [user]);
  useEffect(() => { if (selectedClass && !isDemoMode) fetchClassDetails(selectedClass.id); }, [selectedClass]);

  const fetchEnrollments = async () => {
    try {
      const { data } = await supabase.from('enrollments').select('class_id, classes:class_id (*)').eq('student_id', user.id);
      const enrolled = data?.map(e => e.classes).filter(Boolean) || [];
      setEnrollments(enrolled);
      if (enrolled.length > 0 && !selectedClass) setSelectedClass(enrolled[0]);
      const { data: ans } = await supabase.from('answers').select('*').eq('student_id', user.id).eq('is_correct', true);
      if (ans) setTotalScore(ans.length);
    } catch (e) { console.error(e); }
  };

  const fetchClassDetails = async (classId) => {
    try {
      const { data: a } = await supabase.from('assignments').select('*').eq('class_id', classId).order('due_date', { ascending: true });
      setAssignments(a || []);
      const { data: s } = await supabase.from('submissions').select('*').eq('student_id', user.id);
      setSubmissions(s || []);
      const { data: sess } = await supabase.from('sessions').select('*').eq('class_id', classId).order('created_at', { ascending: false });
      setPastSessions(sess || []);

      // Calculate real rank and accuracy
      if (isDemoMode) {
        setClassAccuracy(94);
        setClassRank(2);
      } else {
        const { data: classSessions } = await supabase.from('sessions').select('id').eq('class_id', classId);
        if (classSessions && classSessions.length > 0) {
          const sessionIds = classSessions.map(sessItem => sessItem.id);
          const { data: classQuestions } = await supabase.from('questions').select('id').in('session_id', sessionIds);
          if (classQuestions && classQuestions.length > 0) {
            const questionIds = classQuestions.map(q => q.id);
            const { data: allAnswers } = await supabase.from('answers').select('student_id, is_correct').in('question_id', questionIds);
            const { data: enrolls } = await supabase.from('enrollments').select('student_id').eq('class_id', classId);
            
            const enrolledStudentIds = enrolls?.map(e => e.student_id) || [];
            if (!enrolledStudentIds.includes(user.id)) enrolledStudentIds.push(user.id);

            const scores = {};
            enrolledStudentIds.forEach(sId => { scores[sId] = 0; });
            allAnswers?.forEach(ans => {
              if (ans.is_correct && scores[ans.student_id] !== undefined) {
                scores[ans.student_id] += 1;
              }
            });

            // Find current student accuracy
            const studentCorrect = allAnswers?.filter(ansItem => ansItem.student_id === user.id && ansItem.is_correct).length || 0;
            const studentTotal = allAnswers?.filter(ansItem => ansItem.student_id === user.id).length || 0;
            const accuracy = studentTotal > 0 ? Math.round((studentCorrect / studentTotal) * 100) : 0;
            setClassAccuracy(accuracy);

            // Calculate Rank
            const sortedStudents = Object.entries(scores).sort((entryA, entryB) => entryB[1] - entryA[1]);
            const rankIndex = sortedStudents.findIndex(entry => entry[0] === user.id);
            setClassRank(rankIndex !== -1 ? rankIndex + 1 : 1);
          } else {
            setClassAccuracy(0);
            setClassRank(1);
          }
        } else {
          setClassAccuracy(0);
          setClassRank(1);
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleJoinClass = async (e) => {
    e.preventDefault();
    if (joinCode.length !== 6) { setJoinMsg('Enter 6-digit code.'); return; }
    setJoinLoading(true); setJoinMsg('');
    if (isDemoMode) {
      const cls = { id: `demo-j${Date.now()}`, name: 'Demo Class', subject: 'DEMO101', join_code: joinCode };
      setEnrollments(prev => [...prev, cls]); setSelectedClass(cls);
      setJoinCode(''); setJoinMsg('Enrolled! (Demo)'); setJoinLoading(false); return;
    }
    try {
      const { data: cls } = await supabase.from('classes').select('*').eq('join_code', joinCode).single();
      if (!cls) { setJoinMsg('Class not found.'); setJoinLoading(false); return; }
      if (enrollments.some(e => e.id === cls.id)) { setJoinMsg('Already enrolled.'); setJoinLoading(false); return; }
      await supabase.from('enrollments').insert({ student_id: user.id, class_id: cls.id });
      setJoinCode(''); setJoinMsg('Enrolled!'); fetchEnrollments(); setSelectedClass(cls);
    } catch (err) { setJoinMsg(err.message); }
    setJoinLoading(false);
  };

  const handleSubmitAssignment = async (assignmentId) => {
    const text = submissionTexts[assignmentId];
    if (!text?.trim()) return;
    if (isDemoMode) {
      setSubmissions(prev => [...prev, { id: `demo-sub-${Date.now()}`, assignment_id: assignmentId, student_id: user.id, file_url: text, grade: '', submitted_at: new Date().toISOString() }]);
      setSubmissionTexts({ ...submissionTexts, [assignmentId]: '' }); return;
    }
    try {
      await supabase.from('submissions').insert({ assignment_id: assignmentId, student_id: user.id, file_url: text });
      setSubmissionTexts({ ...submissionTexts, [assignmentId]: '' });
      if (selectedClass) fetchClassDetails(selectedClass.id);
    } catch (e) { alert(e.message); }
  };

  const handleCheckActiveSession = async () => {
    if (!selectedClass) return;
    if (isDemoMode) {
      const active = DEMO_SESSIONS_S.find(s => s.is_active && s.class_id === selectedClass.id);
      if (active) navigateTo('student-session', { sessionId: active.id });
      else alert('No active session. Wait for your instructor.');
      return;
    }
    try {
      const { data: sess } = await supabase.from('sessions').select('*').eq('class_id', selectedClass.id).eq('is_active', true).order('created_at', { ascending: false });
      if (sess?.length > 0) navigateTo('student-session', { sessionId: sess[0].id });
      else alert('No active session. Wait for your instructor.');
    } catch (e) { alert(e.message); }
  };

  const pending = assignments.filter(a => !submissions.find(s => s.assignment_id === a.id));

  return (
    <div className="space-y-6 select-none fade-in">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card stat-card-green"><p className="stat-number">{totalScore * 10}</p><p className="stat-label">Total Points</p></div>
        <div className="stat-card stat-card-blue"><p className="stat-number">{enrollments.length}</p><p className="stat-label">Classes Joined</p></div>
        <div className="stat-card stat-card-orange"><p className="stat-number">{pending.length}</p><p className="stat-label">Pending Tasks</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* My Classrooms */}
          <div className="card" id="classrooms-section">
            <h3 className="text-[15px] font-semibold mb-3">My Classrooms</h3>
            <div className="space-y-1">
              {enrollments.length === 0 ? <p className="text-[13px] text-[var(--text-secondary)] py-4">Not enrolled yet.</p> :
                enrollments.map(cls => (
                  <div key={cls.id} onClick={() => setSelectedClass(cls)}
                    className="w-full text-left p-3 rounded-xl flex items-center justify-between transition-all hover:bg-black/[0.02] cursor-pointer"
                    style={selectedClass?.id === cls.id ? { background: 'rgba(0,122,255,0.06)' } : {}}>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: selectedClass?.id === cls.id ? 'var(--apple-blue)' : 'var(--text-tertiary)' }} />
                      <div><p className="text-[13px] font-medium">{cls.name}</p><p className="text-[11px] text-[var(--text-secondary)]">{cls.subject}</p></div>
                    </div>
                    {selectedClass?.id === cls.id
                      ? <button onClick={e => { e.stopPropagation(); handleCheckActiveSession(); }} className="btn-primary text-[11px] py-1 px-3">Join Quiz</button>
                      : <span className="text-[11px] text-[var(--text-tertiary)]">Idle</span>}
                  </div>
                ))}
            </div>
          </div>

          {/* Join */}
          <div className="card">
            <h4 className="text-[13px] font-semibold mb-3">Join a Classroom</h4>
            <form onSubmit={handleJoinClass} className="flex gap-3">
              <input type="text" placeholder="6-digit code" maxLength={6} value={joinCode} onChange={e => setJoinCode(e.target.value.replace(/\D/g, ''))} className="input-dark flex-1 font-mono tracking-widest font-bold" />
              <button type="submit" disabled={joinLoading} className="btn-primary text-[12px] px-5 disabled:opacity-50">{joinLoading ? '...' : 'Join →'}</button>
            </form>
            {joinMsg && <p className="text-[12px] font-medium mt-2" style={{ color: joinMsg.includes('Enrolled') ? '#248A3D' : 'var(--apple-red)' }}>{joinMsg}</p>}
          </div>

          {/* Assignments */}
          <div className="card" id="assignments-section">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold">Assignments</h3>
              {pending.length > 0 && <span className="badge badge-amber text-[10px]">{pending.length} pending</span>}
            </div>
            <div className="space-y-2">
              {assignments.length === 0 ? <p className="text-[13px] text-[var(--text-secondary)] py-4">No assignments.</p> :
                assignments.map(a => {
                  const sub = submissions.find(s => s.assignment_id === a.id);
                  return (
                    <div key={a.id} className="p-3.5 rounded-xl space-y-2" style={{ background: 'var(--bg-tertiary)' }}>
                      <div className="flex justify-between items-start">
                        <div><p className="text-[13px] font-medium">{a.title}</p><p className="text-[11px] text-[var(--text-secondary)]">{a.description}</p></div>
                        <span className="badge badge-amber text-[10px] shrink-0">Due {new Date(a.due_date).toLocaleDateString()}</span>
                      </div>
                      {sub ? (
                        <div className="flex items-center gap-2">
                          <span className="badge badge-green text-[10px]"><CheckCircle className="w-3 h-3 mr-0.5" />Submitted</span>
                          {sub.grade && <span className="badge badge-violet text-[10px]">Grade: {sub.grade}</span>}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input type="text" placeholder="Write or paste link..." value={submissionTexts[a.id] || ''} onChange={e => setSubmissionTexts({ ...submissionTexts, [a.id]: e.target.value })} className="input-dark flex-1 text-[12px]" />
                          <button onClick={() => handleSubmitAssignment(a.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ background: 'var(--apple-blue)' }}>
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-5">
          {selectedClass ? (
            <>
              <div className="card">
                <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Classroom</p>
                <h2 className="text-[22px] font-bold tracking-tight mt-1">{selectedClass.name}</h2>
                <p className="text-[13px] text-[var(--text-secondary)]">{selectedClass.subject}</p>
                <div className="flex items-center gap-4 mt-4">
                  <div className="relative w-14 h-14">
                    <svg width="56" height="56" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="4" />
                      <circle cx="28" cy="28" r="24" fill="none" stroke="var(--apple-blue)" strokeWidth="4" strokeLinecap="round"
                        style={{ strokeDasharray: `${2 * Math.PI * 24}`, strokeDashoffset: `${2 * Math.PI * 24 * (1 - classAccuracy / 100)}`, transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold" style={{ color: 'var(--apple-blue)' }}>{classAccuracy}%</span>
                  </div>
                  <div>
                    <p className="text-[11px] text-[var(--text-secondary)]">Class Rank</p>
                    <p className="text-[20px] font-bold" style={{ color: 'var(--apple-blue)' }}>#{classRank}</p>
                  </div>
                </div>
              </div>

              <div className="card" id="notes-section">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[15px] font-semibold">Lecture Notes</h3>
                  <span className="badge badge-green text-[10px]">AI Generated</span>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {pastSessions.filter(s => s.summary).length === 0 ? <p className="text-[13px] text-[var(--text-secondary)] py-2">No notes yet.</p> :
                    pastSessions.filter(s => s.summary).map(sess => (
                      <button key={sess.id} onClick={() => setViewingSummary(sess)}
                        className="w-full text-left p-3 rounded-xl hover:bg-black/[0.02] transition-all" style={{ background: 'var(--bg-tertiary)' }}>
                        <p className="text-[13px] font-medium">{sess.summary.substring(0, 40)}...</p>
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{new Date(sess.created_at).toLocaleDateString()}</p>
                      </button>
                    ))}
                </div>
              </div>
            </>
          ) : (
            <div className="card text-center py-12">
              <BookOpen className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
              <h3 className="text-[15px] font-semibold">No Classroom</h3>
              <p className="text-[13px] text-[var(--text-secondary)] mt-1">Join a class to get started.</p>
            </div>
          )}
        </div>
      </div>

      {viewingSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-2xl card overflow-hidden max-h-[85vh] flex flex-col" style={{ boxShadow: 'var(--shadow-float)' }}>
            <div className="flex items-center justify-between pb-3 mb-3" style={{ borderBottom: '1px solid var(--border-default)' }}>
              <h4 className="text-[15px] font-semibold">📚 Lecture Notes</h4>
              <button onClick={() => setViewingSummary(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-black/[0.04]"><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
            </div>
            <div className="overflow-y-auto text-[13px] text-[var(--text-secondary)] leading-relaxed space-y-2">
              {viewingSummary.summary.split('\n').map((line, i) => {
                if (line.startsWith('###')) return <h5 key={i} className="font-semibold text-[var(--text-primary)] text-[15px] mt-3 mb-1">{line.replace('###', '')}</h5>;
                if (line.startsWith('*') || line.startsWith('-')) return <li key={i} className="ml-4 list-disc">{line.replace(/^[\*\-]\s*/, '')}</li>;
                return <p key={i}>{line}</p>;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
