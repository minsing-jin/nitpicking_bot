// LLM 답변 감지 및 비판적 사고(비판 프롬프트 생성) 팝업 표시
class CriticalThinkingBot {
    constructor() {
        this.isEnabled = true;
        this.popupDelay = 3;
        this.categories = {
            factual: true,
            logical: true,
            practical: true
        };
        this.observer = null;
        this.lastResponseTime = 0;
        this.responseCooldown = 5000; // 5초 쿨다운
        
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupObserver();
        this.setupMessageListener();
        this.injectStyles();
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['enabled', 'popupDelay', 'categories'], (result) => {
                this.isEnabled = result.enabled !== false;
                this.popupDelay = result.popupDelay || 3;
                this.categories = result.categories || {
                    factual: true,
                    logical: true,
                    practical: true
                };
                resolve();
            });
        });
    }

    setupObserver() {
        // DOM 변화 감지
        this.observer = new MutationObserver((mutations) => {
            if (!this.isEnabled) return;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.checkForLLMResponse(node);
                        }
                    });
                }
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request) => {
            if (request.action === 'toggleState') {
                this.isEnabled = request.enabled;
            }
        });
    }

    checkForLLMResponse(element) {
        const now = Date.now();
        if (now - this.lastResponseTime < this.responseCooldown) return;

        // ChatGPT 감지
        if (window.location.hostname.includes('chat.openai.com')) {
            this.detectChatGPTResponse(element);
        }
        // Claude 감지
        else if (window.location.hostname.includes('claude.ai')) {
            this.detectClaudeResponse(element);
        }
        // Bard/Gemini 감지
        else if (
            window.location.hostname.includes('bard.google.com') ||
            window.location.hostname.includes('gemini.google.com')
        ) {
            this.detectBardResponse(element);
        }
    }

    detectChatGPTResponse(element) {
        // ChatGPT 응답 영역 감지
        const responseSelectors = [
            '[data-message-author-role="assistant"]',
            '.markdown',
            '.prose',
            '[data-testid="conversation-turn-2"]'
        ];

        for (const selector of responseSelectors) {
            const responses = element.querySelectorAll
                ? element.querySelectorAll(selector)
                : element.matches && element.matches(selector)
                  ? [element]
                  : [];

            responses.forEach((response) => {
                if (response.textContent && response.textContent.length > 100 && !response.dataset.criticalThinkingShown) {
                    response.dataset.criticalThinkingShown = 'true';
                    this.showCriticalThinkingPrompt(response.textContent);
                }
            });
        }
    }

    detectClaudeResponse(element) {
        // Claude 응답 영역 감지
        const responseSelectors = [
            '.claude-response',
            '[data-testid="message"]',
            '.prose'
        ];

        for (const selector of responseSelectors) {
            const responses = element.querySelectorAll
                ? element.querySelectorAll(selector)
                : element.matches && element.matches(selector)
                  ? [element]
                  : [];

            responses.forEach((response) => {
                if (response.textContent && response.textContent.length > 100 && !response.dataset.criticalThinkingShown) {
                    response.dataset.criticalThinkingShown = 'true';
                    this.showCriticalThinkingPrompt(response.textContent);
                }
            });
        }
    }

    detectBardResponse(element) {
        // Bard/Gemini 응답 영역 감지
        const responseSelectors = [
            '.response-container',
            '[data-testid="response"]',
            '.conversation-turn'
        ];

        for (const selector of responseSelectors) {
            const responses = element.querySelectorAll
                ? element.querySelectorAll(selector)
                : element.matches && element.matches(selector)
                  ? [element]
                  : [];

            responses.forEach((response) => {
                if (response.textContent && response.textContent.length > 100 && !response.dataset.criticalThinkingShown) {
                    response.dataset.criticalThinkingShown = 'true';
                    this.showCriticalThinkingPrompt(response.textContent);
                }
            });
        }
    }

    showCriticalThinkingPrompt(responseText) {
        this.lastResponseTime = Date.now();
        
        // 통계 업데이트
        chrome.storage.sync.get(['totalPrompts'], (result) => {
            const totalPrompts = (result.totalPrompts || 0) + 1;
            chrome.storage.sync.set({ totalPrompts });
            chrome.runtime.sendMessage({ action: 'updateStats' });
        });

        // 지연 시간 후 팝업 표시
        setTimeout(() => {
            const criticPrompt = this.createCriticPrompt(responseText);
            this.createPopup(criticPrompt);
        }, this.popupDelay * 1000);
    }

    // 다른 LLM이 항상 딴지를 거는 비판자 역할 프롬프트 생성
    createCriticPrompt(answerText) {
        const normalized = (answerText || '').trim();
        const truncated = normalized.length > 6000 ? normalized.slice(0, 6000) + '\n... (중략)' : normalized;
        const hasSensitiveDomain = /의학|의료|건강|진단|치료|법률|법적|소송|계약|투자|주식|코인|금융|재무|부동산|세금/i.test(truncated);

        const domainClause = hasSensitiveDomain
            ? `- 민감 영역(의료/법률/투자 등) 관련 주장이 포함되어 있으므로, 관련 전문가 검토 필요성과 잠재적 위험(오독, 규제 위반, 손실 가능성)을 반드시 경고하세요.`
            : `- 민감 영역이 명확히 드러나지 않더라도, 과도한 확신 표현은 피하고 검증 가능성/한계를 분명히 하세요.`;

        const prompt = `당신은 비판 전담 LLM(Adversarial Critic)입니다. 아래의 LLM 답변에 대해 무조건적인 동의 없이, 체계적으로 딴지를 걸며 허점과 리스크를 집요하게 지적하세요. 공손함보다 정확성과 회의적 태도를 우선합니다.

요구사항:
- 절대 칭찬으로 시작하지 말 것. 긍정은 금지. 곧바로 핵심 취약점을 콕 집어 비판할 것.
- 확실하지 않은 부분은 "불확실"로 명시하고, 추가 확인이 필요한 근거/데이터를 요구할 것.
- 숨은 가정, 표본 편향, 누락된 변수, 인과-상관 혼동, 최신성 결여, 과도한 일반화, 환원주의, 윤리/법적 리스크를 찾을 것.
- 반례와 엣지 케이스를 제시하고, 실패 시나리오와 2차 효과를 구체적으로 설명할 것.
- 검증 계획(어떻게 사실/수치를 확인할지)과 대안 가설을 제시할 것.
- 최종적으로 신뢰도 등급(A~F)과 "사용 전 반드시 확인할 체크리스트"를 제공할 것.
${domainClause}

출력 형식(간결하지만 구체적으로):
1) 핵심 주장 요약(최대 40자)
2) 치명적 취약점 TOP-3
3) 반례/엣지 케이스
4) 검증 플랜(데이터/절차/도구)
5) 대안 가설/접근법
6) 법적/윤리/실무 리스크
7) 신뢰도 등급(A~F)
8) 사용 전 체크리스트(불릿)

비판 대상 LLM 답변:
"""
${truncated}
"""`;
        return prompt;
    }

    createPopup(criticPrompt) {
        // 기존 팝업 제거
        const existingPopup = document.getElementById('critical-thinking-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        const popup = document.createElement('div');
        popup.id = 'critical-thinking-popup';
        popup.className = 'critical-thinking-popup';
        popup.innerHTML = `
            <div class="popup-content">
                <div class="popup-header">
                    <span class="popup-icon">🧪</span>
                    <span class="popup-title">딴지 LLM 프롬프트 (복사해서 다른 LLM에 붙여넣기)</span>
                    <button class="popup-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="popup-body">
                    <textarea id="critic-prompt" class="critic-textarea" readonly></textarea>
                </div>
                <div class="popup-footer">
                    <button class="popup-btn primary" id="copy-critic-prompt">프롬프트 복사</button>
                    <button class="popup-btn secondary" onclick="window.recordResponse && window.recordResponse('ignore'); this.parentElement.parentElement.parentElement.remove();">닫기</button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);
        const textarea = popup.querySelector('#critic-prompt');
        textarea.value = criticPrompt;
        textarea.scrollTop = 0;

        const copyBtn = popup.querySelector('#copy-critic-prompt');
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(textarea.value);
                copyBtn.textContent = '복사됨!';
                setTimeout(() => (copyBtn.textContent = '프롬프트 복사'), 1500);
                // 응답 기록
                window.recordResponse && window.recordResponse('think');
            } catch (e) {
                // fallback
                textarea.select();
                document.execCommand('copy');
                copyBtn.textContent = '복사됨!';
                setTimeout(() => (copyBtn.textContent = '프롬프트 복사'), 1500);
                window.recordResponse && window.recordResponse('think');
            }
        });

        // 20초 후 자동 제거(사용자 작업 시 연장)
        let autoRemoveTimer = setTimeout(() => {
            if (popup.parentElement) popup.remove();
        }, 20000);
        textarea.addEventListener('focus', () => {
            clearTimeout(autoRemoveTimer);
        });

        // 응답 기록 함수 전역 등록
        window.recordResponse = (action) => {
            chrome.storage.sync.get(['userResponses'], (result) => {
                const userResponses = (result.userResponses || 0) + 1;
                chrome.storage.sync.set({ userResponses });
                chrome.runtime.sendMessage({ action: 'updateStats' });
            });
        };
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .critical-thinking-popup {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 520px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                border: 1px solid #e1e5e9;
                animation: slideIn 0.3s ease-out;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }

            .popup-content { padding: 16px; }
            .popup-header { display: flex; align-items: center; margin-bottom: 12px; gap: 8px; }
            .popup-icon { font-size: 20px; }
            .popup-title { flex: 1; font-weight: 600; color: #1a1a1a; font-size: 14px; }
            .popup-close { background: none; border: none; font-size: 18px; cursor: pointer; color: #666; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
            .popup-close:hover { background: #f5f5f5; }
            .popup-body { margin-bottom: 12px; }

            .critic-textarea {
                width: 100%;
                height: 240px;
                resize: vertical;
                padding: 12px;
                border: 1px solid #dee2e6;
                border-radius: 8px;
                font-size: 12px;
                line-height: 1.45;
                color: #212529;
                background: #fcfcfd;
            }

            .popup-footer { display: flex; gap: 8px; }
            .popup-btn { flex: 1; padding: 8px 16px; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
            .popup-btn.primary { background: #007bff; color: white; }
            .popup-btn.primary:hover { background: #0056b3; }
            .popup-btn.secondary { background: #f8f9fa; color: #495057; border: 1px solid #dee2e6; }
            .popup-btn.secondary:hover { background: #e9ecef; }
        `;
        document.head.appendChild(style);
    }
}

// Extension 초기화
new CriticalThinkingBot(); 