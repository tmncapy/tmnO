// ControllerR1.js - Round 1: Xuất phát
let currentXuatPhatDe = 1;
let currentXuatPhatQIndex = 0;
let xuatPhatTimerInterval = null;
let xuatPhatTimeLeft = 60;
let isXuatPhatStarted = false;
let xpBuzzerWinner = 0;
let xpBuzzerWinnerTime = '';
let xpBuzzerOpen = false;
let xpUnlockDelayTimer = null;
let xpUnlockCountdownInterval = null;
let xpUnlockElapsedInterval = null;
let xpBellUnlockTime = 0;

function setXPBellDelayStatus(text, color) {
    const el = document.getElementById('xp_bell_delay_status');
    if (el) {
        el.innerText = text || '';
        el.style.color = color || '#fde047';
    }
}

function getXPBellDelaySeconds(qText) {
    const cleanLen = (qText || '').toString().trim().length;
    if (cleanLen <= 55) return 2;
    if (cleanLen <= 105) return 3;
    if (cleanLen <= 155) return 4;
    return 5;
}

function clearXPBellUnlockDelay() {
    if (xpUnlockDelayTimer) {
        clearTimeout(xpUnlockDelayTimer);
        xpUnlockDelayTimer = null;
    }
    if (xpUnlockCountdownInterval) {
        clearInterval(xpUnlockCountdownInterval);
        xpUnlockCountdownInterval = null;
    }
    if (xpUnlockElapsedInterval) {
        clearInterval(xpUnlockElapsedInterval);
        xpUnlockElapsedInterval = null;
    }
    xpBellUnlockTime = 0;
    setXPBellDelayStatus('');
}

function scheduleXPTurn5BellUnlock(qText) {
    clearXPBellUnlockDelay();
    const delaySec = getXPBellDelaySeconds(qText);
    const unlockAt = Date.now() + delaySec * 1000;
    xpBuzzerOpen = false;
    xpBuzzerWinner = 0;
    clearXPBuzzerUI();
    setXPBellDelayStatus(`🔒 Mở chuông: ${delaySec}s`, '#fde047');

    xpUnlockCountdownInterval = setInterval(() => {
        if (currentXuatPhatTurn !== 5 || !isXuatPhatStarted || xpBuzzerWinner !== 0) {
            clearXPBellUnlockDelay();
            return;
        }
        const rem = Math.max(1, Math.ceil((unlockAt - Date.now()) / 1000));
        setXPBellDelayStatus(`🔒 Mở chuông: ${rem}s`, '#fde047');
    }, 250);

    xpUnlockDelayTimer = setTimeout(() => {
        if (xpUnlockCountdownInterval) {
            clearInterval(xpUnlockCountdownInterval);
            xpUnlockCountdownInterval = null;
        }
        xpUnlockDelayTimer = null;
        if (currentXuatPhatTurn !== 5 || !isXuatPhatStarted || xpBuzzerWinner !== 0) {
            return;
        }
        xpBuzzerOpen = true;
        xpBellUnlockTime = Date.now();
        setXPBellDelayStatus('🔔 Mở chuông: 0.00s', '#bbf7d0');
        xpUnlockElapsedInterval = setInterval(() => {
            if (currentXuatPhatTurn !== 5 || !xpBuzzerOpen || xpBuzzerWinner !== 0) {
                if (xpUnlockElapsedInterval) {
                    clearInterval(xpUnlockElapsedInterval);
                    xpUnlockElapsedInterval = null;
                }
                return;
            }
            const elapsed = Math.max(0, (Date.now() - xpBellUnlockTime) / 1000);
            setXPBellDelayStatus(`🔔 Mở chuông: ${elapsed.toFixed(2)}s`, '#bbf7d0');
        }, 100);
        const unlockPayload = {
            type: 'UNLOCK_BELLS',
            round: 'KD',
            turnIndex: 5,
            bellUnlockAt: xpBellUnlockTime,
            timestamp: xpBellUnlockTime
        };
        sendToProjector('UNLOCK_BELLS', unlockPayload);
        if (typeof sendSupabaseAction === 'function') {
            sendSupabaseAction(unlockPayload);
        }
        showToast('🔔 Chuông đã mở — Thí sinh có thể bấm chuông!');
    }, delaySec * 1000);

    return { delaySec, unlockAt };
}

function clearXPBuzzerUI() {
    xpBuzzerWinnerTime = '';
    for (let i = 1; i <= 4; i++) {
        const bar = document.getElementById(`ts${i}_xp_buzz_bar`);
        if (bar) {
            bar.textContent = '';
            bar.style.background = '#f8fafc';
            bar.style.color = '#64748b';
            bar.style.borderColor = '#cbd5e1';
        }
        const extraEl = document.getElementById(`ts${i}_extra`);
        if (extraEl) {
            extraEl.value = '';
        }
    }
}

