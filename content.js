// 중복 주입 방지
if (window.__CTB_LOADED__) {
    console.debug('CriticalThinkingBot already loaded, skipping.');
} else {
    window.__CTB_LOADED__ = true;

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
        // 자동 비판 응답 생성 관련 설정
        this.autoGenerate = true;
        this.provider = 'openai';
        this.model = 'gpt-4o-mini';
        this.apiKey = '';
        this.autoSend = false;
        
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupObserver();
        this.setupMessageListener();
        this.injectStyles();
        // 초기 스캔 + 주기적 스캔 (실시간 감지 강화)
        setTimeout(() => {
            console.log('초기 스캔 시작');
            this.scanAllResponseBlocks();
        }, 1500);
        
        // 주기적 스캔 (3초마다)
        this.scanInterval = setInterval(() => {
            if (this.isEnabled) {
                this.scanAllResponseBlocks();
            }
        }, 3000);
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(['enabled', 'popupDelay', 'categories', 'autoGenerate', 'provider', 'model', 'apiKey', 'autoSend'], (result) => {
                this.isEnabled = result.enabled !== false;
                this.popupDelay = result.popupDelay || 3;
                this.categories = result.categories || {
                    factual: true,
                    logical: true,
                    practical: true
                };
                this.autoGenerate = !!result.autoGenerate;
                this.provider = result.provider || 'openai';
                this.model = result.model || (this.provider === 'anthropic' ? 'claude-3-haiku-20240307' : (this.provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini'));
                this.apiKey = result.apiKey || '';
                this.autoSend = !!result.autoSend;
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
                // 텍스트 변화도 감지 (실시간 입력 감지)
                if (mutation.type === 'characterData' || mutation.type === 'attributes') {
                    this.checkForUserInput(mutation.target);
                }
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['value', 'innerText', 'textContent']
        });
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request) => {
            if (request.action === 'toggleState') {
                this.isEnabled = request.enabled;
            }
        });
    }

    // 사용자 입력 감지 (실시간 반응)
    checkForUserInput(target) {
        try {
            const host = window.location.hostname;
            let inputElement = null;
            
            // 입력 요소 찾기
            if (host.includes('chat.openai.com')) {
                inputElement = document.querySelector('textarea, [contenteditable="true"]');
            } else if (host.includes('claude.ai')) {
                inputElement = document.querySelector('[contenteditable="true"], textarea');
            } else if (host.includes('gemini.google.com') || host.includes('bard.google.com')) {
                inputElement = document.querySelector('main [contenteditable="true"], [contenteditable="true"], textarea');
            }
            
            if (inputElement && target === inputElement || inputElement && inputElement.contains(target)) {
                // 사용자가 입력 중이면 기존 응답 감지 활성화
                this.lastResponseTime = 0; // 쿨다운 리셋
                console.log('사용자 입력 감지됨 - 응답 감지 준비');
            }
        } catch (_) { /* noop */ }
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
            this.detectGeminiResponse(element);
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
                    const userQ = this.getLatestUserMessage('chatgpt');
                    this.showCriticalThinkingPrompt(response.textContent, userQ);
                }
            });
        }
    }

    detectClaudeResponse(element) {
        // Claude 응답 영역 감지
        const responseSelectors = [
            '[data-test-render-count] .font-claude-response', // Claude 응답 텍스트
            '[data-test-render-count] .grid-cols-1 p.whitespace-normal.break-words', // 응답 텍스트
            '[data-testid="action-bar-copy"]' // 응답 관련 버튼
        ];

        for (const selector of responseSelectors) {
            const responses = element.querySelectorAll
                ? element.querySelectorAll(selector)
                : element.matches && element.matches(selector)
                  ? [element]
                  : [];

            responses.forEach((response) => {
                const textContent = response.textContent?.trim();
                console.log(`Claude Response Detected:`, textContent); // 디버깅용 로그 추가

                if (textContent && textContent.length > 100 && !response.dataset.criticalThinkingShown) {
                    response.dataset.criticalThinkingShown = 'true';
                    const userQ = this.getLatestUserMessage('claude');
                    this.showCriticalThinkingPrompt(textContent, userQ);
                }
            });
        }
    }

    // Gemini 전용 응답 감지 (제공된 DOM 구조 기반)
    detectGeminiResponse(element) {
        // Gemini 응답 영역 감지 (제공된 DOM 구조 기반)
        const responseSelectors = [
            'model-response .response-container',
            'model-response .markdown',
            'model-response .model-response-text',
            'model-response .markdown-main-panel',
            'model-response .response-container-content'
        ];

        for (const selector of responseSelectors) {
            const responses = element.querySelectorAll ? 
                element.querySelectorAll(selector) : 
                (element.matches(selector) ? [element] : []);

            responses.forEach(response => {
                if (response.textContent && response.textContent.length > 100 && !response.dataset.criticalThinkingShown) {
                    response.dataset.criticalThinkingShown = 'true';
                    const userQ = this.getLatestUserMessage('gemini');
                    this.showCriticalThinkingPrompt(response.textContent, userQ);
                }
            });
        }
    }

    showCriticalThinkingPrompt(responseText, userQuestionText, prevContextSummary = '') {
        this.lastResponseTime = Date.now();
        
        // 통계 업데이트
        chrome.storage.sync.get(['totalPrompts'], (result) => {
            const totalPrompts = (result.totalPrompts || 0) + 1;
            chrome.storage.sync.set({ totalPrompts });
            chrome.runtime.sendMessage({ action: 'updateStats' });
        });

        // 지연 시간 후 팝업 표시
        setTimeout(() => {
            const criticPrompt = this.createCriticPrompt(responseText, userQuestionText, prevContextSummary);
            this.createPopup(criticPrompt);
        }, this.popupDelay * 1000);
    }

    // 다른 LLM이 항상 딴지를 거는 비판자 역할 프롬프트 생성
    createCriticPrompt(answerText, questionText, prevContextSummary = '') {
        const normalized = (answerText || '').trim();
        const truncated = normalized.length > 6000 ? normalized.slice(0, 6000) + '\n... (중략)' : normalized;
        const qNorm = (questionText || this.lastUserMessageText || '').trim();
        const qTrunc = qNorm.length > 2000 ? qNorm.slice(0, 2000) + '\n... (질문 중략)' : qNorm;
        const hasSensitiveDomain = /의학|의료|건강|진단|치료|법률|법적|소송|계약|투자|주식|코인|금융|재무|부동산|세금/i.test(truncated);

        const domainClause = hasSensitiveDomain
            ? `- 민감 영역(의료/법률/투자 등) 관련 주장이 포함되어 있으므로, 관련 전문가 검토 필요성과 잠재적 위험(오독, 규제 위반, 손실 가능성)을 반드시 경고하세요.`
            : `- 민감 영역이 명확히 드러나지 않더라도, 과도한 확신 표현은 피하고 검증 가능성/한계를 분명히 하세요.`;

        // 이전 대화 context 반영 문장 추가
        const contextClause = prevContextSummary
            ? `이전 대화의 핵심 맥락: "${prevContextSummary}" 이 점을 반드시 고려하여 비판하세요.`
            : '';

        const prompt = `당신은 비판 전담 LLM(Adversarial Critic)입니다. 아래의 "사용자 질문"과 그에 대한 "LLM 답변"을 함께 검토하여, 무조건적인 동의 없이 체계적으로 딴지를 걸며 허점과 리스크를 집요하게 지적하세요. 공손함보다 정확성과 회의적 태도를 우선합니다. 한국어로 답변하세요.

${contextClause}
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

사용자 질문:
"""
${qTrunc || '(질문 텍스트 미탐지)'}
"""

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
                    <span class="popup-icon"🤷</span>
                    <span class="popup-title">이런것도 생각해봤나요></span>
                    <button class="popup-close" id="popup-close-btn">×</button>
                </div>
                <div class="popup-body">
                    <div id="auto-result" class="critic-result">
                        <div class="critic-result-title">딴지거는중.....</div>
                        <div id="critic-result-summary" class="critic-result-summary"></div>
                        <button id="toggle-detail" class="toggle-detail-btn" style="display:none">
                            <span class="toggle-text">In Detail</span>
                            <span class="toggle-icon">▼</span>
                        </button>
                        <div id="critic-result-detail" class="critic-result-detail" style="display:none"></div>
                    </div>
                </div>
                <div class="popup-footer">
                    <button class="popup-btn secondary" id="popup-close-footer">닫기</button>
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // 닫기 버튼 이벤트 리스너 (header/footer 모두)
        popup.querySelector('#popup-close-btn').onclick = () => popup.remove();
        popup.querySelector('#popup-close-footer').onclick = () => popup.remove();

        // 자동 생성 모드: 백그라운드에 생성 요청
        if (this.autoGenerate && this.apiKey) {
            const resultWrap = popup.querySelector('#auto-result');
            const summaryEl = popup.querySelector('#critic-result-summary');
            const detailEl = popup.querySelector('#critic-result-detail');
            const toggleBtn = popup.querySelector('#toggle-detail');
            
            resultWrap.style.display = 'block';
            summaryEl.textContent = '생성 중...';

            try {
              chrome.runtime.sendMessage({
                action: 'generateCritique',
                provider: this.provider,
                model: this.model,
                apiKey: this.apiKey,
                prompt: criticPrompt
              }, (resp) => {
                const err = chrome.runtime.lastError;
                if (err) {
                  summaryEl.textContent = `백그라운드 연결 실패: ${err.message || err}`;
                  return;
                }
                if (!resp || resp.error) {
                  summaryEl.textContent = `오류: ${(resp && resp.error) || '생성 실패'}`;
                  return;
                }
                
                // 응답을 요약과 상세로 분리
                const processedResponse = this.processCritiqueResponse(resp.text || '(내용 없음)');
                summaryEl.innerHTML = processedResponse.summary;
                detailEl.innerHTML = processedResponse.detail;
                
                // 상세 내용이 있으면 토글 버튼 표시
                if (processedResponse.detail.trim()) {
                    toggleBtn.style.display = 'block';
                    toggleBtn.onclick = () => {
                        const toggleText = toggleBtn.querySelector('.toggle-text');
                        const toggleIcon = toggleBtn.querySelector('.toggle-icon');
                        if (detailEl.style.display === 'none') {
                            detailEl.style.display = 'block';
                            toggleText.textContent = 'Hide Detail';
                            toggleIcon.textContent = '▲';
                        } else {
                            detailEl.style.display = 'none';
                            toggleText.textContent = 'In Detail';
                            toggleIcon.textContent = '▼';
                        }
                    };
                }
              });
            } catch (e) {
              summaryEl.textContent = `메시지 전송 실패: ${e && e.message ? e.message : e}`;
            }
        }

        // 60초 후 자동 제거(사용자 작업 시 연장)
        let autoRemoveTimer = setTimeout(() => {
            if (popup.parentElement) popup.remove();
        }, 60000);
        popup.addEventListener('mouseenter', () => {
            clearTimeout(autoRemoveTimer);
        });
    }

    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (_) { /* noop */ }
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.top = '-1000px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const ok = document.execCommand('copy');
            ta.remove();
            return ok;
        } catch (_) {
            return false;
        }
    }

    // 현재 열려 있는 LLM 사이트의 입력창에 텍스트 삽입
    insertIntoPromptInput(text) {
        try {
            const host = window.location.hostname;
            // ChatGPT: textarea 또는 contenteditable
            if (host.includes('chat.openai.com')) {
                const ta = document.querySelector('textarea');
                if (ta) {
                    ta.focus();
                    ta.value = text;
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                    return true;
                }
                const ce = document.querySelector('[contenteditable="true"]');
                if (ce) {
                    ce.focus();
                    ce.innerText = text;
                    ce.dispatchEvent(new Event('input', { bubbles: true }));
                    return true;
                }
            }
            // Gemini/Bard/Claude: contenteditable 또는 textarea 일반 처리
            const ce = document.querySelector('main [contenteditable="true"], [contenteditable="true"]');
            if (ce) {
                ce.focus();
                ce.innerText = text;
                ce.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
            const ta = document.querySelector('main textarea, textarea');
            if (ta) {
                ta.focus();
                ta.value = text;
                ta.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
        } catch (_) { /* noop */ }
        return false;
    }

    // 현재 사이트의 전송 버튼 추정 클릭
    trySendMessage() {
        try {
            const host = window.location.hostname;
            const candidates = [];
            if (host.includes('chat.openai.com')) {
                candidates.push('button[data-testid="send-button"]');
                candidates.push('form button[type="submit"]');
            }
            if (host.includes('claude.ai')) {
                candidates.push('button[aria-label*="send" i]');
                candidates.push('button[type="submit"]');
            }
            if (host.includes('gemini.google.com') || host.includes('bard.google.com')) {
                candidates.push('button[aria-label*="보내" i]');
                candidates.push('button[aria-label*="send" i]');
            }
            candidates.push('button[type="submit"]');

            for (const sel of candidates) {
                const btn = document.querySelector(sel);
                if (btn) {
                    btn.click();
                    return true;
                }
            }
            // fallback: Enter key 이벤트 시뮬레이션
            const ta = document.querySelector('main textarea, textarea');
            if (ta) {
                const evt = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true });
                ta.dispatchEvent(evt);
                return true;
            }
            const ce = document.querySelector('main [contenteditable="true"], [contenteditable="true"]');
            if (ce) {
                const evt = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true });
                ce.dispatchEvent(evt);
                return true;
            }
        } catch (_) { /* noop */ }
        return false;
    }

    // 페이지 내 최근 사용자 메시지 추정
    getLatestUserMessage(site) {
        try {
            let sels = [];
            if (site === 'chatgpt') {
                sels = ['[data-message-author-role="user"]'];
            } else if (site === 'claude') {
                sels = [
                    '[data-testid="user-message"] p.whitespace-pre-wrap.break-words', // 사용자 메시지 텍스트
                    '.group.relative.inline-flex .text-[0.9375rem]' // 사용자 메시지 텍스트
                ];
            } else if (site === 'gemini') {
                sels = [
                    'user-query .query-text',
                    'user-query .query-text-line',
                    'user-query .user-query-bubble-with-background',
                    'user-query .query-content',
                    'user-query .gds-body-l'
                ];
            }
            let text = '';
            for (const sel of sels) {
                const nodes = document.querySelectorAll(sel);
                if (nodes && nodes.length) {
                    const last = nodes[nodes.length - 1];
                    text = (last.textContent || '').trim();
                    if (text) break;
                }
            }
            // fallback: 현재 입력창의 값
            if (!text) {
                const ta = document.querySelector('main textarea, textarea');
                if (ta && ta.value) text = ta.value.trim();
            }
            if (!text) {
                const ce = document.querySelector('main [contenteditable="true"], [contenteditable="true"]');
                if (ce && ce.innerText) text = ce.innerText.trim();
            }
            if (text) this.lastUserMessageText = text;
            return text;
        } catch (_) {
            return this.lastUserMessageText || '';
        }
    }

    // 비판 응답을 요약과 상세로 분리
    processCritiqueResponse(text) {
        const lines = text.split('\n').filter(line => line.trim());
        let summary = '';
        let detail = '';
        let isDetail = false;
        
        // 핵심 주장과 Thesis statement 찾기
        const summaryPatterns = [
            /^1\)\s*핵심 주장 요약/,
            /^2\)\s*치명적 취약점 TOP-3/,
            /^3\)\s*반례\/엣지 케이스/
        ];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 요약 부분 (핵심 주장 + TOP-3)
            if (summaryPatterns.some(pattern => pattern.test(line)) || 
                (summary && !isDetail && i < 10)) {
                summary += line + '\n';
            } else {
                // 상세 부분으로 분류
                isDetail = true;
                detail += line + '\n';
            }
        }
        
        // 요약이 비어있으면 전체를 요약으로
        if (!summary.trim()) {
            summary = text;
        }
        
        return {
            summary: summary.trim(),
            detail: detail.trim()
        };
    }

    // 문서 전체 스캔으로 누락된 응답 감지
    scanAllResponseBlocks() {
        if (!this.isEnabled) return;
        const host = window.location.hostname;
        let selectors = [];
        if (host.includes('chat.openai.com')) {
            selectors = [
                '[data-message-author-role="assistant"]',
                '.markdown',
                '.prose'
            ];
        } else if (host.includes('claude.ai')) {
            selectors = [
                '[data-testid="message"]',
                '.prose'
            ];
        } else if (host.includes('gemini.google.com') || host.includes('bard.google.com')) {
            selectors = [
                'model-response .response-container',
                'model-response .markdown',
                'model-response .model-response-text',
                'model-response .markdown-main-panel'
            ];
        } else {
            selectors = ['.prose', 'article', '[role="article"]'];
        }

        const seen = new Set();
        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                if (seen.has(el)) return;
                seen.add(el);
                if (!el || !el.textContent) return;
                if (el.dataset && el.dataset.criticalThinkingShown === 'true') return;
                const text = el.textContent.trim();
                if (text.length > 120) {
                    el.dataset.criticalThinkingShown = 'true';
                    this.showCriticalThinkingPrompt(text);
                }
            });
        });
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
                background: white; /* 배경색을 특정 팝업에만 적용 */
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

            .critic-result { margin-top: 12px; padding: 12px; background: #f8f9ff; border: 1px solid #e5e9ff; border-radius: 8px; }
            .critic-result-title { font-weight: 600; font-size: 13px; color: #3b5bfd; margin-bottom: 6px; }
            .critic-result-summary { white-space: pre-wrap; font-size: 13px; color: #1a1a1a; line-height: 1.5; font-weight: 500; margin-bottom: 8px; }
            .critic-result-detail { white-space: pre-wrap; font-size: 12px; color: #666; line-height: 1.4; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e9ff; max-height: 200px; overflow-y: auto; }
            .toggle-detail-btn { 
                width: 100%; 
                padding: 6px 12px; 
                background: #e5e9ff; 
                border: 1px solid #3b5bfd; 
                border-radius: 4px; 
                color: #3b5bfd; 
                font-size: 12px; 
                font-weight: 500; 
                cursor: pointer; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                gap: 4px;
                transition: all 0.2s;
            }
            .toggle-detail-btn:hover { 
                background: #3b5bfd; 
                color: white; 
            }
            .toggle-icon { font-size: 10px; }
        `;
        document.head.appendChild(style);
    }
}

// Extension 초기화
new CriticalThinkingBot();
}