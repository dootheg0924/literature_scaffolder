import { useState, useEffect } from 'react'
import client from './api/client'

const AppStep = {
  SET_PROFILE: "독자 정보 입력",
  SELECT_POEM: "시 선택",
  MULTI_AGENT_CHAT: "3인 튜터 대화",
  SUMMARY: "대화 마무리"
};

function App() {
  // --- [1] 상태 정의 (State) ---
  const [currentStep, setCurrentStep] = useState(AppStep.SET_PROFILE);

  // 데이터 및 시 선택
  const [poems, setPoems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPoem, setSelectedPoem] = useState(null);

  // 멀티 에이전트 대화
  const [sharedChatHistory, setSharedChatHistory] = useState([]);
  const [latestResponses, setLatestResponses] = useState({
    empathy: "",      // 공감 튜터의 답변
    aesthetic: "",    // 미학 튜터의 답변
    interpretive: ""  // 해석 튜터의 답변
  });
  const [selectedAgent, setSelectedAgent] = useState(null); // 'empathy', 'aesthetic', 'interpretive' 중 하나

  // 사용자 프로필
  const [userProfile, setUserProfile] = useState({
  name: "",
  levels: { emp_state: 1, ase_state: 1, int_state: 1 }
  });

  // 인터렉션 상태
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);      // 일반 대화 로딩

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

  // --- [3] 주요 로직 함수 ---

  // 프로필 설정 완료 처리
  const handleStart = async () => {
    if (!userProfile.name) return;
    
    try {
      await client.post('/api/profile/save', {
        user_name: userProfile.name,
        emp_state: userProfile.levels.emp_state,
        ase_state: userProfile.levels.ase_state,
        int_state: userProfile.levels.int_state
      });
      setCurrentStep(AppStep.SELECT_POEM);    
    } catch (error) {
      console.error("프로필 저장 실패:", error);
      setCurrentStep(AppStep.SELECT_POEM);    
    }
  };

  // 시 선택
  const handlePoemSelect = (poem) => {
    setSelectedPoem(poem);
    setSharedChatHistory([]); 
    setLatestResponses({ empathy: "", aesthetic: "", interpretive: "" });
    setSearchTerm("");

    setCurrentStep(AppStep.MULTI_AGENT_CHAT);
    };
  
  // 첫 대화 시작
  const handleStartConversation = async () => {
    if (!selectedPoem || isLoading) return;

    setIsLoading(true);
    try {
      const response = await client.post('/api/chat/multi', {
        user_name: userProfile.name,
        selected_poem: selectedPoem,
        user_level: userProfile.levels,
        shared_chat_history: [],
        user_input: "시를 선택했어. 각자의 목표 분야에서 첫 질문을 던져줘."
      });

      setLatestResponses({
        empathy: response.data.empathy,
        aesthetic: response.data.aesthetic,
        interpretive: response.data.interpretive
      });
    } catch (error) {
      console.error("첫 질문 생성 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Agent와 대화
  const handleSendMessage = async () => {
    if (!userInput.trim() || !selectedAgent || isLoading) {
      alert("답변할 질문을 먼저 선택해 주세요!");
      return;
    }

    // 1. 선택된 튜터의 질문 찾기
    const selectedQuestion = latestResponses[selectedAgent];
    const agentNameMap = { empathy: "공감", aesthetic: "미학", interpretive: "해석" };

    // 2. [선택된 질문 + 사용자 답변]만 히스토리에 누적
    const updatedHistory = [
      ...sharedChatHistory,
      // 튜터 이름표를 떼고 순수 내용만 보냅니다.
      { role: "assistant", content: selectedQuestion }, 
      { role: "user", content: userInput }
    ];

    setSharedChatHistory(updatedHistory);
    setUserInput("");
    setSelectedAgent(null); // 선택 초기화
    setIsLoading(true);

    try {
      const response = await client.post('/api/chat/multi', {
        user_name: userProfile.name,
        selected_poem: selectedPoem,
        shared_chat_history: updatedHistory,
        user_input: userInput,
        user_level: userProfile.levels
      });

      setLatestResponses({
        empathy: response.data.empathy,
        aesthetic: response.data.aesthetic,
        interpretive: response.data.interpretive
      });
    } catch (error) {
      console.error("대화 오류:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 대화 종료: 마무리 창으로 이동
  const handleEndConversation = () => {
    if (sharedChatHistory.length === 0 && !latestResponses.empathy) {
      if (!window.confirm("대화 기록이 없습니다. 그래도 종료하시겠습니까?")) return;
    }
    
    setCurrentStep(AppStep.SUMMARY);
  };

  // [2] 처음으로 이동 (X 버튼): 모든 상태를 완전 초기화
  const handleReset = () => {
    if (!window.confirm("진행 중인 모든 내용이 사라집니다. 처음으로 돌아갈까요?")) return;
    
    // 모든 상태값 초기화 (시니어의 기본: Memory Leak 방지)
    setSelectedPoem(null);
    setSharedChatHistory([]);
    setLatestResponses({ empathy: "", aesthetic: "", interpretive: "" });
    setSelectedAgent(null);
    setIsLoading(false);
    setCurrentStep(AppStep.SET_PROFILE);  
  };
  
  // --- [4] 화면 렌더링 ---

  // --- 화면 0: 독자 프로필 설정 (Landing Screen) ---
  if (currentStep === AppStep.SET_PROFILE) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center',
        alignItems: 'center',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#fafbfc',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1000
      }}>
      <div style={{ padding: '50px', maxWidth: '500px', backgroundColor: '#fff', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '30px' }}> 독자 정보 </h2>
      
        <div style={{ marginBottom: '20px', textAlign: 'left' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>이름</label>
          <input 
            type="text" value={userProfile.name} onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
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
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
              >
                {[1,2,3,4,5,6].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          ))}
        </div>

        <button 
          onClick={handleStart}
          style={{ width: '100%', padding: '15px', backgroundColor: '#4253a7', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          시작
        </button>
      </div>
    </div>
  );
}

  // 1. 시 목록 화면
  if (currentStep === AppStep.SELECT_POEM) {
    return (
      <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '40px', fontSize: '32px' }}>📖 한국 현대시 데이터베이스 KPoEM </h1>
        <input 
          type="text" placeholder="시 제목이나 작가 검색..." value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #e5e7eb', marginBottom: '30px', fontSize: '16px' }} 
        />
        <div style={{ border: '1px solid #f0f0f0', borderRadius: '10px' }}>
          {poems.filter(p => p.title.includes(searchTerm) || p.author.includes(searchTerm)).map(p => (
            <div 
              key={p.id} onClick={() => handlePoemSelect(p)} 
              style={{ padding: '20px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
            >
              <span style={{ fontWeight: 'bold' }}>{p.title}</span>
              <span style={{ color: '#888' }}>{p.author}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. 시 상세 및 멀티 에이전트 채팅 (MULTI_AGENT_CHAT 단계)
  if (currentStep === AppStep.MULTI_AGENT_CHAT) {
    return (
      <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#fafbfc' }}>
        
        {/* [왼쪽 칸] 시 원문 영역 (flex: 5.5) */}
        <div style={{ flex: 5.5, padding: '40px', overflowY: 'auto', borderRight: '2px solid #f0f0f0', backgroundColor: '#fff' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 'bold', marginBottom: '10px' }}>{selectedPoem.title}</h2>
          <p style={{ color: '#666', fontSize: '18px', marginBottom: '30px' }}>{selectedPoem.author}</p>
          <div style={{ 
            whiteSpace: 'pre-wrap', lineHeight: '2.4', fontSize: '20px', color: '#2c3e50', 
            padding: '30px', backgroundColor: '#fafafa', borderRadius: '15px', border: '1px solid #f0f0f0' 
          }}>
            {selectedPoem.content}
          </div>
        </div>

        {/* [오른쪽 칸] 멀티 에이전트 대화 영역 (flex: 4.5) */}
        <div style={{ flex: 4.5, display: 'flex', flexDirection: 'column', position: 'relative', backgroundColor: '#fff' }}>
          
          {/* 우상단: 완전 초기화 버튼 (X) */}
          <button 
            onClick={handleReset} 
            title="처음으로 돌아가기"
            style={{ 
              position: 'absolute', top: '15px', right: '15px', width: '35px', height: '35px', 
              borderRadius: '50%', border: '1px solid #e5e7eb', backgroundColor: '#fff', 
              cursor: 'pointer', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', color: '#999'
            }}
          >
            ✕
          </button>

          {/* 헤더: 시스템 타이틀 */}
          <div style={{ padding: '20px 30px', borderBottom: '1px solid #f0f0f0', backgroundColor: '#fff' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>시를 읽고 난 후 감상을 나누어보세요</h3>
          </div>

          {/* 대화창 몸체 */}
          <div style={{ flex: 1, padding: '25px', overflowY: 'auto', backgroundColor: '#fafbfc' }}>
            
            {/* (A) 공유 히스토리 출력 */}
            {sharedChatHistory.map((msg, i) => (
              <div key={i} style={{ marginBottom: '20px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                <div style={{ 
                  display: 'inline-block', padding: '12px 18px', borderRadius: '15px',
                  backgroundColor: msg.role === 'user' ? '#4253a7' : '#f3f4f6',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  maxWidth: '85%', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', fontSize: '15px'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* (B) 첫 질문 생성 버튼: 시작 전일 때만 */}
            {!latestResponses.empathy && sharedChatHistory.length === 0 && !isLoading && (
              <div style={{ textAlign: 'center', marginTop: '60px' }}>
                <p style={{ color: '#888', marginBottom: '20px', lineHeight: '1.6' }}>
                  시를 충분히 음미하셨나요? <br/>준비가 되었다면 버튼을 눌러 대화를 시작해보세요.
                </p>
                <button 
                  onClick={handleStartConversation} 
                  style={{ padding: '15px 35px', backgroundColor: '#4253a7', color: '#fff', border: 'none', borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 8px 15px rgba(91,111,216,0.2)' }}
                >
                  대화 시작하기
                </button>
              </div>
            )}

            {/* (C) 3인 튜터 답변 그리드 */}
            {latestResponses.empathy && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginTop: '10px' }}>
                {['empathy', 'aesthetic', 'interpretive'].map((type) => (
                  <div 
                    key={type}
                    onClick={() => !isLoading && setSelectedAgent(type)}
                    style={{ 
                      padding: '15px', borderRadius: '15px', cursor: 'pointer', transition: 'all 0.2s',
                      border: selectedAgent === type ? '3px solid #4253a7' : '1px solid #e5e7eb',
                      backgroundColor: selectedAgent === type ? '#fff' : '#f8f9fa',
                      opacity: (selectedAgent && selectedAgent !== type) ? 0.5 : 1,
                      transform: selectedAgent === type ? 'translateY(-5px)' : 'none'
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: type === 'empathy' ? '#e63946' : type === 'aesthetic' ? '#8338ec' : '#0077b6' }}>
                      {type === 'empathy' ? '👨‍👩‍👧‍👦Lens 1 ' : type === 'aesthetic' ? '🎨 Lens 2' : '🔍 Lens 3'}
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#333' }}>{latestResponses[type]}</div>
                  </div>
                ))}
              </div>
            )}

            {isLoading && <div style={{ color: '#aaa', textAlign: 'center', marginTop: '30px' }}>의견을 준비하고 있습니다...</div>}
            
            {/* (D) 대화 마무리 버튼 */}
            {sharedChatHistory.length > 0 && !isLoading && (
              <div style={{ textAlign: 'center', marginTop: '40px' }}>
                <button 
                  onClick={handleEndConversation}
                  style={{ padding: '8px 20px', backgroundColor: '#fff', color: '#666', border: '1px solid #750f0f', borderRadius: '20px', fontSize: '13px', cursor: 'pointer' }}
                >
                  🏁 대화 마무리하기
                </button>
              </div>
            )}
          </div>

          {/* 하단 입력창 */}
          <div style={{ padding: '25px', borderTop: '1px solid #f0f0f0', backgroundColor: '#fff' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <textarea 
                  value={userInput} 
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={selectedAgent ? "선택한 질문에 대한 당신의 생각을 들려주세요..." : "먼저 답변하고 싶은 튜터의 질문을 클릭해 주세요."}
                  disabled={!selectedAgent || isLoading}
                  style={{ flex: 1, padding: '15px', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '15px', resize: 'none', height: '70px', backgroundColor: !selectedAgent ? '#f9fafb' : '#fff' }}
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!selectedAgent || isLoading || !userInput.trim()}
                  style={{ width: '80px', backgroundColor: '#4253a7', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', opacity: (!selectedAgent || isLoading) ? 0.5 : 1 }}
                >
                  전송
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

    // --- 화면 3: 대화 마무리 창 (SUMMARY 단계) ---
  if (currentStep === AppStep.SUMMARY) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center',
        alignItems: 'center',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#fafbfc',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 1000,
        padding: '20px',
        fontFamily: 'sans-serif',
        overflowY: 'auto'
      }}>
        <div style={{ 
          maxWidth: '700px', width: '100%', backgroundColor: '#fff', padding: '40px', 
          borderRadius: '25px', boxShadow: '0 15px 40px rgba(0,0,0,0.08)', textAlign: 'center' 
        }}>
          
          {/* 상단 헤더: 수고했다는 메시지 */}
          <div style={{ marginBottom: '30px' }}>
            <span style={{ fontSize: '40px' }}>🌹</span>
            <h2 style={{ fontSize: '28px', color: '#2c3e50', marginTop: '15px' }}>
              {userProfile.name} 님, 오늘의 여정이 끝났습니다.
            </h2>
            <p style={{ color: '#7f8c8d', fontSize: '16px' }}>
              시 '{selectedPoem.title}'을(를) 함께 읽는 경험은 어떠셨나요? <br/>
              오늘 나눈 대화를 다시 한번 읽어보며 생각을 정리해 보세요.
            </p>
          </div>

          <hr style={{ border: '0', borderTop: '1px solid #f0f0f0', margin: '30px 0' }} />

          {/* 대화 요약 영역: 스크롤 가능한 로그 박스 */}
          <div style={{ 
            textAlign: 'left', backgroundColor: '#f9fafb', borderRadius: '15px', 
            padding: '25px', maxHeight: '400px', overflowY: 'auto', marginBottom: '40px' 
          }}>
            <h4 style={{ color: '#374151', marginBottom: '20px', borderLeft: '4px solid #4253a7', paddingLeft: '10px' }}>
              오늘의 대화 로그
            </h4>
            
            {sharedChatHistory.length === 0 ? (
              <p style={{ color: '#aaa', textAlign: 'center' }}>나눈 대화가 없습니다.</p>
            ) : (
              sharedChatHistory.map((msg, i) => (
                <div key={i} style={{ 
                  marginBottom: '15px', padding: '12px', borderRadius: '10px', 
                  backgroundColor: msg.role === 'user' ? '#f9fafb' : '#fff',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: msg.role === 'user' ? '#4253a7' : '#6b7280', marginBottom: '5px' }}>
                    {msg.role === 'user' ? '나의 답변' : '튜터의 질문'}
                  </div>
                  <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#333', whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 하단 컨트롤: 다시 시작 버튼 */}
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button 
              onClick={() => setCurrentStep(AppStep.SELECT_POEM)} // 시 선택 화면으로 이동
              style={{ 
                padding: '15px 40px', backgroundColor: '#fff', color: '#4253a7', 
                border: '2px solid #4253a7', borderRadius: '50px', fontWeight: 'bold', fontSize: '16px', 
                cursor: 'pointer', transition: 'transform 0.2s'
              }}
              onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
            >
              다른 시 읽기
            </button>
            <button 
              onClick={handleReset} // 완전 초기화 (이름 입력부터 다시)
              style={{ 
                padding: '15px 40px', backgroundColor: '#4253a7', color: '#fff', 
                border: 'none', borderRadius: '50px', fontWeight: 'bold', fontSize: '16px', 
                cursor: 'pointer', boxShadow: '0 8px 15px rgba(91,111,216,0.2)', transition: 'transform 0.2s'
              }}
              onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
            >
              처음으로
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default App;