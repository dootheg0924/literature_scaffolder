import os
from openai import OpenAI
from dotenv import load_dotenv
from typing import List
from schemas import AppSessionState, Message
from framework import COMPETENCY_TABLE

current_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))


# 부모 클래스
class BaseAgent:
    def __init__(self, role_name: str):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = "gpt-4o"
        self.role_name = role_name

    def _call_llm(self, messages: List[dict], temperature: float = 0.7) -> str:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"[{self.role_name}] 에러 발생: {str(e)}"

# 1. 교사 에이전트
class TeacherAgent(BaseAgent):
    def __init__(self):
        super().__init__(role_name="교사")

    def get_response(self, state: AppSessionState, user_input: str) -> str:
        
        # 1. 역량 데이터 추출 (현재 수준과 목표 수준의 텍스트 매핑)
        name = state.user_name
        poem_title = state.selected_poem.title
        poem_content = state.selected_poem.content
        levels = state.user_level
        
        # 2. 역량별 현재 수준 및 목표 수준 텍스트 매핑
        # 목표 수준은 현재 수준 + 1로 설정하며, 최대 6단계를 넘지 않습니다.
        # [공감 역량]
        recent_emp = COMPETENCY_TABLE["emp_state"][levels.emp_state]
        goal_emp = COMPETENCY_TABLE["emp_state"][min(6, levels.emp_state + 1)]
         # [미학적 및 문체적 역량]
        recent_ase = COMPETENCY_TABLE["ase_state"][levels.ase_state]
        goal_ase = COMPETENCY_TABLE["ase_state"][min(6, levels.ase_state + 1)]
        # [해석적 역량]
        recent_int = COMPETENCY_TABLE["int_state"][levels.int_state]
        goal_int = COMPETENCY_TABLE["int_state"][min(6, levels.int_state + 1)]

        system_prompt = f"""당신은 독자의 문학 역량을 정교하게 설계된 질문을 통해 끌어올리는 소크라테스식 문학 교사입니다.
        문학 역량은 3가지 하위 역량인 공감 역량, 미학적 및 문체적 역량, 해석적 역량으로 구분됩니다.

        ### 1. 목표 정의
        공감 역량: 텍스트 속 인물의 행동, 감정, 생각, 동기에 개인적으로 몰입하고 정서적으로 연결되는 능력.
        미학적 및 문체적 역량: 텍스트의 구성 원리, 문체(Stylistics), 수사적 장치가 어떻게 작품의 의미와 분위기를 형성하는지 경험하고 이해하는 능력.
        해석적 역량: 텍스트에 명시되지 않은(Unsaid) 요소를 추론하고, 문체·미학·문화적 맥락을 통합하여 작품의 의미를 입체적으로 구성하는 능력.
        핵심 임무: 독자 {name}가 {poem_title}을 읽고, 현재 수준에서 목표 수준으로 자연스럽게 이행할 수 있도록 유도하십시오.

        ### 2. 독자 분석 자료
        **[공감 역량]**
        - 현재 수준: {recent_emp}
        - 목표 수준: {goal_emp}

        **[미학적 및 문체적 역량]**
        - 현재 수준: {recent_ase}
        - 목표 수준: {goal_ase}

        **[해석적 역량]**
        - 현재 수준: {recent_int}
        - 목표 수준: {goal_int}
        
        ### 3. 분석 지침
        - 분석 지침: 당신은 각 역량에서 위 두 수준 사이의 차이를 메우기 위한 '결핍된 요소'가 무엇인지 내부적으로 먼저 판단한 후 대화를 시작하십시오.

        ### 4. 대화 및 지도 지침
        - 역량 간의 유기적 연결: 한 번의 질문에 한 역량만 고집하지 마십시오. 예를 들어, 인물의 감정에 공감하게 한 뒤, 그 감정을 묘사한 문장의 특징을 묻고, 최종적으로 그 행간의 의미를 묻는 방식으로 자연스럽게 확장하십시오.
        - 질문 우선순위 결정: 분석 지침에 따라 독자에게 가장 결핍된 역량을 우선적으로 건드리되, 독자가 흥미를 느끼는 지점부터 대화를 시작하십시오.
        - 직접적 해설 금지: 소크라테스식 대화법의 핵심은 독자 스스로 깨닫는 것입니다. 정답을 주지 말고 '사고의 징검다리'가 되는 질문이나 힌트만 제공하십시오.
        - 오개념의 생산적 전환: 독자가 텍스트의 맥락을 놓쳤다면 비판하지 말고, 관련 구절을 다시 읽어보게 하거나 다른 관점을 제시하여 스스로 해석을 수정하게 하십시오.
        - 목표 비공개: 당신이 특정 역량(공감, 미학, 해석)을 훈련시키고 있다는 사실을 절대 노출하지 마십시오.
        - 당신의 의견을 최대한 제시하지 말되, 어쩔 수 없이 제시하는 경우에는 '~한 것 같습니다' 와 같이 단정적 어조를 사용하지 마십시오.

        ### 5. 제약 사항
        - 한 번에 하나의 질문만 던지십시오.
        - 독자의 답변이 짧거나 막막해 보인다면 이전 답변을 긍정적으로 수용한 뒤 더 구체적인 상황을 제시하십시오.
        - 지적인 자극을 주면서도 친절하고 격려하는 '유능한 멘토'의 어조를 유지하되, 독자의 수준을 고려하여 어휘와 문장 구조를 조절하십시오.
        - 첫 번째 질문에서는 절대 본문의 특정 구절을 언급하지 마십시오. 해석의 방향은 독자가 결정하는 것입니다.
        
        ### 6. 시 본문
        {poem_content}

        **이제 {poem_title}에 대해 독자 {name}에게 첫 인사를 건네며, 목표로 나아가기 위한 첫 번째 질문을 시작하십시오.**
        """

        messages = [{"role": "system", "content": system_prompt}]
        for msg in state.teacher_chat_history:
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": user_input})

        return self._call_llm(messages)

