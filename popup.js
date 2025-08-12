// 팝업 UI 로직
document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('toggleBtn');
    const popupDelay = document.getElementById('popupDelay');
    const factualCheckbox = document.getElementById('factual');
    const logicalCheckbox = document.getElementById('logical');
    const practicalCheckbox = document.getElementById('practical');
    const resetBtn = document.getElementById('resetBtn');
    const totalPromptsEl = document.getElementById('totalPrompts');
    const responsesEl = document.getElementById('responses');
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');

    // 추가: API 설정 요소
    const autoGenerate = document.getElementById('autoGenerate');
    const provider = document.getElementById('provider');
    const model = document.getElementById('model');
    const apiKey = document.getElementById('apiKey');
    const autoSend = document.getElementById('autoSend');

    // 설정 로드
    loadSettings();
    loadStats();

    // 토글 버튼 이벤트
    toggleBtn.addEventListener('click', function() {
        chrome.storage.sync.get(['enabled'], function(result) {
            const newState = !result.enabled;
            chrome.storage.sync.set({ enabled: newState }, function() {
                updateToggleUI(newState);
                // content script에 상태 변경 알림
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    const tab = tabs && tabs[0];
                    if (!tab || !tab.url) return;
                    const allowHosts = ['chat.openai.com','claude.ai','gemini.google.com','bard.google.com'];
                    if (!allowHosts.some(h => tab.url.includes(h))) return;
                    try {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'toggleState',
                            enabled: newState
                        }, () => { void chrome.runtime.lastError; });
                    } catch (_) { /* ignore */ }
                });
            });
        });
    });

    // 설정 변경 이벤트
    popupDelay.addEventListener('change', function() {
        chrome.storage.sync.set({ popupDelay: parseInt(this.value) });
    });

    factualCheckbox.addEventListener('change', saveCategorySettings);
    logicalCheckbox.addEventListener('change', saveCategorySettings);
    practicalCheckbox.addEventListener('change', saveCategorySettings);

    // API 관련 변경 저장
    autoGenerate.addEventListener('change', saveApiSettings);
    provider.addEventListener('change', saveApiSettings);
    model.addEventListener('change', saveApiSettings);
    apiKey.addEventListener('change', saveApiSettings);
    apiKey.addEventListener('input', saveApiSettings);
    if (autoSend) autoSend.addEventListener('change', saveApiSettings);

    // 통계 초기화
    resetBtn.addEventListener('click', function() {
        chrome.storage.sync.set({
            totalPrompts: 0,
            userResponses: 0
        }, function() {
            loadStats();
        });
    });

    // 설정 저장 함수
    function saveCategorySettings() {
        chrome.storage.sync.set({
            categories: {
                factual: factualCheckbox.checked,
                logical: logicalCheckbox.checked,
                practical: practicalCheckbox.checked
            }
        });
    }

    function saveApiSettings() {
        chrome.storage.sync.set({
            autoGenerate: !!autoGenerate.checked,
            provider: provider.value,
            model: model.value,
            apiKey: apiKey.value,
            autoSend: !!(autoSend && autoSend.checked)
        });
    }

    // 설정 로드 함수
    function loadSettings() {
        chrome.storage.sync.get(['enabled', 'popupDelay', 'categories', 'autoGenerate', 'provider', 'model', 'apiKey', 'autoSend'], function(result) {
            // 활성화 상태
            const enabled = result.enabled !== false; // 기본값 true
            updateToggleUI(enabled);

            // 팝업 지연 시간
            if (result.popupDelay !== undefined) {
                popupDelay.value = result.popupDelay;
            }

            // 카테고리 설정
            if (result.categories) {
                factualCheckbox.checked = result.categories.factual !== false;
                logicalCheckbox.checked = result.categories.logical !== false;
                practicalCheckbox.checked = result.categories.practical !== false;
            }

            // API 설정
            autoGenerate.checked = !!result.autoGenerate;
            provider.value = result.provider || 'openai';
            model.value = result.model || (provider.value === 'anthropic' ? 'claude-3-haiku-20240307' : (provider.value === 'gemini' ? 'gemini-1.5-flash' : 'gpt-4o-mini'));
            apiKey.value = result.apiKey || '';
            if (autoSend) autoSend.checked = !!result.autoSend;
        });
    }

    // 통계 로드 함수
    function loadStats() {
        chrome.storage.sync.get(['totalPrompts', 'userResponses'], function(result) {
            totalPromptsEl.textContent = result.totalPrompts || 0;
            responsesEl.textContent = result.userResponses || 0;
        });
    }

    // 토글 UI 업데이트 함수
    function updateToggleUI(enabled) {
        if (enabled) {
            toggleBtn.textContent = '비활성화';
            toggleBtn.classList.remove('disabled');
            statusDot.classList.add('active');
            statusText.textContent = '활성화됨';
        } else {
            toggleBtn.textContent = '활성화';
            toggleBtn.classList.add('disabled');
            statusDot.classList.remove('active');
            statusText.textContent = '비활성화됨';
        }
    }

    // 실시간 통계 업데이트를 위한 메시지 리스너
    chrome.runtime.onMessage.addListener(function(request) {
        if (request.action === 'updateStats') {
            loadStats();
        }
    });
}); 