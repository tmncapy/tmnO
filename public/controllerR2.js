// ControllerR2.js - Round 3: Tăng tốc
let currentRKQuestion = 1;
let rkTimerInterval = null;
let rkTimeLeft = 20;
let rkTimerEndAt = 0;
let rkAnswerStep = 'idle'; // 'idle' | 'counting' | 'ready'
let rkAnswerCountdownInterval = null;
let rkAnswerCountdownEndAt = 0;

function getRKQuestionDuration(num) {
    const qNum = parseInt(num, 10) || 1;
    return (qNum === 1 || qNum === 2) ? 20 : 30;
}

function sanitizeRKMediaInput(raw) {
    const clean = (raw || '').toString().trim();
    if (!clean || clean === '...' || clean === '…' || clean === 'null' || clean === 'undefined') return '';
    if (/^\.\/cau[1-4]\.mp4$/i.test(clean)) return '';
    return clean;
}

function normalizeRKMediaUrl(raw) {
    const clean = sanitizeRKMediaInput(raw);
    if (!clean) return '';
    if (/^(https?:|blob:|data:)/i.test(clean)) return clean;
    if (typeof window.normalizeMediaUrl === 'function') return window.normalizeMediaUrl(clean);
    if (typeof getApiUrl === 'function') return getApiUrl(clean);
    return clean;
}

