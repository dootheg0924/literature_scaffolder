import requests
import xml.etree.ElementTree as ET
from typing import List, Dict

class DictionaryService:
    def __init__(self):
        # .env 파일에서 가져온 키를 사용한다고 가정합니다.
        self.api_key = "발급받은_인증키"
        self.base_url = "https://opendict.korean.go.kr/api/search"

    def search_word(self, word: str, limit: int = 4) -> List[Dict]:
        params = {
            "key": self.api_key,
            "q": word,
            "part": "word",
            "sort": "popular",
            "method": "exact" # 정확히 일치하는 단어만
        }
        
        try:
            response = requests.get(self.base_url, params=params)
            # XML 파싱 시작
            root = ET.fromstring(response.content)
            
            results = []
            # <item> 태그들을 찾아 순회합니다.
            for item in root.findall(".//item"):
                word_text = item.find("word").text
                
                # 하나의 아이템 안에 여러 <sense>가 있을 수 있습니다.
                for sense in item.findall("sense"):
                    definition = sense.find("definition").text
                    pos = sense.find("pos").text if sense.find("pos") is not None else "N/A"
                    cat = sense.find("cat").text if sense.find("cat") is not None else ""
                    
                    results.append({
                        "word": word_text,
                        "definition": definition,
                        "pos": pos,
                        "category": cat
                    })
                    
                    # 원하는 개수만큼만 담고 중단
                    if len(results) >= limit:
                        return results
            
            return results
            
        except Exception as e:
            print(f"사전 검색 중 오류 발생: {e}")
            return []