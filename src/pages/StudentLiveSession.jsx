import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import QuestionCanvas from '../components/QuestionCanvas';
import CircularTimer from '../components/CircularTimer';
import WarningModal from '../components/WarningModal';
import LiveLeaderboard from '../components/LiveLeaderboard';
import useAntiCheat from '../hooks/useAntiCheat';
import { ShieldCheck, Award, LogOut, Clock, Play, HelpCircle, FileText } from 'lucide-react';
import confetti from 'canvas-confetti';

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(array, seedString) {
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) seed += seedString.charCodeAt(i);
  const rand = mulberry32(seed);
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function StudentLiveSession({ sessionId, user, profile, navigateTo }) {
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [waiting, setWaiting] = useState(true);
  const [quizFinished, setQuizFinished] = useState(false);
  const [lockedOut, setLockedOut] = useState(false);
  const [lockoutReason, setLockoutReason] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [timerDuration, setTimerDuration] = useState(15);
  const startTime = useRef(null);
  const [warningOpen, setWarningOpen] = useState(false);
  const [currentViolationCount, setCurrentViolationCount] = useState(0);
  const [studentScore, setStudentScore] = useState(0);
  const [liveAnswers, setLiveAnswers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [cheatLogs, setCheatLogs] = useState([]);
  const [students, setStudents] = useState({});

  const isAntiCheatActive = !waiting && !quizFinished && !lockedOut;
  const { getViolationCount } = useAntiCheat({
    sessionId, studentId: user.id, active: isAntiCheatActive,
    onWarning: (count) => { setCurrentViolationCount(count); setWarningOpen(true); },
    onLockout: (reason) => { handleLockoutSubmit(reason); }
  });

  useEffect(() => {
    joinAndMarkAttendance();
    fetchSessionDetails();
    const sessionChannel = supabase.channel('session_status').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, (payload) => { handleSessionUpdate(payload.new); }).subscribe();
    return () => { supabase.removeChannel(sessionChannel); };
  }, [sessionId]);

  useEffect(() => {
    if (!quizFinished && !lockedOut) return;
    fetchAttendance(); fetchLiveAnswers(); fetchCheatLogs();
    const answersChannel = supabase.channel('student_results').on('postgres_changes', { event: 'INSERT', table: 'answers' }, fetchLiveAnswers).on('postgres_changes', { event: 'UPDATE', table: 'answers' }, fetchLiveAnswers).subscribe();
    return () => { supabase.removeChannel(answersChannel); };
  }, [quizFinished, lockedOut]);

  const joinAndMarkAttendance = async () => { try { await supabase.from('attendance').insert({ session_id: sessionId, student_id: user.id }); } catch (e) { console.warn('Attendance already marked:', e.message); } };

  const fetchSessionDetails = async () => {
    try {
      const { data: sess, error } = await supabase.from('sessions').select(`*, classes:class_id (name, subject)`).eq('id', sessionId).single();
      if (error) throw error;
      setSession(sess); setTimerDuration(sess.timer_duration || 15);
      if (sess.questions_released) { setWaiting(false); fetchQuestionsAndShuffle(); }
      const { data: enrolls } = await supabase.from('enrollments').select('student_id, users:student_id(id, name, department, semester)').eq('class_id', sess.class_id);
      if (enrolls) { const smap = {}; enrolls.forEach(e => { if (e.users) smap[e.student_id] = e.users; }); setStudents(smap); }
    } catch (e) { console.error('Error fetching session:', e); }
  };

  const fetchAttendance = async () => { const { data } = await supabase.from('attendance').select('*').eq('session_id', sessionId); if (data) setAttendance(data); };
  const fetchLiveAnswers = async () => { if (questions.length === 0) return; const qIds = questions.map(q => q.id); const { data } = await supabase.from('answers').select('*').in('question_id', qIds); if (data) setLiveAnswers(data); };
  const fetchCheatLogs = async () => { const { data } = await supabase.from('cheat_logs').select('*').eq('session_id', sessionId); if (data) setCheatLogs(data); };

  const handleSessionUpdate = (newSess) => { setSession(prev => ({ ...prev, ...newSess })); setTimerDuration(newSess.timer_duration || 15); if (newSess.questions_released && waiting) { setWaiting(false); fetchQuestionsAndShuffle(); } };

  const fetchQuestionsAndShuffle = async () => {
    try {
      const { data: qs, error } = await supabase.from('questions').select('*').eq('session_id', sessionId);
      if (error) throw error;
      if (qs && qs.length > 0) {
        const shuffled = seededShuffle(qs, user.id); setQuestions(shuffled);
        await supabase.from('student_question_order').insert({ session_id: sessionId, student_id: user.id, question_order: shuffled.map(q => q.id) }).select();
        startTime.current = Date.now();
      }
    } catch (e) { console.error('Shuffling failed:', e); }
  };

  const handleSelectAnswer = (optionCode) => { setSelectedAnswer(optionCode); };

  const handleQuestionSubmit = async () => {
    const currentQ = questions[currentIdx]; if (!currentQ) return;
    const timeTaken = Date.now() - startTime.current;
    const selectedLetter = selectedAnswer || '';
    const isCorrect = selectedLetter === currentQ.correct_answer;
    const isFlagged = getViolationCount() > 0;
    try { await supabase.from('answers').insert({ student_id: user.id, question_id: currentQ.id, selected_answer: selectedLetter || null, is_correct: isCorrect, time_taken_ms: timeTaken, flagged: isFlagged, flag_reason: isFlagged ? 'focus_loss' : '' }); if (isCorrect) setStudentScore(prev => prev + 1); } catch (e) { console.error('Answer error:', e); }
    advanceQuestion();
  };

  const handleLockoutSubmit = async (reason) => {
    setLockedOut(true); setLockoutReason(reason); setWarningOpen(false);
    try { const inserts = questions.slice(currentIdx).map(q => ({ student_id: user.id, question_id: q.id, selected_answer: null, is_correct: false, time_taken_ms: 0, flagged: true, flag_reason: `lockout_${reason}` })); await supabase.from('answers').insert(inserts); } catch (e) { console.error('Lockout error:', e); }
    setQuizFinished(true);
  };

  const advanceQuestion = () => {
    setSelectedAnswer('');
    if (currentIdx + 1 < questions.length) { setCurrentIdx(prev => prev + 1); startTime.current = Date.now(); }
    else { setQuizFinished(true); confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); }
  };

  const getLeaderboardData = () => {
    if (questions.length === 0) return [];
    const studentStats = {};
    liveAnswers.forEach(ans => {
      const sId = ans.student_id;
      if (!studentStats[sId]) { const prof = students[sId] || { name: 'Unknown', department: 'CS', semester: '1' }; studentStats[sId] = { studentId: sId, name: prof.name, department: prof.department, semester: prof.semester, score: 0, totalTime: 0, answeredCount: 0, flaggedCount: 0 }; }
      studentStats[sId].answeredCount += 1; studentStats[sId].totalTime += ans.time_taken_ms; if (ans.is_correct) studentStats[sId].score += 1;
    });
    cheatLogs.forEach(log => { if (studentStats[log.student_id]) studentStats[log.student_id].flaggedCount += 1; });
    return Object.values(studentStats).map(stat => ({ ...stat, totalQuestions: questions.length, avgTime: stat.answeredCount > 0 ? stat.totalTime / stat.answeredCount : 0 }));
  };

  const leaderboardData = getLeaderboardData();
  const currentQuestion = questions[currentIdx];

  return (
    <div className="max-w-4xl mx-auto space-y-6 select-none fade-in">
      {/* WAITING */}
      {waiting && (
        <div className="card p-12 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'rgba(0,122,255,0.06)', animation: 'live-pulse 2s ease-in-out infinite' }}>
            <Clock className="w-8 h-8" style={{ color: 'var(--apple-blue)' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Waiting for Instructor</h2>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">The quiz will start automatically when questions are released.</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-[12px] font-medium px-3 py-1.5 rounded-full w-max mx-auto" style={{ background: 'rgba(0,122,255,0.06)', color: 'var(--apple-blue)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--apple-blue)', animation: 'live-pulse 1.5s ease-in-out infinite' }} />
            <span>Connected to live session...</span>
          </div>
        </div>
      )}

      {/* ACTIVE TEST */}
      {!waiting && !quizFinished && currentQuestion && (
        <div className="card p-6 space-y-5">
          <div className="flex justify-between items-center pb-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-3">
              <span className="live-badge"><span className="dot" />Secure Exam</span>
              <span className="text-[12px] font-medium text-[var(--text-secondary)]">Q {currentIdx + 1} / {questions.length}</span>
            </div>
            <CircularTimer duration={timerDuration} onTimeUp={handleQuestionSubmit} questionId={currentQuestion.id} />
          </div>

          <div className="pointer-events-none">
            <QuestionCanvas questionText={currentQuestion.question_text} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            {currentQuestion.options?.map((opt, optIdx) => {
              const letter = String.fromCharCode(65 + optIdx);
              const isSelected = selectedAnswer === letter;
              return (
                <button key={optIdx} onClick={() => handleSelectAnswer(letter)}
                  className="p-4 rounded-xl text-left font-medium text-[13px] transition-all flex items-center gap-3 cursor-pointer"
                  style={{
                    background: isSelected ? 'rgba(0,122,255,0.06)' : 'var(--bg-tertiary)',
                    border: isSelected ? '2px solid var(--apple-blue)' : '1px solid var(--border-default)',
                    color: isSelected ? 'var(--apple-blue)' : 'var(--text-primary)',
                  }}>
                  <span className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[12px] shrink-0 transition-all" style={{
                    background: isSelected ? 'var(--apple-blue)' : 'rgba(0,0,0,0.04)',
                    color: isSelected ? 'white' : 'var(--text-secondary)'
                  }}>
                    {letter}
                  </span>
                  <span className="truncate">{opt.substring(3)}</span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-3" style={{ borderTop: '1px solid var(--border-default)' }}>
            <button onClick={handleQuestionSubmit} className="btn-primary flex items-center gap-2">Submit Answer</button>
          </div>
        </div>
      )}

      {/* COMPLETED */}
      {quizFinished && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-5">
            <div className="card p-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'var(--apple-green)' }}>
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              
              <div>
                {lockedOut ? (
                  <div className="p-3 rounded-xl mb-3 font-medium text-[13px]" style={{ background: 'rgba(255,59,48,0.06)', color: 'var(--apple-red)' }}>
                    🔒 Locked out: "{lockoutReason.replace('_', ' ')}". Auto-submitted.
                  </div>
                ) : (
                  <span className="badge badge-green text-[11px]">Quiz Completed</span>
                )}
                
                <h2 className="text-[28px] font-bold mt-3 tracking-tight">
                  Score: <span className="gradient-text">{studentScore}</span> / {questions.length}
                </h2>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1">Answers synced to database.</p>
              </div>

              {session?.is_active ? (
                <div className="pt-5" style={{ borderTop: '1px solid var(--border-default)' }}>
                  <div className="flex items-center justify-center gap-2 text-[12px] font-medium px-3 py-2 rounded-xl w-max mx-auto" style={{ background: 'rgba(0,122,255,0.06)', color: 'var(--apple-blue)', animation: 'live-pulse 2s ease-in-out infinite' }}>
                    Waiting for instructor to release notes...
                  </div>
                </div>
              ) : (
                <div className="pt-5 space-y-3" style={{ borderTop: '1px solid var(--border-default)' }}>
                  <h3 className="font-semibold text-[13px] text-left flex items-center gap-2">
                    <FileText className="w-4 h-4" style={{ color: 'var(--apple-blue)' }} />
                    AI-Generated Study Notes
                  </h3>
                  <div className="text-left text-[12px] text-[var(--text-secondary)] leading-relaxed p-4 rounded-xl max-h-[220px] overflow-y-auto space-y-2" style={{ background: 'var(--bg-tertiary)' }}>
                    {session?.summary?.split('\n').map((line, idx) => {
                      if (line.startsWith('###')) return <h5 key={idx} className="font-semibold text-[13px] mt-3 mb-1" style={{ color: 'var(--apple-blue)' }}>{line.replace('###', '').trim()}</h5>;
                      if (line.startsWith('*') || line.startsWith('-')) return <li key={idx} className="ml-3 list-disc">{line.replace(/^[\*\-]\s*/, '').trim()}</li>;
                      return <p key={idx} className="my-1">{line}</p>;
                    })}
                  </div>
                </div>
              )}

              <button onClick={() => navigateTo('dashboard')} className="btn-outline w-full flex items-center justify-center gap-2">
                <LogOut className="w-4 h-4" />
                <span>Return to Dashboard</span>
              </button>
            </div>
          </div>

          <div className="md:col-span-1">
            <LiveLeaderboard leaderboardData={leaderboardData} showFlags={false} />
          </div>
        </div>
      )}

      <WarningModal isOpen={warningOpen} violationCount={currentViolationCount} onClose={() => setWarningOpen(false)} />
    </div>
  );
}
