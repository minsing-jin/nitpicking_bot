# 🤔 Critical Thinking Bot

LLM 답변에 대해 비판적 사고를 유도하는 Chrome Extension입니다.

## 📋 기능

- **자동 감지**: ChatGPT, Claude, Bard/Gemini 등의 LLM 답변을 자동으로 감지
- **비판적 질문**: 답변에 대해 사실 검증, 논리 검증, 실용성 검증 질문 제공
- **사용자 설정**: 팝업 지연 시간, 질문 카테고리 선택 가능
- **통계 추적**: 총 프롬프트 수와 사용자 반응 수 추적

## 🚀 설치 방법

1. 이 저장소를 클론하거나 다운로드합니다
2. Chrome 브라우저에서 `chrome://extensions/` 접속
3. 우상단의 "개발자 모드" 활성화
4. "압축해제된 확장 프로그램을 로드합니다" 클릭
5. 다운로드한 폴더 선택

## ⚙️ 사용법

1. Extension 설치 후 Chrome 툴바에서 아이콘 클릭
2. 설정에서 원하는 옵션 선택:
   - **팝업 지연 시간**: 즉시, 3초, 5초, 10초 후
   - **질문 카테고리**: 사실 검증, 논리 검증, 실용성 검증
3. LLM 사이트에서 대화 시 자동으로 비판적 사고 팝업 표시

## 🎯 지원 사이트

- ChatGPT (chat.openai.com)
- Claude (claude.ai)
- Bard/Gemini (bard.google.com, gemini.google.com)

## 📁 파일 구조

```
critical-thinking-bot/
├── manifest.json          # Extension 설정
├── popup.html            # 팝업 UI
├── popup.js              # 팝업 로직
├── content.js            # 웹페이지 주입 스크립트
├── background.js         # 백그라운드 서비스 워커
├── styles.css            # 스타일링
└── icons/                # 아이콘 파일들
```

## 🔧 개발

### 로컬 개발 환경 설정

1. 저장소 클론
2. Chrome Extension 개발자 모드 활성화
3. 압축해제된 확장 프로그램으로 로드
4. 코드 수정 후 Extension 새로고침

### 주요 파일 설명

- **content.js**: LLM 답변 감지 및 팝업 표시 로직
- **popup.js**: Extension 팝업 UI 제어
- **background.js**: 백그라운드 서비스 및 메시지 처리

## 📊 비판적 사고 질문 예시

### 사실 검증
- 📊 이 정보의 출처는 신뢰할 수 있나요?
- 🔍 이 정보가 언제 작성된 것인지, 여전히 유효한지 확인해보세요

### 논리 검증
- 🧠 이 논리에 빠진 부분이나 약점은 없을까요?
- ⚖️ 반대 의견도 찾아보고 균형잡힌 시각을 가져보세요

### 실용성 검증
- 🎯 이 조언이 정말 당신의 상황에 맞나요?
- ⚠️ 실행하기 전에 고려해야 할 위험요소들을 생각해보세요

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🙏 감사의 말

이 Extension은 LLM 사용자들이 더 비판적이고 신중하게 AI 답변을 받아들이도록 돕기 위해 만들어졌습니다.