function detectRKMediaType(url, explicitType = '') {
    if (explicitType === 'image' || explicitType === 'video') return explicitType;
    const clean = sanitizeRKMediaInput(url);
    if (!clean) return 'none';
    if (clean.startsWith('data:image/') || /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?|#|$)/i.test(clean)) {
        return 'image';
    }
    if (clean.startsWith('data:video/') || /\.(mp4|webm|mov|m4v|avi|mkv|ogv)(\?|#|$)/i.test(clean)) {
        return 'video';
    }
    return 'video';
}

function getRKQuestionData(num) {
    const qNum = parseInt(num, 10) || currentRKQuestion || 1;
    const mInput = document.getElementById(`rk_m_${qNum}`);
    const qInput = document.getElementById(`rk_q_${qNum}`);
    const aInput = document.getElementById(`rk_a_${qNum}`);
    const amInput = document.getElementById(`rk_am_${qNum}`);
    const qItem = (gameData.raKhoi && gameData.raKhoi[qNum - 1]) || {};

    let mediaUrl = sanitizeRKMediaInput(mInput ? mInput.value : '') || sanitizeRKMediaInput(qItem.m || qItem.mediaUrl || '');
    if (mediaUrl.startsWith('blob:') && qItem.m && !qItem.m.startsWith('blob:') && sanitizeRKMediaInput(qItem.m)) {
        mediaUrl = sanitizeRKMediaInput(qItem.m);
    }
    mediaUrl = normalizeRKMediaUrl(mediaUrl);

    const explicitType = mInput?.dataset?.mediaType || qItem.mt || '';
    const mediaType = detectRKMediaType(mediaUrl, explicitType);

    const qText = (qInput && qInput.value.trim()) || qItem.q || `Nội dung câu hỏi Tăng Tốc số ${qNum}`;
    const aText = (aInput && aInput.value.trim()) || qItem.a || '';
    const rawAm = sanitizeRKMediaInput(amInput ? amInput.value : '') || sanitizeRKMediaInput(qItem.am || '');
    const answerMediaUrl = normalizeRKMediaUrl(rawAm);
    const duration = getRKQuestionDuration(qNum);

    return {
        questionIndex: qNum,
        questionText: qText,
        answerText: aText,
        mediaUrl,
        mediaType,
        answerMediaUrl,
        duration
    };
}

function getRKTotalQuestions() {
    const list = (typeof gameData !== 'undefined' && Array.isArray(gameData.raKhoi)) ? gameData.raKhoi : [];
    const q5 = document.getElementById('rk_q_5')?.value?.trim() || list[4]?.q?.trim() || list[4]?.a?.trim() || list[4]?.m?.trim();
    const q6 = document.getElementById('rk_q_6')?.value?.trim() || list[5]?.q?.trim() || list[5]?.a?.trim() || list[5]?.m?.trim();
    if (q6) return 6;
    if (q5) return 5;
    return 4;
}
window.getRKTotalQuestions = getRKTotalQuestions;

function setRKQuestionUI(num) {
    currentRKQuestion = num;
    if (typeof syncRaKhoiRowVisibility === 'function') syncRaKhoiRowVisibility();
    for (let i = 1; i <= 6; i++) {
        const btn = document.getElementById(`btn_rk_q${i}`);
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
    // Clear contestant inputs on controller for the new question
    for (let i = 1; i <= 5; i++) {
        const ansEl = document.getElementById(`ts${i}_ans_rk`);
        if (ansEl) ansEl.value = '';
        const extraEl = document.getElementById(`ts${i}_extra_rk`);
        if (extraEl) extraEl.value = '';
    }

    clearInterval(rkTimerInterval);
    rkTimerInterval = null;
    rkTimerEndAt = 0;
    rkTimeLeft = getRKQuestionDuration(num);

    const timerBtn = document.getElementById('btn_rk_timer');
    if (timerBtn) {
        timerBtn.innerText = `${rkTimeLeft}s`;
        timerBtn.title = `Bắt đầu tính thời gian (${rkTimeLeft}s)`;
    }

    if (typeof resetRKDapAnButton === 'function') resetRKDapAnButton();
    if (typeof updateTab2Preview === 'function') updateTab2Preview();
}
window.setRKQuestionUI = setRKQuestionUI;

function selectRKQuestion(num) {
    setRKQuestionUI(num);

    sendToProjector('CLEAR_PLAYER_ANSWERS', { round: 'RK' });

    const qData = getRKQuestionData(num);
    const payload = {
        type: 'RA_KHOI_SELECT_QUESTION',
        round: 'RK',
        questionIndex: qData.questionIndex,
        questionText: qData.questionText,
        answerText: qData.answerText,
        answer: qData.answerText,
        mediaUrl: qData.mediaUrl,
        mediaType: qData.mediaType,
        duration: qData.duration,
        gameData: gameData,
        contestants: gameData.contestants,
        timestamp: Date.now()
    };
    sendToProjector('RA_KHOI_SELECT_QUESTION', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    if (typeof window.saveControllerRuntimeState === 'function') {
        window.saveControllerRuntimeState();
    }
}

function cycleRKQuestion() {
    const total = getRKTotalQuestions();
    let next = currentRKQuestion + 1;
    if (next > total) next = 1;
    selectRKQuestion(next);
}

function updateTab2Preview() {
    const total = getRKTotalQuestions();
    const qInput = document.getElementById(`rk_q_${currentRKQuestion}`);
    const aInput = document.getElementById(`rk_a_${currentRKQuestion}`);
    const qItem = (gameData.raKhoi && gameData.raKhoi[currentRKQuestion - 1]) || {};
    const qText = (qInput && qInput.value.trim()) || qItem.q || `Nội dung câu hỏi Tăng Tốc số ${currentRKQuestion}...`;
    const aText = (aInput && aInput.value.trim()) || qItem.a || '...';

    const titleEl = document.getElementById('rk_preview_title');
    if (titleEl) titleEl.innerText = `VÒNG THI TĂNG TỐC: CÂU HỎI THỨ ${currentRKQuestion}`;
    const qNumEl = document.getElementById('rk_preview_q_num');
    if (qNumEl) qNumEl.innerText = currentRKQuestion;
    const qTotalEl = document.getElementById('rk_preview_q_total');
    if (qTotalEl) qTotalEl.innerText = String(total);
    const selectBarTitle = document.getElementById('rk_select_bar_title');
    if (selectBarTitle) selectBarTitle.innerText = `Câu hỏi thứ ${currentRKQuestion}`;
    const qTextEl = document.getElementById('rk_preview_q_text');
    if (qTextEl) qTextEl.innerText = qText;
    const aTextEl = document.getElementById('rk_preview_a_text');
    if (aTextEl) aTextEl.innerText = `Đáp án: ${aText}`;
    const timerEl = document.getElementById('rk_preview_timer');
    if (timerEl) timerEl.innerText = rkTimeLeft;
    const statusEl = document.getElementById('rk_preview_status');
    if (statusEl) statusEl.innerText = rkTimeLeft;
}

function onClickRKShowQuestion() {
    if (typeof saveAllData === 'function') saveAllData();
    const qData = getRKQuestionData(currentRKQuestion);

    const payload = {
        type: 'RA_KHOI_SHOW_QUESTION',
        round: 'RK',
        questionIndex: qData.questionIndex,
        questionText: qData.questionText,
        answerText: qData.answerText,
        answer: qData.answerText,
        mediaUrl: qData.mediaUrl,
        mediaType: qData.mediaType,
        duration: qData.duration,
        timestamp: Date.now()
    };
    sendToProjector('RA_KHOI_SHOW_QUESTION', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    const statusEl = document.getElementById('rk_preview_status');
    if (statusEl) statusEl.innerText = rkTimeLeft;
    showToast(`Show câu hỏi Tăng Tốc số ${currentRKQuestion}`);
}
window.onClickRKShowQuestion = onClickRKShowQuestion;

function onClickBatDauDoanBang() {
    onClickRKShowQuestion();
}

function onClickVideoTangToc() {
    onClickRKShowQuestion();
}

function onClickGiaiMaMedia() {
    const qItem = gameData.raKhoi ? (gameData.raKhoi[currentRKQuestion - 1] || { q: '', a: '' }) : { q: '', a: '' };
    const payload = {
        type: 'RA_KHOI_SHOW_GIAI_MA',
        questionIndex: currentRKQuestion,
        questionText: qItem.q || '',
        answerText: qItem.a || '',
        answer: qItem.a || '',
        timestamp: Date.now()
    };
    sendToProjector('RA_KHOI_SHOW_GIAI_MA', payload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payload);
    }
    showToast(`Hiện Giải mã Video/Ảnh cho Câu ${currentRKQuestion}`);
}

function onClickDiemTS() {
    openRKScoreModal();
}
window.onClickDiemTS = onClickDiemTS;

function onClickRKTangToc() {
    if (typeof resetRKDapAnButton === 'function') resetRKDapAnButton();
    sendToProjector('RA_KHOI_INTRO', {
        round: 'RA_KHOI',
        activeRound: 'RA_KHOI',
        timestamp: Date.now()
    });
    showToast('Hiển thị Tăng Tốc trên Projector');
}

function onClickRKTinhThoiGian() {
    clearInterval(rkTimerInterval);
    const duration = getRKQuestionDuration(currentRKQuestion);
    rkTimeLeft = duration;
    rkTimerEndAt = Date.now() + duration * 1000;
    const timerEl = document.getElementById('rk_preview_timer');
    if (timerEl) timerEl.innerText = rkTimeLeft;
    const statusEl = document.getElementById('rk_preview_status');
    if (statusEl) statusEl.innerText = rkTimeLeft;

    rkTimerInterval = setInterval(() => {
        rkTimeLeft = Math.max(0, Math.ceil((rkTimerEndAt - Date.now()) / 1000));
        if (timerEl) timerEl.innerText = rkTimeLeft;
        if (statusEl) statusEl.innerText = rkTimeLeft;
        if (rkTimeLeft <= 0) {
            clearInterval(rkTimerInterval);
            rkTimerInterval = null;
            rkTimerEndAt = 0;
            if (timerEl) timerEl.innerText = "0";
            if (statusEl) statusEl.innerText = "0";
            if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
        }
    }, 250);

    const qData = getRKQuestionData(currentRKQuestion);
    const payloadTimer = {
        type: 'RA_KHOI_START_TIMER',
        round: 'RK',
        questionIndex: qData.questionIndex,
        duration: duration,
        startTime: Date.now(),
        questionText: qData.questionText,
        answerText: qData.answerText,
        answer: qData.answerText,
        mediaUrl: qData.mediaUrl,
        mediaType: qData.mediaType,
        timestamp: Date.now()
    };
    sendToProjector('RA_KHOI_START_TIMER', payloadTimer);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payloadTimer);
    }
    if (typeof window.saveControllerRuntimeState === 'function') {
        window.saveControllerRuntimeState();
    }
    showToast(`Bắt đầu tính thời gian ${duration}s cho Câu ${currentRKQuestion}`);
}

function resetRKDapAnButton() {
    if (rkAnswerCountdownInterval) {
        clearInterval(rkAnswerCountdownInterval);
        rkAnswerCountdownInterval = null;
    }
    rkAnswerCountdownEndAt = 0;
    rkAnswerStep = 'idle';
    const btn = document.getElementById('btn_rk_dap_an_ts');
    if (btn) {
        btn.innerText = 'Đáp án TS';
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
        btn.disabled = false;
    }
}
window.resetRKDapAnButton = resetRKDapAnButton;

function collectRKContestantAnswersPayload() {
    const list = [];
    for (let i = 1; i <= 4; i++) {
        const ts = (gameData.contestants && gameData.contestants[i - 1]) || {};
        const rawName = document.getElementById(`ts${i}_name_rk`)?.value || ts.name || `Thí sinh ${i}`;
        const cleanName = rawName.replace(/\s*\(\d+\)/g, '').replace(/\s*\([\d\.]+(?:s|giây|S)?\)/gi, '').trim() || `Thí sinh ${i}`;
        let timeVal = document.getElementById(`ts${i}_extra_rk`)?.value || ts.rk_time || '';
        let ansVal = document.getElementById(`ts${i}_ans_rk`)?.value || ts.rk_answer || '';

        // In case time was embedded in ansVal
        const match = ansVal.match(/\(([\d\.]+)(?:s|giây)?\)/i);
        if (match) {
            if (!timeVal || timeVal === '00.00') {
                timeVal = match[1];
            }
            ansVal = ansVal.replace(/\(([\d\.]+)(?:s|giây)?\)/i, '').trim();
        }

        const cleanAns = ansVal.trim();
        timeVal = (timeVal || '').toString().replace(/s|giây/gi, '').trim();
        const num = parseFloat(timeVal);
        const hasValidTime = !isNaN(num) && num > 0;
        const formattedTime = !isNaN(num)
            ? (num < 10 ? '0' + num.toFixed(2) : num.toFixed(2))
            : '00.00';

        // Sort fastest valid times first (A -> B -> C -> D); untimed submissions or unanswered stay at bottom
        const sortTime = hasValidTime ? num : (cleanAns ? (999000 + i) : (999999 + i));

        list.push({
            id: i,
            name: cleanName,
            rk_time: formattedTime,
            time: formattedTime,
            rk_answer: cleanAns,
            answer: cleanAns,
            _sortTime: sortTime
        });
    }

    list.sort((a, b) => a._sortTime - b._sortTime);
    return list.map(({ _sortTime, ...rest }) => rest);
}

function onClickRKDapAnTS() {
    const btn = document.getElementById('btn_rk_dap_an_ts');

    if (rkAnswerStep === 'counting') {
        return;
    }

    if (rkAnswerStep === 'idle') {
        if (rkAnswerCountdownInterval) {
            clearInterval(rkAnswerCountdownInterval);
            rkAnswerCountdownInterval = null;
        }
        rkAnswerStep = 'counting';

        // Step 1: Switch projector to blank Round 3 Answer scene & count down 3s -> Hiện
        const preparePayload = {
            type: 'RA_KHOI_PREPARE_ANSWERS',
            round: 'RA_KHOI',
            activeRound: 'RA_KHOI',
            questionIndex: currentRKQuestion,
            contestants: gameData.contestants,
            timestamp: Date.now()
        };
        sendToProjector('RA_KHOI_PREPARE_ANSWERS', preparePayload);
        if (typeof sendSupabaseAction === 'function') {
            sendSupabaseAction(preparePayload);
        }

        rkAnswerCountdownEndAt = Date.now() + 3000;
        let secLeft = 3;
        if (btn) {
            btn.innerText = `${secLeft}s`;
            btn.style.background = '#f59e0b';
            btn.style.color = '#ffffff';
            btn.style.borderColor = '#d97706';
        }

        rkAnswerCountdownInterval = setInterval(() => {
            secLeft = Math.max(0, Math.ceil((rkAnswerCountdownEndAt - Date.now()) / 1000));
            if (secLeft > 0) {
                if (btn) btn.innerText = `${secLeft}s`;
            } else {
                clearInterval(rkAnswerCountdownInterval);
                rkAnswerCountdownInterval = null;
                rkAnswerCountdownEndAt = 0;
                rkAnswerStep = 'ready';
                if (btn) {
                    btn.innerText = 'Hiện';
                    btn.style.background = '#059669';
                    btn.style.color = '#ffffff';
                    btn.style.borderColor = '#047857';
                }
                if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
            }
        }, 250);

        if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
        showToast('Đang chuyển sang scene đáp án Tăng tốc trống (3s)...');
        return;
    }

    if (rkAnswerStep === 'ready') {
        resetRKDapAnButton();
        const qItem = gameData.raKhoi ? (gameData.raKhoi[currentRKQuestion - 1] || { q: '', a: '' }) : { q: '', a: '' };
        const sortedContestants = collectRKContestantAnswersPayload();

        const payloadAns = {
            type: 'RA_KHOI_SHOW_CONTESTANT_ANSWERS',
            round: 'RA_KHOI',
            activeRound: 'RA_KHOI',
            questionIndex: currentRKQuestion,
            correctAnswer: qItem.a || '',
            questionText: qItem.q || '',
            answerText: qItem.a || '',
            answer: qItem.a || '',
            contestants: sortedContestants,
            timestamp: Date.now()
        };
        sendToProjector('RA_KHOI_SHOW_CONTESTANT_ANSWERS', payloadAns);
        if (typeof sendSupabaseAction === 'function') {
            sendSupabaseAction(payloadAns);
        }
        const statusEl = document.getElementById('rk_preview_status');
        if (statusEl) statusEl.innerText = rkTimeLeft;
        if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
        showToast('Đang phát graphic & đáp án Tăng tốc (sắp xếp nhanh đến chậm)...');
    }
}

function onClickRKHienDapAn() {
    const qItem = gameData.raKhoi ? (gameData.raKhoi[currentRKQuestion - 1] || { q: '', a: '' }) : { q: '', a: '' };
    const payloadAns = {
        type: 'RA_KHOI_SHOW_ANSWER',
        questionIndex: currentRKQuestion,
        questionText: qItem.q || '',
        answerText: qItem.a || '',
        answer: qItem.a || '',
        timestamp: Date.now()
    };
    sendToProjector('RA_KHOI_SHOW_ANSWER', payloadAns);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(payloadAns);
    }
    showToast('Hiện Đáp án Đúng trên Projector');
}

