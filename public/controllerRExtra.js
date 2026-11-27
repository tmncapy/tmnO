// ControllerRExtra.js - Extra Questions Tab (Câu Hỏi Phụ / Tie-Breaker Elimination Round)
let currentCHPQuestion = 1;
let chpTimerInterval = null;
let chpRemainingMs = 15000;
let chpTimerRunning = false;
let chpTimerStarted = false;
let chpLastTickAt = 0;
let chpBuzzerOpen = false;
let chpBuzzerWinner = 0;
let chpLastRightWinner = 0;
let chpBellUnlockedAt = 0;
let chpEliminated = [];
let chpParticipants = [1, 2, 3, 4];
let chpQuestionDone = false;
let chpShowActive = false;

function getCHPQuestionItem(num) {
    const idx = num || currentCHPQuestion || 1;
    const qInput = document.getElementById(`chp_q_${idx}`) || document.getElementById(`sys_chp_q_${idx}`);
    const aInput = document.getElementById(`chp_a_${idx}`) || document.getElementById(`sys_chp_a_${idx}`);
    const qItem = (typeof gameData !== 'undefined' && Array.isArray(gameData.cauHoiPhu) && gameData.cauHoiPhu[idx - 1]) || {};
    const qText = (qInput && qInput.value.trim()) || qItem.q || `Nội dung câu hỏi phụ số ${idx}`;
    const aText = (aInput && aInput.value.trim()) || qItem.a || '';
    return { qText, aText };
}

function selectCHPQuestion(num) {
    currentCHPQuestion = num;
    chpShowActive = false;
    chpEliminated = [];
    for (let i = 1; i <= 3; i++) {
        const btn = document.getElementById(`btn_chp_q${i}`);
        if (btn) {
            if (i === num) {
                btn.style.background = '#2563eb';
                btn.style.color = '#ffffff';
            } else {
                btn.style.background = '#80bfff';
                btn.style.color = '#002060';
            }
        }
    }
    const label = document.getElementById('chp_current_q_label');
    if (label) label.innerText = num;
    updateTab5Preview();
}

function getCHPSelectedParticipants() {
    const list = [];
    for (let i = 1; i <= 4; i++) {
        const cb = document.getElementById(`chp_ts_${i}`);
        if (cb && cb.checked) {
            list.push(i);
        }
    }
    return list;
}

function updateCHPParticipants() {
    const activeParticipants = getCHPSelectedParticipants();
    chpParticipants = activeParticipants.slice();

    const badge = document.getElementById('chp_participants_badge');
    if (badge) {
        if (activeParticipants.length === 0) {
            badge.innerText = 'Chưa chọn thí sinh tham gia';
            badge.style.color = '#dc2626';
        } else {
            badge.innerText = `Tham gia (${activeParticipants.length}): ${activeParticipants.map(n => `TS${n}`).join(', ')}`;
            badge.style.color = '#475569';
        }
    }

    syncCHPContestantCardStates();
}

