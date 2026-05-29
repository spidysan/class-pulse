import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FileText, Users, Award, ShieldAlert, Clock, ArrowLeft, Check, X } from 'lucide-react';

export default function ClassAnalytics({ sessionId, navigateTo, isDemoMode }) {
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [cheatLogs, setCheatLogs] = useState([]);
  const [students, setStudents] = useState({});
  const [loading, setLoading] = useState(true);

  // ─── Demo Data ────────────────────────────────
  const DEMO_SESSION = { id: sessionId, class_id: 'demo-c1', is_active: false, created_at: '2026-05-28T09:00:00Z', timer_duration: 15, summary: '### Binary Search Trees\n- BST properties: left < root < right\n- Insertion: O(h) where h is height\n- Balanced BSTs (AVL, Red-Black) guarantee O(log n)\n\n### Heap Sort\n- Build max-heap in O(n)\n- Extract max n times → O(n log n)\n- In-place, not stable', classes: { name: 'Data Structures & Algorithms', subject: 'CS201' } };
  const DEMO_QUESTIONS = [
    { id: 'dq1', session_id: sessionId, question_text: 'What is the worst-case time complexity of BST search?', options: ['A. O(1)', 'B. O(log n)', 'C. O(n)', 'D. O(n²)'], correct_answer: 'C' },
    { id: 'dq2', session_id: sessionId, question_text: 'Which data structure is used in heap sort?', options: ['A. Stack', 'B. Queue', 'C. Binary Heap', 'D. Hash Table'], correct_answer: 'C' },
    { id: 'dq3', session_id: sessionId, question_text: 'AVL trees maintain a balance factor of at most?', options: ['A. 0', 'B. 1', 'C. 2', 'D. 3'], correct_answer: 'B' },
    { id: 'dq4', session_id: sessionId, question_text: 'Time complexity of building a max-heap?', options: ['A. O(n)', 'B. O(n log n)', 'C. O(log n)', 'D. O(n²)'], correct_answer: 'A' },
    { id: 'dq5', session_id: sessionId, question_text: 'Red-Black trees guarantee which property?', options: ['A. Perfect balance', 'B. O(log n) height', 'C. O(1) insertion', 'D. Sorted leaves'], correct_answer: 'B' },
  ];
  const DEMO_ANSWERS = [
    { student_id: 's1', question_id: 'dq1', is_correct: true, time_taken_ms: 8200, selected_answer: 'C', flagged: false },
    { student_id: 's1', question_id: 'dq2', is_correct: true, time_taken_ms: 5400, selected_answer: 'C', flagged: false },
    { student_id: 's1', question_id: 'dq3', is_correct: true, time_taken_ms: 6100, selected_answer: 'B', flagged: false },
    { student_id: 's1', question_id: 'dq4', is_correct: true, time_taken_ms: 4300, selected_answer: 'A', flagged: false },
    { student_id: 's1', question_id: 'dq5', is_correct: true, time_taken_ms: 7800, selected_answer: 'B', flagged: false },
    { student_id: 's2', question_id: 'dq1', is_correct: true, time_taken_ms: 9100, selected_answer: 'C', flagged: false },
    { student_id: 's2', question_id: 'dq2', is_correct: true, time_taken_ms: 6700, selected_answer: 'C', flagged: false },
    { student_id: 's2', question_id: 'dq3', is_correct: false, time_taken_ms: 11200, selected_answer: 'A', flagged: false },
    { student_id: 's2', question_id: 'dq4', is_correct: true, time_taken_ms: 5500, selected_answer: 'A', flagged: false },
    { student_id: 's2', question_id: 'dq5', is_correct: true, time_taken_ms: 8400, selected_answer: 'B', flagged: false },
    { student_id: 's3', question_id: 'dq1', is_correct: false, time_taken_ms: 12300, selected_answer: 'B', flagged: true },
    { student_id: 's3', question_id: 'dq2', is_correct: true, time_taken_ms: 7200, selected_answer: 'C', flagged: true },
    { student_id: 's3', question_id: 'dq3', is_correct: true, time_taken_ms: 8900, selected_answer: 'B', flagged: true },
    { student_id: 's3', question_id: 'dq4', is_correct: false, time_taken_ms: 14100, selected_answer: 'C', flagged: true },
    { student_id: 's3', question_id: 'dq5', is_correct: false, time_taken_ms: 10200, selected_answer: 'A', flagged: true },
    { student_id: 's4', question_id: 'dq1', is_correct: true, time_taken_ms: 7400, selected_answer: 'C', flagged: false },
    { student_id: 's4', question_id: 'dq2', is_correct: true, time_taken_ms: 4800, selected_answer: 'C', flagged: false },
    { student_id: 's4', question_id: 'dq3', is_correct: true, time_taken_ms: 5900, selected_answer: 'B', flagged: false },
    { student_id: 's4', question_id: 'dq4', is_correct: true, time_taken_ms: 3900, selected_answer: 'A', flagged: false },
    { student_id: 's4', question_id: 'dq5', is_correct: true, time_taken_ms: 6200, selected_answer: 'B', flagged: false },
  ];
  const DEMO_ATTENDANCE = [{ student_id: 's1' }, { student_id: 's2' }, { student_id: 's3' }, { student_id: 's4' }, { student_id: 's5' }];
  const DEMO_CHEATS = [
    { id: 'cl1', student_id: 's3', event_type: 'tab_switch', timestamp: '2026-05-28T09:12:00Z', session_id: sessionId },
    { id: 'cl2', student_id: 's3', event_type: 'tab_switch', timestamp: '2026-05-28T09:14:30Z', session_id: sessionId },
  ];
  const DEMO_STUDENTS = {
    s1: { id: 's1', name: 'Arjun Menon', email: 'arjun@iitm.edu', department: 'CS', semester: '4' },
    s2: { id: 's2', name: 'Sneha Reddy', email: 'sneha@iitm.edu', department: 'CS', semester: '4' },
    s3: { id: 's3', name: 'Rahul Kumar', email: 'rahul@iitm.edu', department: 'CS', semester: '4' },
    s4: { id: 's4', name: 'Divya Nair', email: 'divya@iitm.edu', department: 'CS', semester: '4' },
    s5: { id: 's5', name: 'Karthik Sharma', email: 'karthik@iitm.edu', department: 'CS', semester: '4' },
  };

  useEffect(() => {
    if (isDemoMode) {
      setSession(DEMO_SESSION);
      setQuestions(DEMO_QUESTIONS);
      setAnswers(DEMO_ANSWERS);
      setAttendance(DEMO_ATTENDANCE);
      setCheatLogs(DEMO_CHEATS);
      setStudents(DEMO_STUDENTS);
      setLoading(false);
    } else {
      fetchAnalyticsData();
    }
  }, [sessionId]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const { data: sess, error: sessErr } = await supabase.from('sessions').select(`*, classes:class_id (name, subject)`).eq('id', sessionId).single();
      if (sessErr) throw sessErr;
      setSession(sess);
      const { data: qs, error: qErr } = await supabase.from('questions').select('*').eq('session_id', sessionId);
      if (qErr) throw qErr;
      setQuestions(qs || []);
      if (qs && qs.length > 0) {
        const qIds = qs.map(q => q.id);
        const { data: ans } = await supabase.from('answers').select('*').in('question_id', qIds);
        setAnswers(ans || []);
      }
      const { data: att } = await supabase.from('attendance').select('*').eq('session_id', sessionId);
      setAttendance(att || []);
      const { data: cl } = await supabase.from('cheat_logs').select('*').eq('session_id', sessionId).order('timestamp', { ascending: false });
      setCheatLogs(cl || []);
      const { data: enrolls } = await supabase.from('enrollments').select(`student_id, users:student_id (id, name, email, department, semester)`).eq('class_id', sess.class_id);
      if (enrolls) { const smap = {}; enrolls.forEach(e => { if (e.users) smap[e.student_id] = e.users; }); setStudents(smap); }
    } catch (e) { console.error('Error loading analytics:', e); }
    setLoading(false);
  };

  if (loading) return <div className="text-center py-12 text-[var(--text-secondary)] font-medium select-none">Compiling session analytics...</div>;
  if (!session) return <div className="text-center py-12 font-medium select-none" style={{ color: 'var(--apple-red)' }}>Session not found.</div>;

  const totalAttendance = attendance.length;
  const totalQuestionsCount = questions.length;
  const studentScores = {};
  answers.forEach(ans => { if (!studentScores[ans.student_id]) studentScores[ans.student_id] = 0; if (ans.is_correct) studentScores[ans.student_id] += 1; });
  const scoresArray = Object.values(studentScores);
  const avgScore = scoresArray.length > 0 ? (scoresArray.reduce((sum, s) => sum + s, 0) / scoresArray.length).toFixed(1) : '0';
  const avgTimeTakenMs = answers.length > 0 ? answers.reduce((sum, a) => sum + a.time_taken_ms, 0) / answers.length : 0;
  const flaggedStudentsSet = new Set(cheatLogs.map(l => l.student_id));
  const flaggedCount = flaggedStudentsSet.size;

  const getQuestionStats = (qId) => {
    const qAnswers = answers.filter(a => a.question_id === qId);
    const correctAnswers = qAnswers.filter(a => a.is_correct).length;
    const totalAns = qAnswers.length;
    const qTime = totalAns > 0 ? qAnswers.reduce((sum, a) => sum + a.time_taken_ms, 0) / totalAns : 0;
    const accuracy = totalAns > 0 ? Math.round((correctAnswers / totalAns) * 100) : 0;
    return { accuracy, correctAnswers, incorrectAnswers: totalAns - correctAnswers, totalAns, avgTime: (qTime / 1000).toFixed(1) };
  };

  return (
    <div className="space-y-6 select-none pb-12 fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigateTo('dashboard')} className="p-2 rounded-xl transition-all hover:bg-black/[0.04]" style={{ border: '1px solid var(--border-default)' }}>
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <div>
          <h2 className="text-[22px] font-bold tracking-tight">Session <span className="gradient-text">Report</span></h2>
          <p className="text-[13px] text-[var(--text-secondary)]">{session.classes?.name} • {new Date(session.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card stat-card-blue"><p className="stat-number">{totalAttendance}</p><p className="stat-label">Attendance</p></div>
        <div className="stat-card stat-card-green"><p className="stat-number">{avgScore}<span className="text-[12px] font-normal text-[var(--text-tertiary)]"> /{totalQuestionsCount}</span></p><p className="stat-label">Avg Score</p></div>
        <div className="stat-card stat-card-purple"><p className="stat-number">{(avgTimeTakenMs / 1000).toFixed(1)}s</p><p className="stat-label">Avg Response</p></div>
        <div className="stat-card stat-card-orange"><p className="stat-number">{flaggedCount}</p><p className="stat-label">Flagged</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Notes */}
        <div className="lg:col-span-1">
          <div className="card">
            <h3 className="text-[15px] font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" style={{ color: 'var(--apple-blue)' }} />
              AI Lecture Notes
            </h3>
            <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed space-y-1.5">
              {session.summary ? (
                session.summary.split('\n').map((line, idx) => {
                  if (line.startsWith('###')) return <h4 key={idx} className="font-semibold text-[13px] mt-3 mb-1" style={{ color: 'var(--apple-blue)' }}>{line.replace('###', '').trim()}</h4>;
                  if (line.startsWith('*') || line.startsWith('-')) return <li key={idx} className="ml-4 list-disc">{line.replace(/^[\*\-]\s*/, '').trim()}</li>;
                  return <p key={idx} className="my-0.5">{line}</p>;
                })
              ) : (
                <p className="text-[var(--text-tertiary)]">No lecture summary available.</p>
              )}
            </div>
          </div>
        </div>

        {/* Questions + Security */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card">
            <h3 className="text-[15px] font-semibold mb-4">Question Accuracy</h3>
            <div className="space-y-4">
              {questions.map((q, idx) => {
                const stats = getQuestionStats(q.id);
                const barColor = stats.accuracy >= 70 ? 'var(--apple-green)' : stats.accuracy >= 40 ? 'var(--apple-orange)' : 'var(--apple-red)';
                return (
                  <div key={q.id} className="p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                      <div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{ color: 'var(--apple-blue)', background: 'rgba(0,122,255,0.06)' }}>Q{idx + 1}</span>
                        <h4 className="font-medium text-[13px] mt-1">{q.question_text}</h4>
                      </div>
                      <span className="text-[11px] text-[var(--text-tertiary)] font-medium flex items-center shrink-0">
                        <Clock className="w-3.5 h-3.5 mr-1" />{stats.avgTime}s avg
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[12px] font-medium">
                        <span className="text-[var(--text-secondary)]">Answer: <span style={{ color: 'var(--apple-blue)' }}>{q.correct_answer}</span></span>
                        <span style={{ color: barColor }}>{stats.accuracy}% accuracy</span>
                      </div>
                      <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: 'rgba(0,0,0,0.04)' }}>
                        <div className="h-2 rounded-full transition-all" style={{ width: `${stats.accuracy}%`, background: barColor }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security Audit */}
          <div className="card">
            <h3 className="text-[15px] font-semibold mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" style={{ color: 'var(--apple-red)' }} />
              Security Audit
            </h3>
            <div className="space-y-1">
              {cheatLogs.length === 0 ? (
                <p className="text-center py-6 text-[var(--text-tertiary)] text-[13px]">✅ Full compliance. No violations logged.</p>
              ) : (
                cheatLogs.map(log => {
                  const student = students[log.student_id] || { name: 'Unknown', email: '' };
                  return (
                    <div key={log.id} className="py-2.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2" style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[13px]">{student.name}</span>
                          <span className="text-[11px] text-[var(--text-tertiary)]">({student.email})</span>
                        </div>
                        <p className="text-[12px] font-medium mt-0.5 flex items-center" style={{ color: 'var(--apple-red)' }}>
                          <X className="w-3 h-3 mr-1" />
                          {log.event_type?.replace('_', ' ')}
                        </p>
                      </div>
                      <span className="text-[11px] text-[var(--text-tertiary)] font-mono shrink-0">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
