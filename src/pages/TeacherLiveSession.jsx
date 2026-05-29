import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import LiveLeaderboard from '../components/LiveLeaderboard';
import { Mic, MicOff, AlertCircle, Play, Eye, Edit2, Check, X, ShieldAlert, Award, FileText, Settings, HelpCircle } from 'lucide-react';

export default function TeacherLiveSession({ sessionId, navigateTo }) {
  const [session, setSession] = useState(null);
  const [className, setClassName] = useState('');
  
  // Real-time voice state
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState(null);

  // AI settings
  const [numQuestions, setNumQuestions] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [timerDuration, setTimerDuration] = useState(15);

  // Testing status
  const [questionsReleased, setQuestionsReleased] = useState(false);
  
  // Real-time stats
  const [attendance, setAttendance] = useState([]);
  const [liveAnswers, setLiveAnswers] = useState([]);
  const [cheatLogs, setCheatLogs] = useState([]);
  const [students, setStudents] = useState({});
  
  const recognitionRef = useRef(null);

  useEffect(() => {
    fetchSessionDetails();
    initSpeechRecognition();
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    fetchAttendance();
    fetchLiveAnswers();
    fetchCheatLogs();

    const attendanceChannel = supabase
      .channel('attendance_live')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'attendance',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        setAttendance((prev) => {
          if (prev.some(a => a.student_id === payload.new.student_id)) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();

    const answersChannel = supabase
      .channel('answers_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers' }, (payload) => {
        handleIncomingAnswer(payload.new);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'answers' }, (payload) => {
        handleIncomingAnswer(payload.new);
      })
      .subscribe();

    const cheatChannel = supabase
      .channel('cheat_live')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'cheat_logs',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        setCheatLogs((prev) => [payload.new, ...prev]);
        updateStudentCheatAlert(payload.new.student_id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(answersChannel);
      supabase.removeChannel(cheatChannel);
    };
  }, [sessionId, generatedQuestions]);

  const fetchSessionDetails = async () => {
    try {
      const { data: sess, error: sessErr } = await supabase
        .from('sessions')
        .select(`*, classes:class_id (name, subject)`)
        .eq('id', sessionId)
        .single();

      if (sessErr) throw sessErr;
      setSession(sess);
      setClassName(sess.classes?.name || 'Class');
      setTimerDuration(sess.timer_duration || 15);
      setQuestionsReleased(sess.questions_released);

      if (sess.questions_released) {
        const { data: qs, error: qErr } = await supabase
          .from('questions').select('*').eq('session_id', sessionId);
        if (!qErr && qs) setGeneratedQuestions(qs);
      }

      const { data: enrolls, error: enrollErr } = await supabase
        .from('enrollments')
        .select(`student_id, users:student_id (id, name, college, department, semester)`)
        .eq('class_id', sess.class_id);

      if (!enrollErr && enrolls) {
        const studentMap = {};
        enrolls.forEach(e => { if (e.users) studentMap[e.student_id] = e.users; });
        setStudents(studentMap);
      }
    } catch (e) {
      console.error('Error fetching session:', e);
    }
  };

  const fetchAttendance = async () => {
    const { data } = await supabase.from('attendance').select('*').eq('session_id', sessionId);
    if (data) setAttendance(data);
  };

  const fetchLiveAnswers = async () => {
    const { data: qs } = await supabase.from('questions').select('id').eq('session_id', sessionId);
    if (qs && qs.length > 0) {
      const qIds = qs.map(q => q.id);
      const { data: ans } = await supabase.from('answers').select('*').in('question_id', qIds);
      if (ans) setLiveAnswers(ans);
    }
  };

  const fetchCheatLogs = async () => {
    const { data } = await supabase.from('cheat_logs').select('*').eq('session_id', sessionId).order('timestamp', { ascending: false });
    if (data) setCheatLogs(data);
  };

  const handleIncomingAnswer = (newAns) => {
    const isOurQuestion = generatedQuestions.some(q => q.id === newAns.question_id);
    if (isOurQuestion) {
      setLiveAnswers((prev) => {
        const index = prev.findIndex(a => a.student_id === newAns.student_id && a.question_id === newAns.question_id);
        if (index !== -1) { const updated = [...prev]; updated[index] = newAns; return updated; }
        return [...prev, newAns];
      });
    }
  };

  const updateStudentCheatAlert = (studentId) => {};

  const initSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.maxAlternatives = 1;

      rec.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
        }
        if (finalTranscript) setTranscript((prev) => prev + finalTranscript);
      };

      rec.onerror = (e) => {
        console.error('Speech recognition error:', e.error);
        if (e.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access or paste transcript manually.');
          isRecordingRef.current = false; setIsRecording(false);
        } else if (e.error === 'audio-capture') {
          alert('No microphone detected! Please connect a microphone and try again, or type/paste your lecture text directly.');
          isRecordingRef.current = false; setIsRecording(false);
        } else if (e.error === 'no-speech') {
          console.log('No speech detected, continuing...');
        } else if (e.error === 'network') {
          alert('Network error during speech recognition. Please check your internet connection.');
          isRecordingRef.current = false; setIsRecording(false);
        }
      };

      rec.onend = () => {
        if (isRecordingRef.current) {
          try { setTimeout(() => { if (isRecordingRef.current) rec.start(); }, 100); }
          catch (err) { console.error('Failed to restart speech recognition:', err); }
        }
      };

      setRecognition(rec);
      recognitionRef.current = rec;
    } else {
      alert('Speech Recognition is not supported by your browser. Please use Google Chrome or Microsoft Edge for live transcription.');
    }
  };

  const toggleRecording = () => {
    if (!recognition) {
      alert('Speech Recognition is not supported by your current browser. Please use Google Chrome or Microsoft Edge, or paste/type your lecture text below.');
      return;
    }
    if (isRecording) {
      isRecordingRef.current = false; recognition.stop(); setIsRecording(false);
    } else {
      try {
        recognition.start(); isRecordingRef.current = true; setIsRecording(true);
      } catch (err) {
        try {
          recognition.stop();
          setTimeout(() => { recognition.start(); isRecordingRef.current = true; setIsRecording(true); }, 200);
        } catch (err2) { alert('Failed to start speech recognition. Please reload the page and try again.'); }
      }
    }
  };

  const generateQuestions = async () => {
    if (!transcript.trim()) { alert('Please record or type a lecture transcript first.'); return; }
    setGenerating(true);
    try {
      const res = await fetch('/api/generate-questions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, numQuestions })
      });
      const data = await res.json();
      if (data.questions) {
        setGeneratedQuestions(data.questions.map((q, idx) => ({ ...q, id: `temp-${idx}` })));
      } else { alert('Failed to generate questions: ' + (data.error || 'Unknown error')); }
    } catch (e) { alert('Error connecting to AI proxy: ' + e.message); }
    setGenerating(false);
  };

  const handleEditQuestion = (index, field, value) => {
    const updated = [...generatedQuestions]; updated[index][field] = value; setGeneratedQuestions(updated);
  };

  const handleEditOption = (qIdx, optIdx, value) => {
    const updated = [...generatedQuestions]; updated[qIdx].options[optIdx] = value; setGeneratedQuestions(updated);
  };

  const handleDeleteQuestion = (index) => {
    setGeneratedQuestions(generatedQuestions.filter((_, idx) => idx !== index));
  };

  const handleReleaseQuestions = async () => {
    if (generatedQuestions.length === 0) { alert('Generate or create some questions first.'); return; }
    try {
      setGenerating(true);
      await supabase.from('sessions').update({ timer_duration: timerDuration, questions_released: true }).eq('id', sessionId);
      const questionsToInsert = generatedQuestions.map(q => ({
        session_id: sessionId, question_text: q.question_text, options: q.options, correct_answer: q.correct_answer
      }));
      const { data: insertedQs, error } = await supabase.from('questions').insert(questionsToInsert).select();
      if (error) throw error;
      setGeneratedQuestions(insertedQs); setQuestionsReleased(true);
      alert('Questions have been released! Students can now start the quiz.');
    } catch (e) { alert('Error releasing questions: ' + e.message); }
    setGenerating(false);
  };

  const handleEndSession = async () => {
    if (!confirm('Are you sure you want to end this live session?')) return;
    setGenerating(true);
    let summaryText = 'No lecture summary generated.';
    try {
      const res = await fetch('/api/summarize-lecture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcript || '',
          className: className || session?.classes?.name || 'Computer Science',
          subject: session?.classes?.subject || 'CS'
        })
      });
      const data = await res.json();
      if (data.summary) summaryText = data.summary;

      await supabase.from('sessions').update({ is_active: false, summary: summaryText, transcript }).eq('id', sessionId);
      alert('Session completed! Redirecting to report.');
      navigateTo('analytics', { sessionId });
    } catch (e) { alert('Error closing session: ' + e.message); }
    setGenerating(false);
  };

  const getLeaderboardData = () => {
    if (generatedQuestions.length === 0) return [];
    const studentStats = {};
    liveAnswers.forEach(ans => {
      const sId = ans.student_id;
      if (!studentStats[sId]) {
        const prof = students[sId] || { name: 'Unknown Student', college: '', department: '', semester: '' };
        studentStats[sId] = { studentId: sId, name: prof.name, college: prof.college, department: prof.department, semester: prof.semester, score: 0, totalTime: 0, answeredCount: 0, flaggedCount: 0 };
      }
      studentStats[sId].answeredCount += 1;
      studentStats[sId].totalTime += ans.time_taken_ms;
      if (ans.is_correct) studentStats[sId].score += 1;
    });
    cheatLogs.forEach(log => {
      const sId = log.student_id;
      if (studentStats[sId]) { studentStats[sId].flaggedCount += 1; }
      else {
        const prof = students[sId] || { name: 'Unknown Student', college: '', department: '', semester: '' };
        studentStats[sId] = { studentId: sId, name: prof.name, college: prof.college, department: prof.department, semester: prof.semester, score: 0, totalTime: 0, answeredCount: 0, flaggedCount: 1 };
      }
    });
    return Object.values(studentStats).map(stat => ({ ...stat, totalQuestions: generatedQuestions.length, avgTime: stat.answeredCount > 0 ? stat.totalTime / stat.answeredCount : 0 }));
  };

  const leaderboardData = getLeaderboardData();

  return (
    <div className="space-y-6 select-none fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card stat-card-green"><p className="stat-number">{attendance.length}</p><p className="stat-label">Students Live</p></div>
        <div className="stat-card stat-card-blue"><p className="stat-number">{generatedQuestions.length}</p><p className="stat-label">Questions Generated</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Transcription */}
          {!questionsReleased && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold flex items-center gap-2">🎙 Live Transcription</h3>
                <div className="flex items-center gap-2">
                  {isRecording && <span className="text-[11px] font-semibold" style={{ color: 'var(--apple-red)' }}>● Recording</span>}
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: isRecording ? 'var(--apple-red)' : 'var(--text-tertiary)', animation: isRecording ? 'live-pulse 1.5s ease-in-out infinite' : 'none' }} />
                </div>
              </div>
              <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)}
                placeholder="Click record to start, or type/paste your lecture text..."
                className="input-dark w-full h-40 leading-relaxed resize-none text-[13px]" />
              {isRecording && <p className="text-[11px] text-[var(--text-tertiary)] italic text-right">Recording in progress...</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={toggleRecording}
                  className="px-4 py-2 rounded-xl font-semibold text-[13px] transition-all flex items-center gap-2"
                  style={isRecording ? { background: 'var(--apple-red)', color: 'white' } : { background: 'var(--apple-blue)', color: 'white' }}>
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isRecording ? 'Stop' : 'Record'}
                </button>
                <select value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} className="input-dark text-[13px] font-medium px-3 py-2" style={{ borderRadius: '10px', width: 'auto' }}>
                  <option value={5}>5 Questions</option>
                  <option value={7}>7 Questions</option>
                  <option value={10}>10 Questions</option>
                </select>
                <button onClick={generateQuestions} disabled={generating || !transcript.trim()} className="btn-primary text-[13px] flex items-center gap-1.5 disabled:opacity-40">
                  {generating ? 'Generating...' : '✦ AI Generate'}
                </button>
              </div>
            </div>
          )}

          {/* Questions */}
          {generatedQuestions.length > 0 && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-semibold">Generated Questions</h3>
                {!questionsReleased ? (
                  <button onClick={handleReleaseQuestions} disabled={generating} className="btn-primary text-[12px] disabled:opacity-50">Release All →</button>
                ) : (
                  <span className="badge badge-green text-[10px] flex items-center gap-1"><Check className="w-3 h-3" /> Released · {timerDuration}s</span>
                )}
              </div>
              <div className="space-y-3">
                {generatedQuestions.map((q, qIdx) => (
                  <div key={q.id || qIdx} className="p-4 rounded-xl space-y-3" style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-[13px] font-bold shrink-0" style={{ color: 'var(--apple-blue)' }}>Q{qIdx + 1}</span>
                        <input type="text" disabled={questionsReleased} value={q.question_text}
                          onChange={(e) => handleEditQuestion(qIdx, 'question_text', e.target.value)}
                          className="w-full text-[13px] font-medium focus:outline-none bg-transparent disabled:opacity-80" />
                      </div>
                      {!questionsReleased && (
                        <button onClick={() => handleDeleteQuestion(qIdx)} className="text-[var(--text-tertiary)] hover:text-[var(--apple-red)] transition-colors"><X className="w-4 h-4" /></button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options?.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const correct = q.correct_answer === letter;
                        return (
                          <div key={optIdx}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-all cursor-pointer"
                            style={{ background: correct ? 'rgba(52,199,89,0.08)' : 'white', border: correct ? '1px solid rgba(52,199,89,0.3)' : '1px solid var(--border-default)', color: correct ? '#248A3D' : 'var(--text-secondary)' }}
                            onClick={() => !questionsReleased && handleEditQuestion(qIdx, 'correct_answer', letter)}>
                            <span className="font-bold">{letter}.</span>
                            <input type="text" disabled={questionsReleased} value={opt.replace(/^[A-D]\.\s*/, '')}
                              onChange={(e) => handleEditOption(qIdx, optIdx, `${letter}. ${e.target.value}`)}
                              className="w-full bg-transparent focus:outline-none disabled:opacity-80" style={{ color: 'inherit' }} />
                            {correct && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right */}
        <div className="space-y-5">
          <button onClick={handleEndSession} disabled={generating} className="w-full btn-danger flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
            {generating ? 'Closing...' : 'End Session & Summarize'}
          </button>
          <LiveLeaderboard leaderboardData={leaderboardData} showFlags={true} />
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold">⚠ Violation Alerts</h3>
              {cheatLogs.length > 0 && <span className="badge badge-red text-[10px]">{new Set(cheatLogs.map(l => l.student_id)).size} flagged</span>}
            </div>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {cheatLogs.length === 0 ? (
                <p className="text-center text-[var(--text-tertiary)] text-[12px] py-6">✅ Full compliance</p>
              ) : (
                cheatLogs.map(log => {
                  const student = students[log.student_id] || { name: 'Unknown' };
                  return (
                    <div key={log.id} className="p-2.5 rounded-xl text-[12px] flex items-start gap-2" style={{ background: 'rgba(255,59,48,0.04)' }}>
                      <span>⚠</span>
                      <div className="flex-1">
                        <span className="font-medium">{student.name}</span>
                        <span className="text-[var(--text-secondary)]"> — {log.event_type?.replace('_', ' ')}</span>
                        <p className="text-[11px] text-[var(--text-tertiary)]">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
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
