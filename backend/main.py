import os
import sys
import sqlite3
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional
from pydantic import BaseModel, Field

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from dotenv import load_dotenv

dotenv_path = os.path.join(current_dir, ".env")
loaded = load_dotenv(dotenv_path=dotenv_path)
print(f"load_dotenv path={dotenv_path}, returned={loaded}, exists={os.path.exists(dotenv_path)}")
key = os.getenv("OPENAI_API_KEY")

from schemas import AppSessionState, Poem, Message, UserLevel, AgentRole
from services.poem_loader import PoemLoader
from services.dictionary import DictionaryService
from agents import EmpathyAgent, AestheticAgent, InterpretiveAgent


app = FastAPI(title="Scaffolder Backend API")

# --- 초기화 섹션 ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

poem_loader = PoemLoader("data/KPoEM_poem_dataset_v4.tsv")
dict_service = DictionaryService()
emp_agent = EmpathyAgent()
ase_agent = AestheticAgent()
int_agent = InterpretiveAgent()

all_poems = poem_loader.load()

# --- [1] DB 초기화 ---
def init_db():
    conn = sqlite3.connect("tutor_system.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_profiles (
            user_name TEXT PRIMARY KEY,
            emp_state INTEGER DEFAULT 1,
            ase_state INTEGER DEFAULT 1,
            int_state INTEGER DEFAULT 1,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

init_db()

# --- [2] 데이터 모델: Pydantic 필드명 통일 ---
class UserProfile(BaseModel):
    user_name: str
    emp_state: int = Field(1, ge=1, le=6)
    ase_state: int = Field(1, ge=1, le=6)
    int_state: int = Field(1, ge=1, le=6)

# --- [3] API: 프로필 저장 및 업데이트 (UPSERT) ---
@app.post("/api/profile/save")
async def save_profile(profile: UserProfile):
    try:
        conn = sqlite3.connect("tutor_system.db")
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_profiles (user_name, emp_state, ase_state, int_state, last_updated)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_name) DO UPDATE SET
                emp_state=excluded.emp_state,
                ase_state=excluded.ase_state,
                int_state=excluded.int_state,
                last_updated=CURRENT_TIMESTAMP
        """, (profile.user_name, profile.emp_state, profile.ase_state, profile.int_state))
        conn.commit()
        conn.close()
        return {"status": "success", "user": profile.user_name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- [4] API: 프로필 불러오기 ---
@app.get("/api/profile/{user_name}")
async def get_profile(user_name: str):
    conn = sqlite3.connect("tutor_system.db")
    cursor = conn.cursor()
    cursor.execute("SELECT emp_state, ase_state, int_state FROM user_profiles WHERE user_name = ?", (user_name,))
    result = cursor.fetchone()
    conn.close()

    if result:
        return {
            "user_name": user_name,
            "states": {
                "emp_state": result[0],
                "ase_state": result[1],
                "int_state": result[2]
            }
        }
    return {
        "user_name": user_name,
        "states": {"emp_state": 1, "ase_state": 1, "int_state": 1},
        "is_new": True
    }

@app.get("/api/poems", response_model=List[Poem])
async def get_poems():
    """KPoEM 데이터셋에서 전체 시 목록을 반환합니다."""
    if not all_poems:
        raise HTTPException(status_code=404, detail="시 데이터를 찾을 수 없습니다.")
    return all_poems

@app.get("/api/poems/{poem_id}", response_model=Poem)
async def get_poem_detail(poem_id: int):
    """특정 ID의 시 상세 정보를 반환합니다."""
    poem = next((p for p in all_poems if p.id == poem_id), None)
    if not poem:
        raise HTTPException(status_code=404, detail="해당 시를 찾을 수 없습니다.")
    return poem

@app.post("/api/dictionary")
async def search_word(payload: Dict[str, str]):
    """
    리액트에서 { "word": "나무" } 형태의 JSON을 보냈을 때 처리합니다.
    """
    word = payload.get("word")
    if not word:
        raise HTTPException(status_code=400, detail="검색할 단어가 없습니다.")
        
    meanings = dict_service.search_word(word)
    
    if not meanings:
        return {"word": word, "meanings": [{"definition": "검색 결과가 없습니다."}]}
        
    return {"word": word, "meanings": meanings}

@app.post("/api/chat/multi")
async def chat_multi_agents(payload: dict):
    try:
        # 1. 데이터 파싱
        user_name = payload.get("user_name", "학생")
        poem_data = payload.get("selected_poem")
        # 공유 히스토리를 가져옵니다. 없으면 빈 리스트로 시작합니다.
        history_data = payload.get("shared_chat_history", []) 
        user_input = payload.get("user_input", "")
        level_data = payload.get("user_level", {"emp_state": 1, "ase_state": 1, "int_state": 1})

        # 첫 접속 시(히스토리가 없을 때) 기본 입력 설정
        if not history_data and not user_input:
            user_input = "시를 선택했어. 각 교사의 관점과 학생의 수준을 고려한 첫 질문을 만들어 줘."

        # 2. 객체 변환 및 세션 상태 구성
        shared_history = [Message(**m) for m in history_data]
        state = AppSessionState(
            user_name=user_name,
            user_level=UserLevel(**level_data),
            selected_poem=Poem(**poem_data),
            shared_chat_history=shared_history  # 모든 에이전트가 이 히스토리를 공유합니다.
        )

        # 3. 비동기 병렬 호출 (시니어의 기술)
        # 세 명의 에이전트에게 동시에 질문을 던집니다.
        responses = await asyncio.gather(
            asyncio.to_thread(emp_agent.get_response, state, user_input),
            asyncio.to_thread(ase_agent.get_response, state, user_input),
            asyncio.to_thread(int_agent.get_response, state, user_input)
        )

        # 4. 결과 반환
        return {
            "empathy": responses[0],
            "aesthetic": responses[1],
            "interpretive": responses[2]
        }
    except Exception as e:
        print(f"Multi-Agent API Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)