function syncCHPContestantCardStates() {
    const selected = getCHPSelectedParticipants();
    for (let i = 1; i <= 4; i++) {
        const row = document.getElementById(`chp_ts_row_${i}`);
        const hdr = document.getElementById(`chp_card_hdr_${i}`);
        const statusEl = document.getElementById(`ts${i}_ans_chp`);
        const isSelected = selected.includes(i);
        const isEliminated = chpEliminated.includes(i);
        const isBuzzed = chpBuzzerWinner === i;
        const isRightWinner = chpLastRightWinner === i;

        if (row) {
            row.style.pointerEvents = 'auto';
            if (!isSelected) {
                row.style.opacity = '0.42';
                row.style.borderColor = 'transparent';
                row.style.background = 'transparent';
            } else if (isRightWinner) {
                row.style.opacity = '1';
                row.style.borderColor = '#16a34a';
                row.style.background = '#dcfce7';
            } else if (isBuzzed) {
                row.style.opacity = '1';
                row.style.borderColor = '#f59e0b';
                row.style.background = '#fef3c7';
            } else if (isEliminated) {
                row.style.opacity = '0.58';
                row.style.borderColor = '#ef4444';
                row.style.background = '#fee2e2';
            } else {
                row.style.opacity = '1';
                row.style.borderColor = 'transparent';
                row.style.background = 'transparent';
            }
        }

        if (hdr) {
            if (!isSelected) {
                hdr.style.background = '#f1f5f9';
                hdr.style.borderColor = '#cbd5e1';
            } else if (isRightWinner) {
                hdr.style.background = '#bbf7d0';
                hdr.style.borderColor = '#16a34a';
            } else if (isBuzzed) {
                hdr.style.background = '#fde68a';
                hdr.style.borderColor = '#f59e0b';
            } else if (isEliminated) {
                hdr.style.background = '#fecaca';
                hdr.style.borderColor = '#ef4444';
            } else {
                hdr.style.background = '#f1f5f9';
                hdr.style.borderColor = '#cbd5e1';
            }
        }

        if (statusEl) {
            if (!isSelected) {
                statusEl.value = 'Không tham gia';
                statusEl.style.color = '#64748b';
            } else if (isRightWinner) {
                statusEl.value = '✅ TRẢ LỜI ĐÚNG';
                statusEl.style.color = '#15803d';
            } else if (isBuzzed) {
                statusEl.value = '🔔 ĐÃ BẤM CHUÔNG';
                statusEl.style.color = '#b45309';
            } else if (isEliminated) {
                statusEl.value = '❌ ĐÃ BỊ LOẠI (TRẢ LỜI SAI)';
                statusEl.style.color = '#b91c1c';
            } else if (chpBuzzerOpen) {
                statusEl.value = '🔔 Sẵn sàng bấm chuông...';
                statusEl.style.color = '#0369a1';
            } else {
                statusEl.value = 'Đang chờ...';
                statusEl.style.color = '#334155';
            }
        }
    }
}

function updateTab5Preview() {
    const { qText, aText } = getCHPQuestionItem(currentCHPQuestion);

    const titleEl = document.getElementById('chp_preview_title');
    if (titleEl) {
        if (chpBuzzerWinner >= 1 && chpBuzzerWinner <= 4) {
            const cName = (typeof gameData !== 'undefined' && gameData.contestants?.[chpBuzzerWinner - 1]?.name) || `Thí sinh ${chpBuzzerWinner}`;
            titleEl.innerText = `CÂU HỎI PHỤ ${currentCHPQuestion} | 🔔 ${cName} BẤM CHUÔNG`;
        } else if (chpQuestionDone && chpLastRightWinner) {
            const cName = (typeof gameData !== 'undefined' && gameData.contestants?.[chpLastRightWinner - 1]?.name) || `Thí sinh ${chpLastRightWinner}`;
            titleEl.innerText = `CÂU HỎI PHỤ ${currentCHPQuestion} | ✅ ${cName} TRẢ LỜI ĐÚNG`;
        } else if (chpQuestionDone && chpRemainingMs <= 0) {
            titleEl.innerText = `CÂU HỎI PHỤ ${currentCHPQuestion} | ⏰ HẾT 15 GIÂY`;
        } else {
            titleEl.innerText = `VÒNG THI CÂU HỎI PHỤ: CÂU SỐ ${currentCHPQuestion}`;
        }
    }

    const qEl = document.getElementById('chp_preview_q_text');
    if (qEl) qEl.innerText = qText;

    const aEl = document.getElementById('chp_preview_a_text');
    if (aEl) aEl.innerText = `Đáp án: ${aText || '...'}`;

    const timerEl = document.getElementById('chp_preview_timer');
    if (timerEl) timerEl.innerText = Math.max(0, Math.ceil(chpRemainingMs / 1000));
}

function stopCHPCountdownLoop() {
    if (chpTimerInterval) {
        clearInterval(chpTimerInterval);
        chpTimerInterval = null;
    }
    chpTimerRunning = false;
}