function onClickRKDatLai() {
    clearInterval(rkTimerInterval);
    rkTimerInterval = null;
    rkTimerEndAt = 0;
    if (typeof resetRKDapAnButton === 'function') resetRKDapAnButton();
    // Clear contestant inputs on controller
    for (let i = 1; i <= 5; i++) {
        const ansEl = document.getElementById(`ts${i}_ans_rk`);
        if (ansEl) ansEl.value = '';
        const extraEl = document.getElementById(`ts${i}_extra_rk`);
        if (extraEl) extraEl.value = '';
    }
    rkTimeLeft = getRKQuestionDuration(currentRKQuestion);
    const timerBtn = document.getElementById('btn_rk_timer');
    if (timerBtn) {
        timerBtn.innerText = `${rkTimeLeft}s`;
        timerBtn.title = `Bắt đầu tính thời gian (${rkTimeLeft}s)`;
    }
    const timerEl = document.getElementById('rk_preview_timer');
    if (timerEl) timerEl.innerText = rkTimeLeft;
    const statusEl = document.getElementById('rk_preview_status');
    if (statusEl) statusEl.innerText = rkTimeLeft;
    updateTab2Preview();

    sendToProjector('RA_KHOI_RESET', {
        questionIndex: currentRKQuestion,
        round: 'RA_KHOI',
        activeRound: 'RA_KHOI',
        timestamp: Date.now()
    });
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction({
            type: 'RA_KHOI_RESET',
            questionIndex: currentRKQuestion,
            round: 'RA_KHOI',
            activeRound: 'RA_KHOI',
            timestamp: Date.now()
        });
    }

    if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
    showToast('Đã đặt lại vòng Tăng Tốc');
}