function setXPBuzzerWinnerUI(tsIdx, bellTimeStr) {
    clearXPBuzzerUI();
    if (!tsIdx || tsIdx < 1 || tsIdx > 4) return;
    const cleanSec = bellTimeStr ? String(bellTimeStr).replace(/s|giây/gi, '').trim() : '';
    xpBuzzerWinnerTime = cleanSec;
    const bar = document.getElementById(`ts${tsIdx}_xp_buzz_bar`);
    if (bar) {
        bar.textContent = cleanSec ? `🔔 BẤM CHUÔNG NHANH NHẤT — ${cleanSec}s` : '🔔 BẤM CHUÔNG NHANH NHẤT';
        bar.style.background = '#fef08a';
        bar.style.color = '#b91c1c';
        bar.style.borderColor = '#eab308';
    }
    const extraEl = document.getElementById(`ts${tsIdx}_extra`);
    if (extraEl) {
        extraEl.value = cleanSec ? `${cleanSec}s` : '';
    }
}

function changeXuatPhatDe(val) {
    clearInterval(xuatPhatTimerInterval);
    xuatPhatTimerInterval = null;
    clearXPBellUnlockDelay();
    currentXuatPhatDe = parseInt(val) || 1;
    currentXuatPhatQIndex = 0;
    isXuatPhatStarted = false;
    xpBuzzerWinner = 0;
    xpBuzzerOpen = false;
    clearXPBuzzerUI();
    updateTab1Preview();
    const questions = gameData.xuatPhat[currentXuatPhatDe] || [];
    const currentQ = questions[0] || { q: '', a: '' };
    const qText = currentQ.q || `Câu 1 bộ đề ${currentXuatPhatDe}`;
    const ansVal = currentQ.a || `--`;
    const payload = {
        type: 'XUAT_PHAT_SHOW_QUESTION',
        deIndex: currentXuatPhatDe,
        questionIndex: 1,
        questionText: qText,
        answerText: ansVal,
        answer: ansVal,
        xpQuestionShown: false,
        gameData: gameData,
        contestants: gameData.contestants,
        timestamp: Date.now()
    };
    sendToProjector('XUAT_PHAT_SHOW_QUESTION', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    showToast(`Đã chọn Bộ đề ${currentXuatPhatDe}`);
}

function selectLuotThi(turnIndex) {
    clearInterval(xuatPhatTimerInterval);
    xuatPhatTimerInterval = null;
    clearXPBellUnlockDelay();
    currentXuatPhatTurn = Math.min(5, Math.max(1, parseInt(turnIndex, 10) || 1));
    if (currentXuatPhatTurn >= 1 && currentXuatPhatTurn <= 5) {
        currentXuatPhatDe = currentXuatPhatTurn;
    }
    xuatPhatTimeLeft = (currentXuatPhatTurn === 5) ? 5 : 60;
    currentXuatPhatQIndex = 0;
    isXuatPhatStarted = false;
    xpBuzzerWinner = 0;
    xpBuzzerOpen = false;
    clearXPBuzzerUI();

    for (let i = 1; i <= 5; i++) {
        const btn = document.getElementById(`btn_luot_${i}`);
        if (btn) {
            if (i === currentXuatPhatTurn) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    }

    const totalQuestions = getXuatPhatTotalQuestions(currentXuatPhatDe);
    updateTab1Preview();
    const questions = gameData.xuatPhat[currentXuatPhatDe] || [];
    const currentQ = questions[0] || { q: '', a: '' };
    const qText = currentQ.q || `Câu 1 bộ đề ${currentXuatPhatDe}`;
    const ansVal = currentQ.a || `--`;

    if (currentXuatPhatTurn === 5) {
        const payload = {
            type: 'XUAT_PHAT_SELECT_CHUNG',
            turnIndex: 5,
            contestantId: 5,
            deIndex: 5,
            name: 'Lượt thi chung',
            score: 0,
            questionIndex: 1,
            totalQuestions: totalQuestions,
            questionText: qText,
            answerText: ansVal,
            answer: ansVal,
            xpQuestionShown: false,
            gameData: gameData,
            contestants: gameData.contestants,
            timestamp: Date.now()
        };
        sendToProjector('XUAT_PHAT_SELECT_CHUNG', payload);
        if (typeof sendSupabaseAction === 'function') {
            sendSupabaseAction(payload);
        }
        showToast('Đã chọn Lượt thi 5 (Lượt thi chung - 12 câu)');
        return;
    }

    const name = gameData.contestants[currentXuatPhatTurn - 1]?.name || `Thí sinh ${currentXuatPhatTurn}`;
    const score = gameData.contestants[currentXuatPhatTurn - 1]?.score || 0;

    const payload = {
        type: 'XUAT_PHAT_SELECT_CONTESTANT',
        turnIndex: currentXuatPhatTurn,
        contestantId: currentXuatPhatTurn,
        deIndex: currentXuatPhatDe,
        name,
        score,
        questionIndex: 1,
        totalQuestions: totalQuestions,
        questionText: qText,
        answerText: ansVal,
        answer: ansVal,
        xpQuestionShown: false,
        gameData: gameData,
        contestants: gameData.contestants,
        timestamp: Date.now()
    };
    sendToProjector('XUAT_PHAT_SELECT_CONTESTANT', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
}

function getXuatPhatTotalQuestions(deIdx) {
    const idx = parseInt(deIdx, 10) || 1;
    const maxForTurn = (idx >= 1 && idx <= 4) ? 6 : 12;
    const questions = (typeof gameData !== 'undefined' && gameData?.xuatPhat?.[idx]) ? gameData.xuatPhat[idx] : [];
    let nonEmptyCount = 0;
    const limit = Math.min(questions.length, maxForTurn);
    for (let i = 0; i < limit; i++) {
        if (questions[i] && ((questions[i].q && questions[i].q.trim()) || (questions[i].a && questions[i].a.trim()))) {
            nonEmptyCount = i + 1;
        }
    }
    return nonEmptyCount > 0 ? Math.min(nonEmptyCount, maxForTurn) : maxForTurn;
}

function updateTab1Preview() {
    const titleEl = document.getElementById('preview_turn_title');
    const scoreEl = document.getElementById('preview_current_score');
    const qNumEl = document.getElementById('preview_q_num');
    const qTotalEl = document.getElementById('preview_q_total');
    const deSelectEl = document.getElementById('preview_de_select');
    const timerEl = document.getElementById('preview_timer');
    const qTextEl = document.getElementById('preview_q_text');
    const aTextEl = document.getElementById('preview_a_text');

    const totalQuestions = getXuatPhatTotalQuestions(currentXuatPhatDe || 1);
    if (qTotalEl) qTotalEl.innerText = totalQuestions;

    if (!currentXuatPhatTurn || currentXuatPhatTurn <= 0) {
        if (titleEl) titleEl.innerText = `LƯỢT THI: CHƯA CHỌN THÍ SINH`;
        if (scoreEl) scoreEl.innerText = '0';
        if (qNumEl) qNumEl.innerText = '1';
        if (timerEl) timerEl.innerText = '60';
        if (qTextEl) qTextEl.innerText = 'Vui lòng chọn Lượt thi (TS1..TS4 hoặc Lượt thi chung)...';
        if (aTextEl) aTextEl.innerText = 'Đáp án: ...';
        return;
    }

    if (currentXuatPhatTurn === 5) {
        if (xpBuzzerWinner >= 1 && xpBuzzerWinner <= 4) {
            const wName = gameData.contestants[xpBuzzerWinner - 1]?.name || `Thí sinh ${xpBuzzerWinner}`;
            const wScore = gameData.contestants[xpBuzzerWinner - 1]?.score || 0;
            const timeSuffix = xpBuzzerWinnerTime ? ` (${xpBuzzerWinnerTime}s)` : '';
            if (titleEl) titleEl.innerText = `LƯỢT THI 5 (THI CHUNG) — 🔔 TS${xpBuzzerWinner}: ${wName.toUpperCase()}${timeSuffix}`;
            if (scoreEl) scoreEl.innerText = wScore;
        } else {
            if (titleEl) titleEl.innerText = `LƯỢT THI 5: LƯỢT THI CHUNG (BẤM CHUÔNG)`;
            if (scoreEl) scoreEl.innerText = '--';
        }
    } else {
        const turnName = gameData.contestants[currentXuatPhatTurn - 1]?.name || `THÍ SINH ${currentXuatPhatTurn}`;
        const currentScore = gameData.contestants[currentXuatPhatTurn - 1]?.score || 0;
        if (titleEl) titleEl.innerText = `LƯỢT THI ${currentXuatPhatTurn}: ${turnName.toUpperCase()}`;
        if (scoreEl) scoreEl.innerText = currentScore;
    }

    if (qNumEl) qNumEl.innerText = currentXuatPhatQIndex + 1;
    if (deSelectEl) deSelectEl.value = currentXuatPhatDe;
    if (timerEl) timerEl.innerText = xuatPhatTimeLeft;
    const statusEl = document.getElementById('preview_status_text');
    if (statusEl) statusEl.innerText = xuatPhatTimeLeft;

    const questions = gameData.xuatPhat[currentXuatPhatDe] || [];
    const currentQ = questions[currentXuatPhatQIndex] || { q: '', a: '' };

    if (qTextEl) qTextEl.innerText = currentQ.q ? `Câu ${currentXuatPhatQIndex + 1}: ${currentQ.q}` : `Nội dung câu hỏi số ${currentXuatPhatQIndex + 1}`;
    if (aTextEl) aTextEl.innerText = `Đáp án: ${currentQ.a || '...'}`;
}

function onClickIntroXuatPhat() {
    sendToProjector('XUAT_PHAT_INTRO');
    showToast('Phát Intro Xuất Phát');
}

function onClickLuatXuatPhat() {
    sendToProjector('XUAT_PHAT_LUAT');
    showToast('Hiển thị Luật thi Xuất Phát');
}

function onClickHienGraphicChonDe() {
    if (!currentXuatPhatTurn || currentXuatPhatTurn <= 0) {
        showToast('⚠️ Vui lòng chọn Lượt thi của Thí sinh trước (TS1, TS2, TS3, hoặc TS4)!');
        return;
    }
    const name = gameData.contestants[currentXuatPhatTurn - 1]?.name || `Thí sinh ${currentXuatPhatTurn}`;
    const questions = gameData.xuatPhat[currentXuatPhatDe] || [];
    const currentQ = questions[currentXuatPhatQIndex] || { q: '', a: '' };
    const payload = {
        type: 'XUAT_PHAT_SHOW_GRAPHIC_CHON_DE',
        turnIndex: currentXuatPhatTurn,
        deIndex: currentXuatPhatDe,
        questionIndex: currentXuatPhatQIndex + 1,
        questionText: currentQ.q || '',
        answerText: currentQ.a || '',
        answer: currentQ.a || '',
        name: name,
        xpQuestionShown: false,
        gameData: gameData,
        timestamp: Date.now()
    };
    sendToProjector('XUAT_PHAT_SHOW_GRAPHIC_CHON_DE', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    showToast('Đã hiện graphic Chọn Đề trên Projector');
}

function onClickHienGraphicCauHoi() {
    clearInterval(xuatPhatTimerInterval);
    xuatPhatTimerInterval = null;
    clearXPBellUnlockDelay();
    const turnIdx = (currentXuatPhatTurn && currentXuatPhatTurn > 0) ? currentXuatPhatTurn : 0;
    const deIdx = currentXuatPhatDe || (turnIdx > 0 ? turnIdx : 1);
    currentXuatPhatQIndex = 0;
    isXuatPhatStarted = false;
    xpBuzzerWinner = 0;
    xpBuzzerOpen = false;
    clearXPBuzzerUI();
    updateTab1Preview();

    const name = (turnIdx >= 1 && turnIdx <= 4)
        ? (gameData.contestants[turnIdx - 1]?.name || `Thí sinh ${turnIdx}`)
        : (turnIdx === 5 ? 'Lượt thi chung' : '');
    const score = (turnIdx >= 1 && turnIdx <= 4) ? (gameData.contestants[turnIdx - 1]?.score || 0) : 0;
    const totalQuestions = getXuatPhatTotalQuestions(deIdx);

    const payload = {
        type: 'XUAT_PHAT_SHOW_GRAPHIC_CAU_HOI',
        turnIndex: turnIdx,
        deIndex: deIdx,
        totalQuestions: totalQuestions,
        name: name,
        contestantName: name,
        score: score,
        contestants: gameData.contestants,
        xpQuestionShown: false,
        gameData: gameData,
        timestamp: Date.now()
    };
    sendToProjector('XUAT_PHAT_SHOW_GRAPHIC_CAU_HOI', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    showToast('Đã hiện graphic khung Câu Hỏi trên Projector');
}

function onClickHienCauHoi() {
    clearInterval(xuatPhatTimerInterval);
    xuatPhatTimerInterval = null;
    clearXPBellUnlockDelay();
    const turnIdx = (currentXuatPhatTurn && currentXuatPhatTurn > 0) ? currentXuatPhatTurn : 0;
    const deIdx = currentXuatPhatDe || (turnIdx > 0 ? turnIdx : 1);
    currentXuatPhatQIndex = 0;
    isXuatPhatStarted = true;
    xpBuzzerWinner = 0;
    xpBuzzerOpen = false;
    if (turnIdx === 5) xuatPhatTimeLeft = 5;
    clearXPBuzzerUI();
    updateTab1Preview();

    const name = (turnIdx >= 1 && turnIdx <= 4)
        ? (gameData.contestants[turnIdx - 1]?.name || `Thí sinh ${turnIdx}`)
        : (turnIdx === 5 ? 'Lượt thi chung' : '');
    const score = (turnIdx >= 1 && turnIdx <= 4) ? (gameData.contestants[turnIdx - 1]?.score || 0) : 0;
    const questions = (typeof gameData !== 'undefined' && gameData?.xuatPhat?.[deIdx]) ? gameData.xuatPhat[deIdx] : [];
    const totalQuestions = getXuatPhatTotalQuestions(deIdx);
    const currentQ = questions[0] || { q: '', a: '' };
    const qText = currentQ.q || `Nội dung câu hỏi số 1`;
    const ansText = currentQ.a || '';

    const qNumEl = document.getElementById('preview_q_num');
    const qTextEl = document.getElementById('preview_q_text');
    const aTextEl = document.getElementById('preview_a_text');
    if (qNumEl) qNumEl.innerText = '1';
    if (qTextEl) qTextEl.innerText = `Câu 1: ${qText}`;
    if (aTextEl) aTextEl.innerText = `Đáp án: ${ansText || '...'}`;

    let delayInfo = null;
    if (turnIdx === 5) {
        delayInfo = scheduleXPTurn5BellUnlock(qText);
    }

    const payload = {
        type: 'XUAT_PHAT_HIEN_CAU_HOI',
        turnIndex: turnIdx,
        deIndex: deIdx,
        questionIndex: 1,
        totalQuestions: totalQuestions,
        questionText: qText,
        answerText: ansText,
        answer: ansText,
        name: name,
        contestantName: name,
        score: score,
        contestants: gameData.contestants,
        xpQuestionShown: true,
        unlockBells: false,
        bellDelaySeconds: delayInfo ? delayInfo.delaySec : 0,
        bellUnlockAt: delayInfo ? delayInfo.unlockAt : 0,
        gameData: gameData,
        timestamp: Date.now()
    };
    sendToProjector('XUAT_PHAT_HIEN_CAU_HOI', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    if (turnIdx === 5 && delayInfo) {
        showToast(`Đã hiện Câu 1 — Mở chuông sau ${delayInfo.delaySec}s`);
    } else {
        showToast('Đã hiện Câu 1 và phát nhạc suy nghĩ');
    }
}

function handleXuatPhatBuzzFromPlayer(tsIdx, data) {
    const id = parseInt(tsIdx, 10);
    if (!id || id < 1 || id > 4) return;
    if (currentXuatPhatTurn !== 5) return;
    if (data && data.winnerId && parseInt(data.winnerId, 10) !== id) return;
    if (!xpBuzzerOpen || xpBuzzerWinner !== 0) return;

    const unlockAtSnapshot = xpBellUnlockTime;
    let bellSecondsStr = '';
    if (unlockAtSnapshot > 0) {
        bellSecondsStr = Math.max(0, (Date.now() - unlockAtSnapshot) / 1000).toFixed(2);
    } else if (data && (data.bellTime !== undefined || (data.time && data.time !== '00.00'))) {
        const rawBell = (data.bellTime !== undefined && data.bellTime !== null && String(data.bellTime).trim() !== '') ? data.bellTime : data.time;
        const parsed = parseFloat(String(rawBell).replace(/s|giây/gi, '').trim());
        if (!isNaN(parsed) && parsed >= 0) {
            bellSecondsStr = parsed.toFixed(2);
        }
    }

    clearXPBellUnlockDelay();
    xpBuzzerWinner = id;
    xpBuzzerOpen = false;
    setXPBuzzerWinnerUI(id, bellSecondsStr);
    updateTab1Preview();

    const name = gameData.contestants[id - 1]?.name || `Thí sinh ${id}`;
    const timeBadge = bellSecondsStr ? ` (${bellSecondsStr}s)` : '';
    setXPBellDelayStatus(`🔔 TS${id} bấm chuông${timeBadge}`, '#fde047');
    const lockPayload = {
        type: 'XUAT_PHAT_SHOW_FASTEST_HL',
        turnIndex: 5,
        contestantId: id,
        contestantIndex: id,
        whoBuzzed: id,
        contestantName: name,
        bellTime: bellSecondsStr,
        questionIndex: currentXuatPhatQIndex + 1,
        timestamp: Date.now()
    };
    sendToProjector('XUAT_PHAT_SHOW_FASTEST_HL', lockPayload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(lockPayload);
    }
    showToast(`🔔 ${name} đã bấm chuông nhanh nhất${timeBadge}!`);
}

function onClickTinhThoiGianXP() {
    clearInterval(xuatPhatTimerInterval);
    xuatPhatTimerInterval = null;
    const durationSec = 5;
    const startTime = Date.now();
    xuatPhatTimeLeft = durationSec;

    const timerEl = document.getElementById('preview_timer');
    const statusEl = document.getElementById('preview_status_text');
    if (timerEl) timerEl.innerText = String(durationSec);
    if (statusEl) statusEl.innerText = String(durationSec);

    const payload = {
        type: 'XUAT_PHAT_START_TIMER',
        turnIndex: currentXuatPhatTurn || 0,
        deIndex: currentXuatPhatDe || 1,
        questionIndex: currentXuatPhatQIndex + 1,
        duration: durationSec,
        is5s: true,
        startTime: startTime,
        xpQuestionShown: isXuatPhatStarted,
        contestants: gameData.contestants,
        timestamp: startTime
    };
    sendToProjector('XUAT_PHAT_START_TIMER', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }

    xuatPhatTimerInterval = setInterval(() => {
        const rem = Math.max(0, Math.ceil((startTime + durationSec * 1000 - Date.now()) / 1000));
        xuatPhatTimeLeft = rem;
        const tEl = document.getElementById('preview_timer');
        const sEl = document.getElementById('preview_status_text');
        if (tEl) tEl.innerText = String(rem);
        if (sEl) sEl.innerText = String(rem);
        if (rem <= 0) {
            clearInterval(xuatPhatTimerInterval);
            xuatPhatTimerInterval = null;
            showToast('⏰ Hết 5s trả lời!');
        }
    }, 200);

    showToast('⏱️ Bắt đầu tính thời gian 5s trả lời');
}

window.clearXPBuzzerUI = clearXPBuzzerUI;
window.clearXPBellUnlockDelay = clearXPBellUnlockDelay;
window.getXPBellDelaySeconds = getXPBellDelaySeconds;
window.handleXuatPhatBuzzFromPlayer = handleXuatPhatBuzzFromPlayer;
window.onClickHienGraphicCauHoi = onClickHienGraphicCauHoi;
window.onClickHienCauHoi = onClickHienCauHoi;
window.onClickTinhThoiGianXP = onClickTinhThoiGianXP;

function onClickRandomDe() {
    if (!currentXuatPhatTurn || currentXuatPhatTurn <= 0) {
        showToast('⚠️ Vui lòng chọn Lượt thi của Thí sinh trước (TS1, TS2, TS3, hoặc TS4)!');
        return;
    }
    const chosenSet = Math.floor(Math.random() * 8) + 1;
    currentXuatPhatDe = chosenSet;
    currentXuatPhatQIndex = 0;
    updateTab1Preview();
    const name = gameData.contestants[currentXuatPhatTurn - 1]?.name || `Thí sinh ${currentXuatPhatTurn}`;
    const questions = gameData.xuatPhat[chosenSet] || [];
    const currentQ = questions[0] || { q: '', a: '' };

    const payload = {
        type: 'XUAT_PHAT_RANDOM_DE',
        turnIndex: currentXuatPhatTurn,
        deNumber: chosenSet,
        deIndex: chosenSet,
        questionIndex: 1,
        questionText: currentQ.q || '',
        answerText: currentQ.a || '',
        answer: currentQ.a || '',
        name: name,
        xpQuestionShown: false,
        timestamp: Date.now()
    };
    sendToProjector('XUAT_PHAT_RANDOM_DE', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    showToast(`Đã random chọn Bộ đề ${chosenSet} cho ${name}`);
}

function onClickKhoidong() {
    if (!currentXuatPhatTurn || currentXuatPhatTurn <= 0) {
        showToast('⚠️ Vui lòng chọn Lượt thi của Thí sinh trước (TS1, TS2, TS3, hoặc TS4)!');
        return;
    }
    const name = gameData.contestants[currentXuatPhatTurn - 1]?.name || `Thí sinh ${currentXuatPhatTurn}`;
    sendToProjector('XUAT_PHAT_SHOW_GRAPHIC_CHON_DE', { turnIndex: currentXuatPhatTurn, name });
    showToast('Khởi động lượt thi');
}

function onClickBatDau60s() {
    const turnIdx = (currentXuatPhatTurn && currentXuatPhatTurn > 0) ? currentXuatPhatTurn : 0;
    const name = turnIdx > 0 ? (gameData.contestants[turnIdx - 1]?.name || `Thí sinh ${turnIdx}`) : '';
    const score = turnIdx > 0 ? (gameData.contestants[turnIdx - 1]?.score || 0) : 0;

    const payload = {
        type: 'XUAT_PHAT_PSTART',
        turnIndex: turnIdx,
        deIndex: currentXuatPhatDe || 1,
        contestantName: name,
        score: score,
        contestants: gameData.contestants,
        xpQuestionShown: false,
        timestamp: Date.now()
    };
    sendToProjector('XUAT_PHAT_PSTART', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    showToast('Phát nhạc Bắt đầu Khởi Động');
}

function onClickDung() {
    if (!currentXuatPhatTurn || currentXuatPhatTurn <= 0) {
        showToast('⚠️ Vui lòng chọn Lượt thi của Thí sinh trước!');
        return;
    }
    clearInterval(xuatPhatTimerInterval);
    xuatPhatTimerInterval = null;
    clearXPBellUnlockDelay();
    let targetTs = currentXuatPhatTurn;
    if (currentXuatPhatTurn === 5) {
        if (!xpBuzzerWinner || xpBuzzerWinner < 1 || xpBuzzerWinner > 4) {
            showToast('⚠️ Chưa có thí sinh nào bấm chuông trả lời!');
            return;
        }
        targetTs = xpBuzzerWinner;
        xpBuzzerOpen = false;
    }
    const questions = gameData.xuatPhat[currentXuatPhatDe] || [];
    const currentQ = questions[currentXuatPhatQIndex] || { q: '', a: '' };
    let newScore = 0;
    if (gameData.contestants[targetTs - 1]) {
        gameData.contestants[targetTs - 1].score += 10;
        newScore = gameData.contestants[targetTs - 1].score;
        if (typeof syncContestantsUI === 'function') syncContestantsUI();
        saveAllData();
        updateTab1Preview();
    }
    const payload = {
        type: 'XUAT_PHAT_RIGHT',
        score: newScore,
        turnIndex: currentXuatPhatTurn,
        contestantId: targetTs,
        targetContestantId: targetTs,
        deIndex: currentXuatPhatDe,
        questionIndex: currentXuatPhatQIndex + 1,
        questionText: currentQ.q || `Nội dung câu hỏi số ${currentXuatPhatQIndex + 1}`,
        answerText: currentQ.a || '',
        answer: currentQ.a || '',
        contestants: gameData.contestants,
        xpQuestionShown: true,
        timestamp: Date.now()
    };
    sendToProjector('XUAT_PHAT_RIGHT', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    showToast(`Trả lời ĐÚNG (+10đ cho TS${targetTs})`);
}

function onClickSai() {
    if (!currentXuatPhatTurn || currentXuatPhatTurn <= 0) {
        showToast('⚠️ Vui lòng chọn Lượt thi của Thí sinh trước!');
        return;
    }
    clearInterval(xuatPhatTimerInterval);
    xuatPhatTimerInterval = null;
    clearXPBellUnlockDelay();
    const questions = gameData.xuatPhat[currentXuatPhatDe] || [];
    const currentQ = questions[currentXuatPhatQIndex] || { q: '', a: '' };
    let targetTs = currentXuatPhatTurn;
    let newScore = 0;

    if (currentXuatPhatTurn === 5) {
        xpBuzzerOpen = false;
        if (xpBuzzerWinner >= 1 && xpBuzzerWinner <= 4) {
            targetTs = xpBuzzerWinner;
            if (gameData.contestants[targetTs - 1]) {
                gameData.contestants[targetTs - 1].score = (Number(gameData.contestants[targetTs - 1].score) || 0) - 5;
                newScore = gameData.contestants[targetTs - 1].score;
                if (typeof syncContestantsUI === 'function') syncContestantsUI();
                saveAllData();
                updateTab1Preview();
            }
        } else {
            targetTs = 0;
        }
    } else {
        newScore = gameData.contestants[currentXuatPhatTurn - 1]?.score || 0;
    }

    const payload = {
        type: 'XUAT_PHAT_WRONG',
        score: newScore,
        turnIndex: currentXuatPhatTurn,
        contestantId: targetTs,
        targetContestantId: targetTs,
        deIndex: currentXuatPhatDe,
        questionIndex: currentXuatPhatQIndex + 1,
        questionText: currentQ.q || `Nội dung câu hỏi số ${currentXuatPhatQIndex + 1}`,
        answerText: currentQ.a || '',
        answer: currentQ.a || '',
        contestants: gameData.contestants,
        xpQuestionShown: true,
        timestamp: Date.now()
    };
    sendToProjector('XUAT_PHAT_WRONG', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    if (currentXuatPhatTurn === 5 && targetTs > 0) {
        showToast(`Trả lời SAI (-5đ của TS${targetTs})`);
    } else {
        showToast('Trả lời SAI');
    }
}

function onClickChuyenCau() {
    clearInterval(xuatPhatTimerInterval);
    xuatPhatTimerInterval = null;
    clearXPBellUnlockDelay();
    const turnIdx = (currentXuatPhatTurn && currentXuatPhatTurn > 0) ? currentXuatPhatTurn : 0;
    const deIdx = currentXuatPhatDe || (turnIdx > 0 ? turnIdx : 1);
    const totalQuestions = getXuatPhatTotalQuestions(deIdx);
    if (currentXuatPhatQIndex < totalQuestions - 1) {
        currentXuatPhatQIndex++;
        xpBuzzerWinner = 0;
        xpBuzzerOpen = false;
        if (turnIdx === 5) xuatPhatTimeLeft = 5;
        clearXPBuzzerUI();
        updateTab1Preview();
        const questions = (typeof gameData !== 'undefined' && gameData?.xuatPhat?.[deIdx]) ? gameData.xuatPhat[deIdx] : [];
        const currentQ = questions[currentXuatPhatQIndex] || { q: '', a: '' };
        const qNumNum = currentXuatPhatQIndex + 1;
        const qText = currentQ.q || `Nội dung câu hỏi số ${qNumNum}`;
        const ansText = currentQ.a || '';
        const score = (turnIdx >= 1 && turnIdx <= 4) ? (gameData.contestants[turnIdx - 1]?.score || 0) : 0;
        const name = (turnIdx >= 1 && turnIdx <= 4)
            ? (gameData.contestants[turnIdx - 1]?.name || `Thí sinh ${turnIdx}`)
            : (turnIdx === 5 ? 'Lượt thi chung' : '');

        const qNumEl = document.getElementById('preview_q_num');
        const qTotalEl = document.getElementById('preview_q_total');
        const qTextEl = document.getElementById('preview_q_text');
        const aTextEl = document.getElementById('preview_a_text');
        if (qNumEl) qNumEl.innerText = qNumNum;
        if (qTotalEl) qTotalEl.innerText = totalQuestions;
        if (qTextEl) qTextEl.innerText = `Câu ${qNumNum}: ${qText}`;
        if (aTextEl) aTextEl.innerText = `Đáp án: ${ansText || '...'}`;

        let delayInfo = null;
        if (turnIdx === 5) {
            delayInfo = scheduleXPTurn5BellUnlock(qText);
        }

        const payload = {
            type: 'XUAT_PHAT_NEXT_QUESTION',
            turnIndex: turnIdx,
            deIndex: deIdx,
            questionIndex: qNumNum,
            totalQuestions: totalQuestions,
            questionText: qText,
            answerText: ansText,
            answer: ansText,
            contestantName: name,
            score,
            contestants: gameData.contestants,
            xpQuestionShown: true,
            unlockBells: false,
            bellDelaySeconds: delayInfo ? delayInfo.delaySec : 0,
            bellUnlockAt: delayInfo ? delayInfo.unlockAt : 0,
            timestamp: Date.now()
        };
        sendToProjector('XUAT_PHAT_NEXT_QUESTION', payload);
        if (typeof sendSupabaseAction === 'function') {
            sendSupabaseAction(payload);
        }
        if (turnIdx === 5 && delayInfo) {
            showToast(`Đã chuyển sang Câu ${qNumNum}/${totalQuestions} — Mở chuông sau ${delayInfo.delaySec}s`);
        } else {
            showToast(`Đã chuyển sang Câu ${qNumNum}/${totalQuestions}`);
        }
    } else {
        showToast(`Đã hết ${totalQuestions} câu hỏi của lượt thi này`);
    }
}

function resetS1ContestantDe(tsIdx) {
    const payload = {
        type: 'RESET_S1_DE',
        contestantId: tsIdx || 'ALL',
        round: 'XUAT_PHAT',
        activeRound: 'XUAT_PHAT',
        timestamp: Date.now()
    };
    sendToProjector('RESET_S1_DE', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    if (typeof showToast === 'function') {
        showToast(`Đã reset nút chọn bộ đề Xuất Phát`);
    }
}

function onClickDatLaiVongThi() {
    clearInterval(xuatPhatTimerInterval);
    xuatPhatTimerInterval = null;
    clearXPBellUnlockDelay();
    xuatPhatTimeLeft = 60;
    currentXuatPhatQIndex = 0;
    currentXuatPhatTurn = 0;
    isXuatPhatStarted = false;
    xpBuzzerWinner = 0;
    xpBuzzerOpen = false;
    clearXPBuzzerUI();
    for (let i = 1; i <= 5; i++) {
        const btn = document.getElementById(`btn_luot_${i}`);
        if (btn) btn.classList.remove('active');
    }
    const timerEl = document.getElementById('preview_timer');
    if (timerEl) timerEl.innerText = "60";
    const statusEl = document.getElementById('preview_status_text');
    if (statusEl) statusEl.innerText = "60";
    updateTab1Preview();

    const payload = {
        type: 'XUAT_PHAT_RESET',
        turnIndex: 0,
        score: 0,
        round: 'XUAT_PHAT',
        activeRound: 'XUAT_PHAT',
        xpQuestionShown: false,
        timestamp: Date.now()
    };
    sendToProjector('XUAT_PHAT_RESET', payload);
    sendToProjector('RESET_S1_DE', { type: 'RESET_S1_DE', contestantId: 'ALL', timestamp: Date.now() });
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
        sendSupabaseAction({ type: 'RESET_S1_DE', contestantId: 'ALL', timestamp: Date.now() });
    }

    showToast('Đã đặt lại vòng thi Xuất Phát');
}

function onClickDungNhac() {
    sendToProjector('XUAT_PHAT_STOP_SOUND');
    showToast('Đã dừng nhạc');
}

function onClickHoanThanh() {
    clearInterval(xuatPhatTimerInterval);
    xuatPhatTimerInterval = null;
    clearXPBellUnlockDelay();
    isXuatPhatStarted = false;
    xpBuzzerWinner = 0;
    xpBuzzerOpen = false;
    clearXPBuzzerUI();
    updateTab1Preview();
    const payload = {
        type: 'XUAT_PHAT_FINISH',
        xpQuestionShown: false,
        timestamp: Date.now()
    };
    sendToProjector('XUAT_PHAT_FINISH', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    const statusEl = document.getElementById('preview_status_text');
    if (statusEl) statusEl.innerText = "0";
    const timerEl = document.getElementById('preview_timer');
    if (timerEl) timerEl.innerText = "0";
    showToast('Đã hoàn thành lượt thi - Đã ẩn màn hình Projector');
}

function onClickPhatAmThanh() {
    if (typeof playSelectedSoundController === 'function') {
        playSelectedSoundController();
    } else if (typeof showToast === 'function') {
        showToast('Đã phát âm thanh hiệu ứng');
    }
}