function startCHPCountdownLoop() {
    stopCHPCountdownLoop();
    if (chpRemainingMs <= 0) return;

    chpTimerRunning = true;
    chpLastTickAt = Date.now();
    const timerEl = document.getElementById('chp_preview_timer');
    if (timerEl) timerEl.innerText = Math.max(0, Math.ceil(chpRemainingMs / 1000));

    chpTimerInterval = setInterval(() => {
        const now = Date.now();
        const delta = now - chpLastTickAt;
        chpLastTickAt = now;
        chpRemainingMs = Math.max(0, chpRemainingMs - delta);

        const secLeft = Math.max(0, Math.ceil(chpRemainingMs / 1000));
        if (timerEl) timerEl.innerText = secLeft;

        if (chpRemainingMs <= 0) {
            chpRemainingMs = 0;
            stopCHPCountdownLoop();
            chpBuzzerOpen = false;
            chpQuestionDone = true;
            if (timerEl) timerEl.innerText = '0';

            const timeoutPayload = {
                type: 'CAU_HOI_PHU_TIMEOUT',
                round: 'CHP',
                activeRound: 'CHP',
                questionIndex: currentCHPQuestion,
                participatingContestants: chpParticipants,
                eliminatedContestants: chpEliminated,
                timestamp: Date.now()
            };
            sendToProjector('CAU_HOI_PHU_TIMEOUT', timeoutPayload);
            if (typeof sendSupabaseAction === 'function') sendSupabaseAction(timeoutPayload);

            syncCHPContestantCardStates();
            updateTab5Preview();
            if (typeof showToast === 'function') showToast('Hết 15 giây Câu Hỏi Phụ!');
        }
    }, 50);
}

function onClickCHPShowQuestion() {
    if (typeof saveAllData === 'function') saveAllData();
    const participants = getCHPSelectedParticipants();
    if (participants.length === 0) {
        if (typeof showToast === 'function') showToast('Vui lòng tick chọn thí sinh tham gia Câu Hỏi Phụ!');
        return;
    }

    const { qText, aText } = getCHPQuestionItem(currentCHPQuestion);
    stopCHPCountdownLoop();
    chpShowActive = true;
    chpParticipants = participants.slice();
    chpEliminated = [];
    chpBuzzerOpen = true;
    chpBuzzerWinner = 0;
    chpLastRightWinner = 0;
    chpBellUnlockedAt = Date.now();
    chpTimerStarted = false;
    chpQuestionDone = false;
    chpRemainingMs = 15000;

    for (let i = 1; i <= 4; i++) {
        const extraEl = document.getElementById(`ts${i}_extra_chp`);
        if (extraEl) extraEl.value = '';
    }

    const payload = {
        type: 'CAU_HOI_PHU_SHOW_QUESTION',
        round: 'CHP',
        activeRound: 'CHP',
        questionIndex: currentCHPQuestion,
        questionText: qText,
        answerText: aText,
        participatingContestants: chpParticipants,
        eliminatedContestants: [],
        contestants: (typeof gameData !== 'undefined' && Array.isArray(gameData.contestants)) ? gameData.contestants : [],
        timestamp: Date.now()
    };

    sendToProjector('CAU_HOI_PHU_SHOW_QUESTION', payload);
    if (typeof sendSupabaseAction === 'function') sendSupabaseAction(payload);

    updateCHPParticipants();
    updateTab5Preview();
    if (typeof showToast === 'function') showToast(`Đã bắt đầu Câu Hỏi Phụ ${currentCHPQuestion} & mở chuông (${participants.length} thí sinh)`);
}