let rkScoreModalItems = [];

function parseRKTimeCentiseconds(rawTime) {
    const clean = (rawTime || '').toString().replace(/s|giây/gi, '').replace(',', '.').trim();
    const num = parseFloat(clean);
    if (isNaN(num) || num <= 0) {
        return { valid: false, centis: Infinity, formatted: '00.00' };
    }
    const centis = Math.round(num * 100);
    const val = centis / 100;
    const fixed = val.toFixed(2);
    return {
        valid: true,
        centis,
        formatted: val < 10 ? '0' + fixed : fixed
    };
}

function gatherRKScoreModalContestants() {
    const list = [];
    for (let i = 1; i <= 4; i++) {
        const ts = (gameData.contestants && gameData.contestants[i - 1]) || {};
        const rawName = document.getElementById(`ts${i}_name_rk`)?.value || ts.name || `Thí sinh ${i}`;
        const cleanName = rawName.replace(/\s*\(\d+\)/g, '').replace(/\s*\([\d\.]+(?:s|giây|S)?\)/gi, '').trim() || `Thí sinh ${i}`;
        let ansVal = document.getElementById(`ts${i}_ans_rk`)?.value || ts.rk_answer || '';
        let timeVal = document.getElementById(`ts${i}_extra_rk`)?.value || ts.rk_time || '';

        const match = ansVal.match(/\(([\d\.]+)(?:s|giây)?\)/i);
        if (match) {
            if (!timeVal || timeVal === '00.00') {
                timeVal = match[1];
            }
            ansVal = ansVal.replace(/\(([\d\.]+)(?:s|giây)?\)/i, '').trim();
        }

        const parsedTime = parseRKTimeCentiseconds(timeVal);
        const cleanAns = ansVal.trim();
        const sortKey = parsedTime.valid ? parsedTime.centis : (cleanAns ? 99900000 + i : 99990000 + i);

        list.push({
            idx: i,
            name: cleanName,
            ans: cleanAns,
            timeFormatted: parsedTime.formatted,
            hasValidTime: parsedTime.valid,
            centis: parsedTime.centis,
            sortKey
        });
    }

    list.sort((a, b) => a.sortKey - b.sortKey || a.idx - b.idx);
    return list;
}