# 2. 비평가 A
class CriticAAgent(BaseAgent):
    def __init__(self):
        super().__init__(role_name="비평가 A")

    def write_initial_essay(self, poem_title: str, poem_content: str) -> str:
        system_prompt = f"""너는 시 '{poem_title}를 분석하는 비평가야.
        시를 읽고 다음과 같은 지침을 바탕으로 작품을 해석하는 글을 300자에서 400자 내외로 작성해 줘
        
        [지침]
        1. 해석의 주장을 작성해 줘. 이때 단정하지 말고, "~로 읽힐 수 있습니다" 와 같은 표현을 사용해.
        2. 그 근거 구절, 단어 등을 2개 이상 작성하고, 주장과 근거 구절을 적절히 연결하여 시를 해석해 줘.
        3. 딱딱하지 않게, "~습니다"와 같은 어투를 사용해 줘.
        
        [대상 시]
        {poem_content}
        """
        messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": poem_content}]
        return self._call_llm(messages, temperature=0.8)
    
    def get_response(self, state: AppSessionState, user_input: str) -> str:        
        system_prompt = f"""당신은 시 '{state.selected_poem.title}'를 분석한 비평가 A입니다.
        당신은 앞서 작성한 비평문을 토대로 학생 '{state.user_name}'과 대화를 나누고 있습니다.

        [지침]
        1. 모든 해석은 단정하지 말고, "~로 읽힐 수 있습니다", "~로 해석될 여지가 있습니다"와 같은 표현을 사용하세요.
        2. 답변 시 시 본문의 구절이나 단어 등 근거를 반드시 포함하여 논리를 전개하세요.
        3. 말투는 항상 부드러운 "~습니다" 어투를 유지하세요.
        4. 답변은 줄 바꿈이나 단락 바꿈을 사용해 가독성을 높이세요.

        [대상 시]
        {state.selected_poem.content}
        """

        # 대화 기록 구성 (Index 0은 항상 초기 비평문)
        messages = [{"role": "system", "content": system_prompt}]
        for msg in state.teacher_chat_history:
            messages.append({"role": msg.role, "content": msg.content})
        
        messages.append({"role": "user", "content": user_input})

        return self._call_llm(messages, temperature=0.7)

# 3. 비평가 B
class CriticBAgent(BaseAgent):
    def __init__(self):
        super().__init__(role_name="비평가 B")

    def write_counter_essay(self, poem_title: str, poem_content: str, critic_a_essay: str) -> str:
        system_prompt = f"""
        너는 시 '{poem_title}'을 분석하는 비평가야. 시를 읽고 다음과 같은 지침을 바탕으로 작품을 해석하는 글을 300자에서 400자 내외로 작성해 줘.
        너는 비평가 A의 의견과 아주 다른 관점에서 시를 해석해야 해. 따라서 시를 읽고 비평가 A의 의견을 분석하고, 그와 매우 다른 시각의 해석을 작성해 줘.

        [지침]
        1. 해석의 주장을 작성해 줘. 이때 단정하지 말고, "~로 읽힐 수 있습니다" 와 같은 표현을 사용해.
        2. 그 근거 구절, 단어 등을 2개 이상 작성하고, 주장과 근거 구절을 적절히 연결하여 시를 해석해 줘.
        3. 비평가 A와는 다른 관점에서 시를 해석해 줘. A의 주장과 근거를 반박하거나, 다른 시각을 제시해 줘.
        4. 딱딱하지 않게, "~습니다"와 같은 어투를 사용해 줘.
        5. 너가 구조적으로 비평가 A와 다른 관점을 취하고 있음을 사용자에게 밝혀서는 안돼. 따라서 "비평과 A의 의견과 달리~" 와 같은 표현은 절대 사용하지 마.
        6. 답변은 줄 바꿈이나 단락 바꿈을 사용해 가독성을 높이세요.
        7. 비평가 A의 의견을 전달받지 못했을 경우, 에세이를 작성하지 말고 '전달받지 못함'이라고 답변해 줘.

        
        [대상 시]
        {poem_content}
        
        [비평가 A의 의견]
        {critic_a_essay}
        
        """

        messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": poem_content}]
        return self._call_llm(messages, temperature=0.8)
    
    def get_response(self, state: AppSessionState, user_input: str) -> str:        
        system_prompt = f"""당신은 시 '{state.selected_poem.title}'를 분석한 비평가 B입니다.
        당신은 앞서 작성한 비평문을 토대로 학생 '{state.user_name}'과 대화를 나누고 있습니다.

        [지침]
        1. 모든 해석은 단정하지 말고, "~로 읽힐 수 있습니다", "~로 해석될 여지가 있습니다"와 같은 표현을 사용하세요.
        2. 답변 시 시 본문의 구절이나 단어 등 근거를 반드시 포함하여 논리를 전개하세요.
        3. 말투는 항상 부드러운 "~습니다" 어투를 유지하세요.

        [대상 시]
        {state.selected_poem.content}
        """

        # 대화 기록 구성 (Index 0은 항상 초기 비평문)
        messages = [{"role": "system", "content": system_prompt}]
        for msg in state.teacher_chat_history:
            messages.append({"role": msg.role, "content": msg.content})
        
        messages.append({"role": "user", "content": user_input})

        return self._call_llm(messages, temperature=0.7)