function onClickCHPStartTimer() {
    if (typeof saveAllData === 'function') saveAllData();
    const participants = getCHPSelectedParticipants();
    if (participants.length === 0) {
        if (typeof showToast === 'function') showToast('Vui lòng tick chọn thí sinh tham gia Câu Hỏi Phụ!');
        return;
    }

    const { qText, aText } = getCHPQuestionItem(currentCHPQuestion);
    stopCHPCountdownLoop();
    chpParticipants = participants.slice();
    if (!chpShowActive) {
        chpEliminated = [];
    } else {
        chpEliminated = chpEliminated.filter(id => chpParticipants.includes(id));
    }
    chpShowActive = true;
    chpBuzzerWinner = 0;
    chpLastRightWinner = 0;
    chpQuestionDone = false;
    chpTimerStarted = true;
    chpRemainingMs = 15000;
    chpBuzzerOpen = true;
    chpBellUnlockedAt = Date.now();

    for (let i = 1; i <= 4; i++) {
        const extraEl = document.getElementById(`ts${i}_extra_chp`);
        if (extraEl) extraEl.value = '';
    }

    const payload = {
        type: 'CAU_HOI_PHU_START_TIMER',
        duration: 15,
        remainingMs: 15000,
        startTime: Date.now(),
        round: 'CHP',
        activeRound: 'CHP',
        questionIndex: currentCHPQuestion,
        questionText: qText,
        answerText: aText,
        participatingContestants: chpParticipants,
        eliminatedContestants: chpEliminated,
        contestants: (typeof gameData !== 'undefined' && Array.isArray(gameData.contestants)) ? gameData.contestants : [],
        timestamp: Date.now()
    };

    sendToProjector('CAU_HOI_PHU_START_TIMER', payload);
    if (typeof sendSupabaseAction === 'function') sendSupabaseAction(payload);

    syncCHPContestantCardStates();
    updateTab5Preview();
    startCHPCountdownLoop();

    if (typeof showToast === 'function') showToast('Bắt đầu 15s Câu Hỏi Phụ (Video 0_15sExtra.mp4 & Nhạc 4_20.mp3)');
}

window.handleCHPBuzzFromPlayer = function(tsIdx, data) {
    const id = parseInt(tsIdx || (data && (data.winnerId || data.contestantId || data.contestantIndex)), 10);
    if (!id || id < 1 || id > 4) return;
    if (!chpBuzzerOpen || chpBuzzerWinner !== 0) return;
    if (!chpParticipants.includes(id) || chpEliminated.includes(id)) return;
    if (data && data.winnerId && parseInt(data.winnerId, 10) !== id) return;

    if (chpTimerRunning && chpLastTickAt > 0) {
        const delta = Date.now() - chpLastTickAt;
        chpRemainingMs = Math.max(0, chpRemainingMs - delta);
    }
    stopCHPCountdownLoop();

    let bellSecStr = '';
    if (chpBellUnlockedAt > 0) {
        bellSecStr = Math.max(0, (Date.now() - chpBellUnlockedAt) / 1000).toFixed(2);
    } else if (data && (data.bellTime !== undefined || (data.time && data.time !== '00.00'))) {
        const rawBell = (data.bellTime !== undefined && data.bellTime !== null && String(data.bellTime).trim() !== '') ? data.bellTime : data.time;
        const parsed = parseFloat(String(rawBell).replace(/s|giây/gi, '').trim());
        if (!isNaN(parsed) && parsed >= 0) {
            bellSecStr = parsed.toFixed(2);
        }
    }

    chpBuzzerOpen = false;
    chpBuzzerWinner = id;
    chpBellUnlockedAt = 0;

    const extraEl = document.getElementById(`ts${id}_extra_chp`);
    if (extraEl) extraEl.value = bellSecStr ? `${bellSecStr}s` : 'BELL';

    const cName = (typeof gameData !== 'undefined' && gameData.contestants?.[id - 1]?.name)
        || (data && data.contestantName)
        || `Thí sinh ${id}`;

    const payload = {
        type: 'CAU_HOI_PHU_BUZZ',
        round: 'CHP',
        activeRound: 'CHP',
        contestantId: id,
        winnerId: id,
        contestantName: cName,
        bellTime: bellSecStr,
        remainingMs: chpRemainingMs,
        participatingContestants: chpParticipants,
        eliminatedContestants: chpEliminated,
        timestamp: Date.now()
    };

    sendToProjector('CAU_HOI_PHU_BUZZ', payload);
    if (typeof sendSupabaseAction === 'function') sendSupabaseAction(payload);

    syncCHPContestantCardStates();
    updateTab5Preview();
    if (typeof showToast === 'function') showToast(`🔔 ${cName} đã bấm chuông Câu Hỏi Phụ!`);
};