function computeRKPointsByIdx(items, checkedSet) {
    const pointScale = [40, 30, 20, 10];
    const pointsByIdx = new Map();
    const checkedItems = items
        .filter(item => checkedSet.has(item.idx))
        .sort((a, b) => {
            if (a.centis !== b.centis) return a.centis - b.centis;
            return a.idx - b.idx;
        });

    let tierIndex = -1;
    let prevCentis = null;
    checkedItems.forEach((item) => {
        if (prevCentis === null || item.centis !== prevCentis) {
            tierIndex++;
            prevCentis = item.centis;
        }
        const pts = pointScale[tierIndex] !== undefined ? pointScale[tierIndex] : 10;
        pointsByIdx.set(item.idx, pts);
    });

    return pointsByIdx;
}

function escapeRKHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function recalculateRKScorePreview() {
    const checkedSet = new Set();
    rkScoreModalItems.forEach((item) => {
        const chk = document.getElementById(`rk_grade_chk_${item.idx}`);
        if (chk && chk.checked) {
            checkedSet.add(item.idx);
        }
    });

    const pointsByIdx = computeRKPointsByIdx(rkScoreModalItems, checkedSet);
    rkScoreModalItems.forEach((item) => {
        const pts = pointsByIdx.get(item.idx) || 0;
        const badge = document.getElementById(`rk_grade_pts_${item.idx}`);
        const row = document.getElementById(`rk_grade_row_${item.idx}`);
        if (badge) {
            badge.textContent = pts > 0 ? `+${pts} đ` : '0 đ';
            badge.style.background = pts > 0 ? '#dcfce7' : '#f1f5f9';
            badge.style.color = pts > 0 ? '#15803d' : '#64748b';
            badge.style.borderColor = pts > 0 ? '#86efac' : '#cbd5e1';
        }
        if (row) {
            row.style.background = pts > 0 ? '#f0fdf4' : '#f8fafc';
            row.style.borderColor = pts > 0 ? '#86efac' : '#cbd5e1';
        }
    });
}
window.recalculateRKScorePreview = recalculateRKScorePreview;

