import pandas as pd
from typing import List
from pathlib import Path
from schemas import Poem

class PoemLoader:
    def __init__(self, file_path: str):
        self.file_path = Path(file_path)

    def load(self) -> List[Poem]:
        # 1. 데이터 로드
        df = pd.read_csv(self.file_path, sep='\t', quoting=3, encoding='utf-8')

        # 2. 결측치 처리 (원본 컬럼명 사용)
        df['title'] = df['title'].fillna("제목 없음")
        df['poet'] = df['poet'].fillna("작가 미상")
        df['text'] = df['text'].fillna("")

        # 3. 컬럼 이름 변경 (Pydantic 스키마와 일치시킴)
        df = df.rename(columns={
            'poem_id': 'id',
            'poet': 'author',
            'text': 'content'
        })

        # 4. 단락 병합 (id별로 그룹화)
        # 이 과정에서 중복된 컬럼 이름 문제도 자연스럽게 정리됩니다.
        aggregated = df.groupby('id').agg({
            'title': 'first',
            'author': 'first',
            'content': lambda x: '\n\n'.join(x.astype(str).str.strip())
        }).reset_index()

        # 5. to_dict('records')를 사용하여 안전하게 변환
        records = aggregated.to_dict('records')
        
        poems = [Poem(**record) for record in records]

        print(f"✅ 총 {len(poems)}편의 작품을 성공적으로 로드했습니다.")
        return poems