function onClickCHPRight() {
    stopCHPCountdownLoop();
    chpBuzzerOpen = false;
    chpQuestionDone = true;
    const winnerId = chpBuzzerWinner || 0;
    chpLastRightWinner = winnerId;
    chpBuzzerWinner = 0;

    const cName = winnerId
        ? ((typeof gameData !== 'undefined' && gameData.contestants?.[winnerId - 1]?.name) || `Thí sinh ${winnerId}`)
        : '';

    const payload = {
        type: 'CAU_HOI_PHU_RIGHT',
        round: 'CHP',
        activeRound: 'CHP',
        contestantId: winnerId,
        winnerId: winnerId,
        contestantName: cName,
        participatingContestants: chpParticipants,
        eliminatedContestants: chpEliminated,
        timestamp: Date.now()
    };

    sendToProjector('CAU_HOI_PHU_RIGHT', payload);
    if (typeof sendSupabaseAction === 'function') sendSupabaseAction(payload);

    syncCHPContestantCardStates();
    updateTab5Preview();
    if (typeof showToast === 'function') {
        showToast(winnerId ? `✅ ${cName} trả lời ĐÚNG Câu Hỏi Phụ (không thay đổi điểm)!` : '✅ Chấm ĐÚNG Câu Hỏi Phụ');
    }
}

function onClickCHPWrong() {
    stopCHPCountdownLoop();
    chpBuzzerOpen = false;

    const wrongId = chpBuzzerWinner || 0;
    if (wrongId >= 1 && wrongId <= 4 && !chpEliminated.includes(wrongId)) {
        chpEliminated.push(wrongId);
    }
    chpBuzzerWinner = 0;

    const remainingActive = chpParticipants.filter(id => !chpEliminated.includes(id));
    const allEliminated = (chpParticipants.length > 0 && remainingActive.length === 0);
    if (allEliminated) {
        chpQuestionDone = true;
    }

    const cName = wrongId
        ? ((typeof gameData !== 'undefined' && gameData.contestants?.[wrongId - 1]?.name) || `Thí sinh ${wrongId}`)
        : '';

    const payload = {
        type: 'CAU_HOI_PHU_WRONG',
        round: 'CHP',
        activeRound: 'CHP',
        contestantId: wrongId,
        contestantName: cName,
        participatingContestants: chpParticipants,
        eliminatedContestants: chpEliminated,
        allEliminated: allEliminated,
        remainingMs: chpRemainingMs,
        timestamp: Date.now()
    };

    sendToProjector('CAU_HOI_PHU_WRONG', payload);
    if (typeof sendSupabaseAction === 'function') sendSupabaseAction(payload);

    syncCHPContestantCardStates();
    updateTab5Preview();
    if (typeof showToast === 'function') {
        if (allEliminated) {
            showToast(`❌ ${cName || 'Thí sinh'} trả lời SAI - Toàn bộ thí sinh đã bị loại!`);
        } else if (wrongId) {
            showToast(`❌ ${cName} trả lời SAI - Bấm Tiếp tục để chạy tiếp 15s!`);
        }
    }
}