function setAllRKScoreCheckboxes(checked) {
    rkScoreModalItems.forEach((item) => {
        const chk = document.getElementById(`rk_grade_chk_${item.idx}`);
        if (chk) chk.checked = !!checked;
    });
    recalculateRKScorePreview();
}
window.setAllRKScoreCheckboxes = setAllRKScoreCheckboxes;

function openRKScoreModal() {
    const modal = document.getElementById('rk_score_modal');
    const rowsEl = document.getElementById('rk_score_rows');
    const titleEl = document.getElementById('rk_score_modal_title');
    const ansBoxEl = document.getElementById('rk_score_correct_ans');
    if (!modal || !rowsEl) return;

    const qData = getRKQuestionData(currentRKQuestion);
    if (titleEl) {
        titleEl.textContent = `CHẤM ĐIỂM THÍ SINH — TĂNG TỐC CÂU ${qData.questionIndex}`;
    }
    if (ansBoxEl) {
        ansBoxEl.textContent = `Đáp án đúng: ${qData.answerText || '(Chưa nhập đáp án)'}`;
    }

    rkScoreModalItems = gatherRKScoreModalContestants();
    rowsEl.innerHTML = rkScoreModalItems.map((item) => {
        const timeText = item.hasValidTime ? `${item.timeFormatted}s` : 'Chưa có TG';
        const ansDisplay = item.ans ? escapeRKHtml(item.ans) : '<span style="color:#94a3b8;font-style:italic;">(Chưa nhập đáp án)</span>';
        return `
            <label id="rk_grade_row_${item.idx}" for="rk_grade_chk_${item.idx}" style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; background: #f8fafc; cursor: pointer; user-select: none;">
                <input type="checkbox" id="rk_grade_chk_${item.idx}" onchange="recalculateRKScorePreview()" style="width: 20px; height: 20px; accent-color: #16a34a; cursor: pointer; flex-shrink: 0;">
                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="background: #1e3a8a; color: #ffffff; font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 4px;">TS${item.idx}</span>
                        <span style="font-size: 14px; font-weight: 800; color: #0f172a;">${escapeRKHtml(item.name)}</span>
                    </div>
                    <div style="font-size: 13px; color: #334155; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        Đáp án: ${ansDisplay}
                    </div>
                </div>
                <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 10px; font-size: 13px; font-weight: 800; color: #1e40af; font-variant-numeric: tabular-nums; flex-shrink: 0;">
                    ${timeText}
                </div>
                <div id="rk_grade_pts_${item.idx}" style="min-width: 68px; text-align: center; background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 5px 10px; font-size: 13px; font-weight: 800; color: #64748b; font-variant-numeric: tabular-nums; flex-shrink: 0;">
                    0 đ
                </div>
            </label>
        `;
    }).join('');

    recalculateRKScorePreview();
    modal.style.display = 'flex';
}
window.openRKScoreModal = openRKScoreModal;

