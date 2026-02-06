from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

# 앱의 진행 단계 정의
class AppStep(str, Enum):
    SET_PROFILE = "독자 정보 입력"
    SELECT_POEM = "시 선택"
    MULTI_AGENT_CHAT = "3인 튜터 대화"
    SUMMARY = "대화 마무리"

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
    EMPATHY = "empathy"
    AESTHETIC = "aesthetic"
    INTERPRETIVE = "interpretive"

# 독자 역량 state
class UserLevel(BaseModel):
    emp_state: int = Field(1, ge=1, le=6, description="공감 역량")
    ase_state: int = Field(1, ge=1, le=6, description="미학적 및 문체적 역량")
    int_state: int = Field(1, ge=1, le=6, description="해석적 역량")

# 3. 통합된 앱 세션 상태
class AppSessionState(BaseModel):
    current_step: AppStep = AppStep.SELECT_POEM
    user_name: Optional[str] = None
    selected_poem: Optional[Poem] = None
    user_level: UserLevel = Field(default_factory=UserLevel)
    shared_chat_history: List[Message] = []