function onClickCHPContinue() {
    // If host clicks Tiếp tục directly after someone buzzed without clicking Sai first, eliminate that buzzer automatically
    if (chpBuzzerWinner >= 1 && chpBuzzerWinner <= 4) {
        onClickCHPWrong();
    }

    const remainingActive = chpParticipants.filter(id => !chpEliminated.includes(id));
    if (remainingActive.length === 0) {
        chpQuestionDone = true;
        chpBuzzerOpen = false;
        syncCHPContestantCardStates();
        updateTab5Preview();
        if (typeof showToast === 'function') showToast('Toàn bộ thí sinh đã trả lời sai!');
        return;
    }

    if (chpRemainingMs <= 0) {
        chpQuestionDone = true;
        chpBuzzerOpen = false;
        syncCHPContestantCardStates();
        updateTab5Preview();
        if (typeof showToast === 'function') showToast('Đã hết 15 giây!');
        return;
    }

    chpQuestionDone = false;
    chpBuzzerWinner = 0;
    chpLastRightWinner = 0;
    chpBuzzerOpen = true;
    chpBellUnlockedAt = Date.now();

    const payload = {
        type: 'CAU_HOI_PHU_CONTINUE',
        round: 'CHP',
        activeRound: 'CHP',
        timerStarted: chpTimerStarted,
        remainingMs: chpRemainingMs,
        duration: Math.max(1, Math.ceil(chpRemainingMs / 1000)),
        participatingContestants: chpParticipants,
        eliminatedContestants: chpEliminated,
        timestamp: Date.now()
    };

    sendToProjector('CAU_HOI_PHU_CONTINUE', payload);
    if (typeof sendSupabaseAction === 'function') sendSupabaseAction(payload);

    syncCHPContestantCardStates();
    updateTab5Preview();
    if (chpTimerStarted) {
        startCHPCountdownLoop();
        if (typeof showToast === 'function') showToast('▶ Tiếp tục 15s & mở chuông cho các thí sinh còn lại');
    } else {
        if (typeof showToast === 'function') showToast('▶ Mở lại chuông cho các thí sinh còn lại');
    }
}

function importCHPFromSystem() {
    for (let i = 1; i <= 3; i++) {
        const sysQ = document.getElementById(`sys_chp_q_${i}`)?.value || (gameData.cauHoiPhu?.[i - 1]?.q) || '';
        const sysA = document.getElementById(`sys_chp_a_${i}`)?.value || (gameData.cauHoiPhu?.[i - 1]?.a) || '';
        const chpQ = document.getElementById(`chp_q_${i}`);
        const chpA = document.getElementById(`chp_a_${i}`);
        if (chpQ) chpQ.value = sysQ;
        if (chpA) chpA.value = sysA;
        if (!gameData.cauHoiPhu) gameData.cauHoiPhu = [];
        gameData.cauHoiPhu[i - 1] = { q: sysQ, a: sysA };
    }
    if (typeof saveAllData === 'function') saveAllData();
    if (typeof updateTab5Preview === 'function') updateTab5Preview();
    if (typeof showToast === 'function') showToast('Đã nhập 3 câu hỏi phụ từ Tab Hệ Thống!');
}

function onClickCHPReset() {
    stopCHPCountdownLoop();
    chpShowActive = false;
    chpRemainingMs = 15000;
    chpTimerStarted = false;
    chpBuzzerOpen = false;
    chpBuzzerWinner = 0;
    chpLastRightWinner = 0;
    chpBellUnlockedAt = 0;
    chpEliminated = [];
    chpQuestionDone = false;

    for (let i = 1; i <= 4; i++) {
        const extraEl = document.getElementById(`ts${i}_extra_chp`);
        if (extraEl) extraEl.value = '';
    }

    const payload = {
        type: 'CAU_HOI_PHU_RESET',
        round: 'CHP',
        activeRound: 'CHP',
        participatingContestants: getCHPSelectedParticipants(),
        timestamp: Date.now()
    };

    sendToProjector('CAU_HOI_PHU_RESET', payload);
    if (typeof sendSupabaseAction === 'function') sendSupabaseAction(payload);

    updateCHPParticipants();
    updateTab5Preview();
    if (typeof showToast === 'function') showToast('Đã đặt lại phần thi Câu Hỏi Phụ');
}

window.addEventListener('DOMContentLoaded', () => {
    updateCHPParticipants();
    selectCHPQuestion(1);
});