function closeRKScoreModal() {
    const modal = document.getElementById('rk_score_modal');
    if (modal) modal.style.display = 'none';
}
window.closeRKScoreModal = closeRKScoreModal;

function confirmRKScoreModal() {
    const checkedSet = new Set();
    rkScoreModalItems.forEach((item) => {
        const chk = document.getElementById(`rk_grade_chk_${item.idx}`);
        if (chk && chk.checked) {
            checkedSet.add(item.idx);
        }
    });

    const hasCorrect = checkedSet.size > 0;
    const results = [];
    const wrongRows = [];
    const wrongIds = [];

    rkScoreModalItems.forEach((item, pos) => {
        if (!checkedSet.has(item.idx)) {
            wrongRows.push(pos + 1);
            wrongIds.push(item.idx);
        }
    });

    if (hasCorrect) {
        const pointsByIdx = computeRKPointsByIdx(rkScoreModalItems, checkedSet);
        rkScoreModalItems.forEach((item) => {
            const pts = pointsByIdx.get(item.idx);
            if (pts && pts > 0) {
                if (typeof adjustScore === 'function') {
                    adjustScore(item.idx, pts);
                }
                results.push(`TS${item.idx} (+${pts}đ)`);
            }
        });
    }

    const gradePayload = {
        type: 'RA_KHOI_GRADE_RESULT',
        round: 'RA_KHOI',
        activeRound: 'RA_KHOI',
        questionIndex: currentRKQuestion,
        hasCorrect,
        correctIds: Array.from(checkedSet),
        wrongIds,
        wrongRows,
        contestants: (typeof gameData !== 'undefined' && gameData.contestants) ? gameData.contestants : [],
        timestamp: Date.now()
    };
    sendToProjector('RA_KHOI_GRADE_RESULT', gradePayload);
    if (typeof sendSupabaseAction === 'function') {
        sendSupabaseAction(gradePayload);
    }

    closeRKScoreModal();
    if (typeof window.saveControllerRuntimeState === 'function') window.saveControllerRuntimeState();
    if (typeof showToast === 'function') {
        if (hasCorrect && results.length > 0) {
            showToast(`Đã cộng điểm Tăng tốc: ${results.join(', ')}`);
        } else {
            showToast('Không có thí sinh trả lời đúng (0 điểm).');
        }
    }
}
window.confirmRKScoreModal = confirmRKScoreModal;

function onClickRKAutoScore() {
    openRKScoreModal();
}
window.onClickRKAutoScore = onClickRKAutoScore;

