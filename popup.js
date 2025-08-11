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
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'toggleState',
                        enabled: newState
                    });
                });
            });
        });
    });

    // 설정 변경 이벤트
    popupDelay.addEventListener('change', function() {
        chrome.storage.sync.set({ popupDelay: parseInt(this.value) });
    });

    factualCheckbox.addEventListener('change', function() {
        saveCategorySettings();
    });

    logicalCheckbox.addEventListener('change', function() {
        saveCategorySettings();
    });

    practicalCheckbox.addEventListener('change', function() {
        saveCategorySettings();
    });

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

    // 설정 로드 함수
    function loadSettings() {
        chrome.storage.sync.get(['enabled', 'popupDelay', 'categories'], function(result) {
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
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'updateStats') {
            loadStats();
        }
    });
}); 