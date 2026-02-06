from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

# 앱의 진행 단계 정의
class AppStep(str, Enum):
    SELECT_POEM = "시 선택"
    READ_POEM = "시 읽기"
    CHAT_WITH_TEACHER = "교사와 대화"
    READ_CRITICISM = "비평 읽기"
    CHAT_WITH_CRITIC_A = "비평가 A와 대화"
    CHAT_WITH_CRITIC_B = "비평가 B와 대화"
    END = "대화 종료"

# 시 데이터 구조
class Poem(BaseModel):
    id: int
    title: str
    author: str
    content: str

# 대화 메시지 구조
class Message(BaseModel):
    role: str
    content: str
    
# 현재 대화 중인 대상 정의
class AgentRole(str, Enum):
    TEACHER = "teacher"
    CRITIC_A = "critic_a"
    CRITIC_B = "critic_b"

# 독자 역량 state
class UserLevel(BaseModel):
    emp_state: int = Field(1, ge=1, le=6, description="공감 역량")
    ase_state: int = Field(1, ge=1, le=6, description="미학적 및 문체적 역량")
    int_state: int = Field(1, ge=1, le=6, description="해석적 역량")

# 전체 앱의 상태 관리
class AppSessionState(BaseModel):
    current_step: AppStep = AppStep.SELECT_POEM
    user_name: Optional[str] = None
    selected_poem: Optional[Poem] = None
    user_level: UserLevel = Field(default_factory=UserLevel)
    
    #비평가 Agent의 초기 비평문
    critic_a_initial_essay: Optional[str] = None
    critic_b_initial_essay: Optional[str] = None
    
    # 에이전트별 독립된 대화 기록 보관
    teacher_chat_history: List[Message] = []
    critic_a_chat_history: List[Message] = []
    critic_b_chat_history: List[Message] = []
