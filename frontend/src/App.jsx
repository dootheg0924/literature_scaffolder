import { useState, useEffect } from 'react'
import client from './api/client'

function App() {
  // --- [1] 상태 정의 (State) ---
  const [poems, setPoems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPoem, setSelectedPoem] = useState(null);

  const [activeAgent, setActiveAgent] = useState('teacher'); // 현재 대화 중인 방 (teacher, criticA, criticB)
  const [hasEssays, setHasEssays] = useState(false);         // 비평 로드 여부 (기능 해금 트리거)

  const [chatHistories, setChatHistories] = useState({
    teacher: [],  // 교사 방 기록
    criticA: [],  // 비평가 A 방 기록
    criticB: []   // 비평가 B 방 기록
  });

  const [userProfile, setUserProfile] = useState({
  name: "",
  levels: { emp_state: 1, ase_state: 1, int_state: 1 }
  });
  const [isProfileSet, setIsProfileSet] = useState(false); // 프로필 설정 완료 여부

  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);      // 일반 대화 로딩
  const [isCritiquing, setIsCritiquing] = useState(false); // 비평 생성 로딩

  // --- [2] 초기 데이터 로딩 ---
  useEffect(() => {
    const fetchPoems = async () => {
      try {
        const response = await client.get('/api/poems');
        setPoems(response.data);
      } catch (error) { console.error("데이터 로딩 실패", error); }
    };
    fetchPoems();
  }, []);

  // --- [3] 주요 로직 함수들 ---

  // 프로필 설정 완료 처리
  const handleStart = async () => {
    if (!userProfile.name) return;
    
    try {
      // 백엔드 DB에 프로필 저장 요청
      await client.post('/api/profile/save', {
        user_name: userProfile.name,
        ...userProfile.levels
      });
      setIsProfileSet(true);
    } catch (error) {
      console.error("프로필 저장 실패", error);
      setIsProfileSet(true);
    }
  };

  // 시 선택: 교사 방 초기화 및 인사말 요청
  const handlePoemSelect = async (poem) => {
    setSelectedPoem(poem);
    setHasEssays(false);
    setActiveAgent('teacher');
    setChatHistories({ teacher: [], criticA: [], criticB: [] });
  };

  const handleStartTeacherChat = async () => {
    if (!selectedPoem || isLoading) return;

    setIsLoading(true);
    try {
      const response = await client.post('/api/chat/teacher', {
        user_name: userProfile.name,
        user_level: userProfile.levels,
        selected_poem: selectedPoem,
        chat_history: [],
        user_input: "시를 선택했어. 첫 인사를 건네줘."
      });
      setChatHistories(prev => ({
        ...prev,
        teacher: [{ role: 'assistant', content: response.data.message }]
      }));
    } catch (error) { console.error("교사 접속 실패", error); }
    setIsLoading(false);
  };

  // 메시지 전송: 현재 활성화된 방(activeAgent)에만 메시지 전달
  const handleSendMessage = async () => {
    if (!userInput.trim() || isLoading) return;

    const currentHistory = chatHistories[activeAgent];
    const updatedHistory = [...currentHistory, { role: 'user', content: userInput }];

    setChatHistories(prev => ({ ...prev, [activeAgent]: updatedHistory }));
    setUserInput("");
    setIsLoading(true);

    try {
      const response = await client.post(`/api/chat/${activeAgent}`, {
        user_name: userProfile.name,
        user_level: userProfile.levels,
        selected_poem: selectedPoem,
        chat_history: updatedHistory,
        user_input: userInput
      });

      setChatHistories(prev => ({
        ...prev,
        [activeAgent]: [...updatedHistory, { role: 'assistant', content: response.data.message }]
      }));
    } catch (error) { console.error("메시지 전송 오류", error); }
    setIsLoading(false);
  };

  // 비평가 소환: 교사 대화 종료 후 비평가 방 활성화
  const handleEndConversation = async () => {
    setIsCritiquing(true);
    try {
      const response = await client.post('/api/chat/critique', selectedPoem);
      setChatHistories(prev => ({
        ...prev,
        criticA: [{ role: 'assistant', content: response.data.critic_a }],
        criticB: [{ role: 'assistant', content: response.data.critic_b }]
      }));

      setHasEssays(true);
      setActiveAgent('criticA'); // 즉시 비평가 A방으로 전환
    } catch (error) { console.error("비평 생성 오류", error); }
    setIsCritiquing(false);
  };

  const handleReset = () => {
    setIsProfileSet(false);      // 프로필 설정 화면으로 이동
    setSelectedPoem(null);       // 선택된 시 초기화
    setHasEssays(false);         // 비평 상태 초기화
    setActiveAgent('teacher');   // 에이전트 초기화
    setChatHistories({           // 대화 기록 삭제
      teacher: [], 
      criticA: [], 
      criticB: [] 
    });
    setUserInput("");            // 입력창 초기화
  };

  // --- [4] 화면 렌더링 (JSX) ---

  // --- 화면 0: 독자 프로필 설정 (Landing Screen) ---
  if (!isProfileSet) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', // 가로 중앙 정렬
        alignItems: 'center',     // 세로 중앙 정렬
        width: '100vw',           // 브라우저 전체 너비
        height: '100vh',          // 브라우저 전체 높이
        backgroundColor: '#f4f4f9', // 사진의 회색 배경을 전체로 확장하거나 깔끔한 배경색 지정
        position: 'fixed',        // 다른 요소의 간섭을 무시하고 화면에 고정
        top: 0,
        left: 0,
        zIndex: 1000              // 가장 위로 올림
      }}>
      <div style={{ padding: '50px', maxWidth: '500px', backgroundColor: '#fff', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '30px' }}> 독자 정보 </h2>
      
        <div style={{ marginBottom: '20px', textAlign: 'left' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>이름 (또는 아이디)</label>
          <input 
            type="text" value={userProfile.name} onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }}
            placeholder="이름을 입력하세요"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', marginBottom: '40px' }}>
          {['emp_state', 'ase_state', 'int_state'].map(skill => (
            <div key={skill} style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                {skill === 'emp_state' ? 'state 1' : skill === 'ase_state' ? 'state 2' : 'state 3'}
              </label>
              <select 
                value={userProfile.levels[skill]} 
                onChange={(e) => setUserProfile({
                  ...userProfile, 
                  levels: { ...userProfile.levels, [skill]: parseInt(e.target.value) }
                })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
              >
                {[1,2,3,4,5,6].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          ))}
        </div>

        <button 
          onClick={handleStart}
          style={{ width: '100%', padding: '15px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          시작
        </button>
      </div>
    </div>
  );
}

  // 1. 시 목록 화면
  if (!selectedPoem) {
    return (
      <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '40px', fontSize: '32px' }}>📖 한국 현대시 데이터베이스 KPoEM </h1>
        <input 
          type="text" placeholder="시 제목이나 작가 검색..." value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #ddd', marginBottom: '30px', fontSize: '16px' }} 
        />
        <div style={{ border: '1px solid #eee', borderRadius: '10px' }}>
          {poems.filter(p => p.title.includes(searchTerm) || p.author.includes(searchTerm)).map(p => (
            <div 
              key={p.id} onClick={() => handlePoemSelect(p)} 
              style={{ padding: '20px', borderBottom: '1px solid #eee', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
            >
              <span style={{ fontWeight: 'bold' }}>{p.title}</span>
              <span style={{ color: '#888' }}>{p.author}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. 시 상세 및 멀티 에이전트 채팅 (Split View)
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#fff' }}>
      
      {/* 왼쪽: 시 원문 */}
      <div style={{ flex: 6, padding: '40px', overflowY: 'auto', borderRight: '2px solid #eee', backgroundColor: '#fafafa' }}>
        <h2 style={{ fontSize: '26px' }}>{selectedPoem.title}</h2>
        <p style={{ color: '#666', fontSize: '18px' }}>{selectedPoem.author}</p>
        <hr style={{ border: '0', borderTop: '1px solid #ddd', margin: '20px 0' }} />
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '2', fontSize: '18px', color: '#333' }}>
          {selectedPoem.content}
        </div>
      </div>

      {/* 오른쪽: 멀티 에이전트 대화방 */}
      <div style={{ flex: 4, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        {/* 우상단: 종료 버튼 */}
        <button 
          onClick={handleReset} 
          style={{ position: 'absolute', top: '15px', right: '15px', padding: '8px 15px', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '5px', cursor: 'pointer', zIndex: 10 }}
        >
          ✖ 종료 (처음으로)
        </button>

        {/* 헤더: 에이전트 라벨 (비평 로드 후 전환 버튼으로 작동) */}
        <div style={{ padding: '20px 30px', borderBottom: '1px solid #eee', display: 'flex', gap: '20px', alignItems: 'center' }}>
          <span 
            onClick={() => hasEssays && setActiveAgent('teacher')}
            style={{ 
              fontSize: '18px', fontWeight: 'bold', cursor: hasEssays ? 'pointer' : 'default',
              color: activeAgent === 'teacher' ? '#007bff' : '#aaa',
              textDecoration: hasEssays && activeAgent !== 'teacher' ? 'underline' : 'none'
            }}
          >
            👨‍🏫 교사
          </span>
          {hasEssays && (
            <>
              <span onClick={() => setActiveAgent('criticA')} style={{ fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', color: activeAgent === 'criticA' ? '#007bff' : '#aaa' }}>🧐 비평가 A</span>
              <span onClick={() => setActiveAgent('criticB')} style={{ fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', color: activeAgent === 'criticB' ? '#007bff' : '#aaa' }}>💡 비평가 B</span>
            </>
          )}
        </div>

        {/* 채팅창 몸체 */}
        <div style={{ flex: 1, padding: '30px', overflowY: 'auto', backgroundColor: '#fdfdfd' }}>

          {/* [신규 추가] 교사 방이고 아직 대화 기록이 없을 때만 보이는 시작 버튼 */}
          {activeAgent === 'teacher' && chatHistories.teacher.length === 0 && !isLoading && (
            <div style={{ margin: 'auto', textAlign: 'center' }}>
              <p style={{ color: '#666', marginBottom: '20px', fontSize: '18px', lineHeight: '1.6' }}>
                시를 스스로 한 번 읽어보셨나요?<br/>
                준비가 되셨다면 아래 버튼을 눌러 교사와 대화를 시작해 보세요.
              </p>
              <button 
                onClick={handleStartTeacherChat} // 이전에 만든 시작 함수 연결
                style={{ 
                  padding: '15px 30px', 
                  backgroundColor: '#007bff', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '50px', 
                  fontWeight: 'bold', 
                  fontSize: '16px', 
                  cursor: 'pointer', 
                  boxShadow: '0 10px 20px rgba(0,123,255,0.2)' 
                }}
              >
                👨‍🏫 교사와 대화하기
              </button>
            </div>
          )}
          {/* 기존 메시지 렌더링 로직 (기록이 있을 때만 작동함) */}
            {chatHistories[activeAgent].map((msg, i) => (
              <div key={i} style={{ marginBottom: '25px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                {/* ... 기존 말풍선 코드 ... */}
                {msg.role === 'assistant' && (
                  <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#555' }}>
                    {activeAgent === 'teacher' ? '교사:' : activeAgent === 'criticA' ? '비평가 A:' : '비평가 B:'}
                  </div>
                )}
                <div style={{ 
                  display: 'inline-block', padding: '12px 18px', borderRadius: '15px',
                  backgroundColor: msg.role === 'user' ? '#007bff' : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  maxWidth: '80%', border: msg.role === 'user' ? 'none' : '1px solid #ddd',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)', whiteSpace: 'pre-wrap', lineHeight: '1.6'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
          {isLoading && <div style={{ color: '#aaa', textAlign: 'center' }}>응답을 기다리는 중...</div>}
          
          {/* 비평 로드 전, 교사 방 하단에만 보이는 버튼 */}
          {!hasEssays && activeAgent === 'teacher' && !isLoading && chatHistories.teacher.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: '30px' }}>
              <button 
                onClick={handleEndConversation}
                disabled={isCritiquing}
                style={{ padding: '15px 30px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {isCritiquing ? "다른 의견 생성 중" : "✨ 대화 끝내기"}
              </button>
            </div>
          )}
        </div>

        {/* 하단 입력창 */}
        <div style={{ padding: '25px 30px', borderTop: '1px solid #eee', backgroundColor: '#fff' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
          <textarea 
                value={userInput} 
                onChange={(e) => {
                  setUserInput(e.target.value);
                  // 높이 자동 조절 로직
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onKeyDown={(e) => {
                  // 엔터치면 전송, Shift+엔터는 줄바꿈
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                    e.target.style.height = 'auto'; // 전송 후 높이 초기화
                  }
                }}
                placeholder={`${activeAgent === 'teacher' ? '교사' : '비평가'}와 대화하기...`}
                style={{ 
                  flex: 1, 
                  padding: '12px 15px', 
                  borderRadius: '10px', 
                  border: '1px solid #ddd', 
                  fontSize: '16px',
                  resize: 'none',          // 사용자가 모서리 잡고 늘리는 기능 끄기
                  minHeight: '24px',       // 최소 높이
                  maxHeight: '150px',      // 너무 길어지면 스크롤 생기도록 제한
                  lineHeight: '1.5',
                  overflowY: 'auto'
                }}
              />
            <button 
                  onClick={() => {
                    handleSendMessage();
                    // 버튼 클릭 전송 시에도 높이 초기화가 필요할 수 있음
                  }} 
                  style={{ 
                    padding: '12px 25px', 
                    backgroundColor: '#007bff', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '10px', 
                    fontWeight: 'bold', 
                    cursor: 'pointer',
                    height: '48px'          // 버튼 높이 고정
                  }}
                >
              전송
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;