window.__controllerR2State = {
    getState() {
        const answers = {};
        const extras = {};
        for (let i = 1; i <= 5; i++) {
            answers[i] = document.getElementById(`ts${i}_ans_rk`)?.value || '';
            extras[i] = document.getElementById(`ts${i}_extra_rk`)?.value || '';
        }
        return {
            currentRKQuestion,
            rkTimeLeft,
            rkTimerRunning: !!rkTimerInterval,
            rkTimerEndAt,
            rkAnswerStep,
            rkAnswerCountdownEndAt,
            answers,
            extras
        };
    },
    restoreState(st) {
        if (!st || typeof st !== 'object') return;
        clearInterval(rkTimerInterval);
        rkTimerInterval = null;
        if (rkAnswerCountdownInterval) {
            clearInterval(rkAnswerCountdownInterval);
            rkAnswerCountdownInterval = null;
        }

        currentRKQuestion = parseInt(st.currentRKQuestion, 10) || 1;
        if (typeof syncRaKhoiRowVisibility === 'function') syncRaKhoiRowVisibility();
        for (let i = 1; i <= 6; i++) {
            const btn = document.getElementById(`btn_rk_q${i}`);
            if (btn) {
                if (i === currentRKQuestion) {
                    btn.style.background = '#2563eb';
                    btn.style.color = '#ffffff';
                } else {
                    btn.style.background = '#80bfff';
                    btn.style.color = '#002060';
                }
            }
        }

        for (let i = 1; i <= 5; i++) {
            const ansEl = document.getElementById(`ts${i}_ans_rk`);
            if (ansEl && st.answers && st.answers[i] !== undefined) ansEl.value = st.answers[i];
            const extraEl = document.getElementById(`ts${i}_extra_rk`);
            if (extraEl && st.extras && st.extras[i] !== undefined) extraEl.value = st.extras[i];
        }

        const duration = getRKQuestionDuration(currentRKQuestion);
        const timerBtn = document.getElementById('btn_rk_timer');
        if (timerBtn) {
            timerBtn.innerText = `${duration}s`;
            timerBtn.title = `Bắt đầu tính thời gian (${duration}s)`;
        }

        rkTimerEndAt = Number(st.rkTimerEndAt) || 0;
        if (st.rkTimerRunning && rkTimerEndAt > Date.now()) {
            rkTimeLeft = Math.max(0, Math.ceil((rkTimerEndAt - Date.now()) / 1000));
            rkTimerInterval = setInterval(() => {
                rkTimeLeft = Math.max(0, Math.ceil((rkTimerEndAt - Date.now()) / 1000));
                const tEl = document.getElementById('rk_preview_timer');
                const sEl = document.getElementById('rk_preview_status');
                if (tEl) tEl.innerText = rkTimeLeft;
                if (sEl) sEl.innerText = rkTimeLeft;
                if (rkTimeLeft <= 0) {
                    clearInterval(rkTimerInterval);
                    rkTimerInterval = null;
                    rkTimerEndAt = 0;
                }
            }, 250);
        } else if (st.rkTimerRunning && rkTimerEndAt > 0) {
            rkTimeLeft = 0;
            rkTimerEndAt = 0;
        } else {
            rkTimeLeft = (st.rkTimeLeft !== undefined) ? Number(st.rkTimeLeft) : duration;
        }

        rkAnswerStep = st.rkAnswerStep || 'idle';
        rkAnswerCountdownEndAt = Number(st.rkAnswerCountdownEndAt) || 0;
        const ansBtn = document.getElementById('btn_rk_dap_an_ts');
        if (rkAnswerStep === 'counting' && rkAnswerCountdownEndAt > Date.now()) {
            let secLeft = Math.max(1, Math.ceil((rkAnswerCountdownEndAt - Date.now()) / 1000));
            if (ansBtn) {
                ansBtn.innerText = `${secLeft}s`;
                ansBtn.style.background = '#f59e0b';
                ansBtn.style.color = '#ffffff';
                ansBtn.style.borderColor = '#d97706';
            }
            rkAnswerCountdownInterval = setInterval(() => {
                secLeft = Math.max(0, Math.ceil((rkAnswerCountdownEndAt - Date.now()) / 1000));
                if (secLeft > 0) {
                    if (ansBtn) ansBtn.innerText = `${secLeft}s`;
                } else {
                    clearInterval(rkAnswerCountdownInterval);
                    rkAnswerCountdownInterval = null;
                    rkAnswerCountdownEndAt = 0;
                    rkAnswerStep = 'ready';
                    if (ansBtn) {
                        ansBtn.innerText = 'Hiện';
                        ansBtn.style.background = '#059669';
                        ansBtn.style.color = '#ffffff';
                        ansBtn.style.borderColor = '#047857';
                    }
                }
            }, 250);
        } else if (rkAnswerStep === 'ready' || (rkAnswerStep === 'counting' && rkAnswerCountdownEndAt > 0)) {
            rkAnswerStep = 'ready';
            rkAnswerCountdownEndAt = 0;
            if (ansBtn) {
                ansBtn.innerText = 'Hiện';
                ansBtn.style.background = '#059669';
                ansBtn.style.color = '#ffffff';
                ansBtn.style.borderColor = '#047857';
            }
        } else {
            resetRKDapAnButton();
        }

        updateTab2Preview();
    }
};


