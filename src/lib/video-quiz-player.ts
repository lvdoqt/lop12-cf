import { renderMathInContainer } from './markdown';
import type { CourseLessonQuiz } from '../types';

type ClientQuiz = Omit<CourseLessonQuiz, 'answer' | 'explanation'>;
type Config = {
  ytId: string | null;
  clientQuizzes: ClientQuiz[];
  lessonId: string;
  isEnrolled: boolean;
  initialVideoPosition: number;
  baseUrl: string;
};
type QuizStats = Record<string, { attempts: number; wrongAttempts: number }>;

function guestId() {
  let id: string | null = null;
  try { id = localStorage.getItem('vq-guest-id'); } catch { /* Storage can be disabled. */ }
  id ||= document.cookie.match(/(?:^|; )vq-guest-id=([^;]+)/)?.[1] || null;
  id ||= `g-${crypto.randomUUID()}`;
  try { localStorage.setItem('vq-guest-id', id); } catch { /* Cookie fallback below. */ }
  document.cookie = `vq-guest-id=${id}; Path=/; Max-Age=31536000; SameSite=Lax`;
  return id;
}

// Preserve original option IDs for server grading; only their display order changes.
function shuffledOptions(quiz: ClientQuiz) {
  const order = quiz.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  try {
    const key = `vq-order-${quiz.id}`;
    if (order.length > 1 && JSON.stringify(order) === sessionStorage.getItem(key)) {
      order.push(order.shift()!);
    }
    sessionStorage.setItem(key, JSON.stringify(order));
  } catch { /* Shuffling still works without browser storage. */ }
  return order;
}

export function initVideoQuizPlayer(config: Config) {
  const wrapper = document.getElementById('video-player-wrapper');
  if (!wrapper) return;
  const overlay = document.getElementById('quiz-overlay')!;
  const card = document.getElementById('quiz-card')!;
  const questionEl = document.getElementById('quiz-question-text')!;
  const optionsEl = document.getElementById('quiz-options')!;
  const feedbackEl = document.getElementById('quiz-feedback')!;
  const feedbackInner = document.getElementById('quiz-feedback-inner')!;
  const continueBtn = document.getElementById('quiz-continue-btn') as HTMLButtonElement;
  const submitBtn = document.getElementById('quiz-submit-btn') as HTMLButtonElement;
  const attemptLabel = document.getElementById('quiz-attempt-label')!;
  const nativeVideo = document.getElementById('native-course-video') as HTMLVideoElement | null;
  const quizzes = config.clientQuizzes;
  const orders = quizzes.map(shuffledOptions);
  const learnerId = guestId();
  const passed = new Set<string>(); // Deliberately reset for every page load/viewing.
  let stats: QuizStats = {};
  let current = -1;
  let opened = false;
  let started = false;
  let submitting = false;
  let shownAt = 0;
  let selected: HTMLButtonElement | null = null;
  let pending: { selectedAnswer: string; clientEventId: string } | null = null;
  let player: any = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  const time = () => Number(player?.getCurrentTime?.() ?? nativeVideo?.currentTime ?? 0);
  const duration = () => Number(player?.getDuration?.() ?? nativeVideo?.duration ?? 0);
  const playing = () => player ? player.getPlayerState?.() === 1 : Boolean(nativeVideo && !nativeVideo.paused && !nativeVideo.ended);
  const pause = () => { if (player) player.pauseVideo(); else nativeVideo?.pause(); };
  const seek = (position: number) => {
    if (player) player.seekTo(position, true);
    else if (nativeVideo && Math.abs(nativeVideo.currentTime - position) > 0.05) nativeVideo.currentTime = position;
  };
  const play = () => { if (player) player.playVideo(); else nativeVideo?.play().catch(() => {}); };
  const buttons = () => [...optionsEl.querySelectorAll<HTMLButtonElement>('button')];
  const setDot = (i: number, state: string) => {
    const dot = document.getElementById(`quiz-dot-${i}`);
    if (dot) dot.dataset.state = state;
  };
  const updateCount = () => {
    const value = stats[quizzes[current]?.id];
    attemptLabel.textContent = value ? `Đã làm ${value.attempts} lần · Sai ${value.wrongAttempts} lần` : '';
  };

  // Statistics never unlock playback or delay timestamp checks.
  if (quizzes.length) {
    const params = new URLSearchParams({ lessonId: config.lessonId, guestId: learnerId });
    fetch(`${config.baseUrl}/api/courses/video-quiz-state?${params}`, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) return;
        const data = await response.json();
        // A slow initial response cannot overwrite counts from a submitted answer.
        stats = { ...(data.stats || {}), ...stats };
        if (opened) updateCount();
      }).catch(() => {});
  }

  function showQuiz(index: number) {
    current = index;
    opened = true;
    selected = null;
    pending = null;
    shownAt = Date.now();
    const quiz = quizzes[index];
    pause();
    seek(quiz.timestamp_sec);
    // Keep DOM overlays available on phones instead of native video fullscreen.
    if (document.fullscreenElement && !document.fullscreenElement.contains(overlay)) {
      document.exitFullscreen?.().catch(() => {});
    }
    (nativeVideo as any)?.webkitExitFullscreen?.();
    questionEl.textContent = quiz.question;
    optionsEl.replaceChildren();
    orders[index].forEach((originalIndex, displayIndex) => {
      const originalLetter = String.fromCharCode(65 + originalIndex);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option-btn';
      button.dataset.answer = originalLetter;
      button.setAttribute('aria-pressed', 'false');
      const badge = document.createElement('span');
      badge.className = 'quiz-option-letter';
      badge.textContent = String.fromCharCode(65 + displayIndex);
      const text = document.createElement('span');
      text.className = 'quiz-option-content';
      text.textContent = quiz.options[originalIndex].replace(new RegExp(`^\\s*${originalLetter}[.)]\\s+`), '');
      button.append(badge, text);
      button.addEventListener('click', () => {
        if (submitting || passed.has(quiz.id)) return;
        for (const option of buttons()) {
          option.removeAttribute('data-state');
          option.setAttribute('aria-pressed', 'false');
        }
        if (selected !== button) pending = null;
        selected = button;
        button.dataset.state = 'selected';
        button.setAttribute('aria-pressed', 'true');
        feedbackEl.classList.add('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kiểm tra đáp án';
      });
      optionsEl.append(button);
    });
    feedbackEl.classList.add('hidden');
    continueBtn.classList.add('hidden');
    submitBtn.classList.remove('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Kiểm tra đáp án';
    updateCount();
    wrapper!.classList.add('quiz-active');
    overlay.classList.remove('hidden');
    renderMathInContainer(card);
    setDot(index, 'active');
    questionEl.focus({ preventScroll: true });
  }

  function check() {
    const position = time();
    if (playing()) started = true;
    if (opened) {
      if (playing()) pause();
      if (Math.abs(position - quizzes[current].timestamp_sec) > 0.5) seek(quizzes[current].timestamp_sec);
      return;
    }
    if (started) {
      // Earliest outstanding timestamp wins, including forward seeks and resume.
      const due = quizzes.findIndex(q => !passed.has(q.id) && position >= q.timestamp_sec);
      if (due >= 0) { showQuiz(due); return; }
    }
    window.dispatchEvent(new CustomEvent('lms-video-tick', { detail: {
      position, duration: duration(), playing: playing(),
    }}));
  }

  function ready() {
    if (config.isEnrolled && config.initialVideoPosition > 3 && config.initialVideoPosition < duration() - 10) {
      seek(config.initialVideoPosition);
    }
    if (!timer) timer = setInterval(check, 100);
  }
  const onPlay = () => { started = true; check(); };
  if (config.ytId) {
    const win = window as any;
    const initialise = () => {
      if (player) return;
      player = new win.YT.Player('yt-player', {
        videoId: config.ytId, width: '100%', height: '100%',
        playerVars: { rel: 0, enablejsapi: 1, playsinline: 1, fs: quizzes.length ? 0 : 1 },
        events: { onReady: ready, onStateChange: (event: { data: number }) => {
          if (event.data === 1) onPlay();
          else check();
        } },
      });
    };
    if (win.YT?.Player) initialise();
    else {
      const previous = win.onYouTubeIframeAPIReady;
      win.onYouTubeIframeAPIReady = () => { previous?.(); initialise(); };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.append(tag);
      }
    }
  } else if (nativeVideo) {
    if (nativeVideo.readyState >= 1) ready();
    else nativeVideo.addEventListener('loadedmetadata', ready, { once: true });
    nativeVideo.addEventListener('play', onPlay);
    for (const event of ['timeupdate', 'seeking', 'seeked', 'ended']) nativeVideo.addEventListener(event, check);
  }

  submitBtn.addEventListener('click', async () => {
    if (!selected || submitting || passed.has(quizzes[current].id)) return;
    submitting = true;
    const clicked = selected;
    pending ||= { selectedAnswer: clicked.dataset.answer!, clientEventId: crypto.randomUUID() };
    for (const button of buttons()) button.disabled = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang kiểm tra…';
    try {
      const response = await fetch(`${config.baseUrl}/api/courses/video-quiz-response`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pending, quizId: quizzes[current].id, lessonId: config.lessonId,
          guestId: learnerId, responseTimeMs: Date.now() - shownAt, videoPositionSeconds: Math.floor(time()) }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.isCorrect !== 'boolean') throw new Error(data.error || 'Không thể lưu câu trả lời. Vui lòng thử lại.');
      pending = null;
      stats[quizzes[current].id] = { attempts: data.attemptNumber, wrongAttempts: data.wrongAttempts };
      updateCount();
      clicked.dataset.state = data.isCorrect ? 'correct' : 'wrong';
      feedbackInner.dataset.state = data.isCorrect ? 'correct' : 'wrong';
      feedbackInner.textContent = data.isCorrect
        ? `Chính xác!${data.explanation ? ` ${data.explanation}` : ''}`
        : 'Chưa đúng. Hãy chọn lại đáp án rồi bấm Kiểm tra đáp án để tiếp tục.';
      feedbackEl.classList.remove('hidden');
      renderMathInContainer(feedbackInner);
      if (data.isCorrect) {
        passed.add(quizzes[current].id);
        setDot(current, 'done');
        submitBtn.classList.add('hidden');
        continueBtn.classList.remove('hidden');
      } else {
        selected = null;
        shownAt = Date.now();
        submitBtn.textContent = 'Kiểm tra đáp án';
      }
    } catch (error) {
      feedbackInner.dataset.state = 'error';
      feedbackInner.textContent = error instanceof Error ? error.message : 'Không thể lưu câu trả lời. Vui lòng thử lại.';
      feedbackEl.classList.remove('hidden');
      submitBtn.textContent = 'Thử gửi lại';
      submitBtn.disabled = false;
      // Keep the event ID when retrying an answer whose response was lost.
    } finally {
      submitting = false;
      if (!passed.has(quizzes[current].id)) for (const button of buttons()) button.disabled = false;
    }
  });

  continueBtn.addEventListener('click', () => {
    if (submitting || !passed.has(quizzes[current]?.id)) return;
    opened = false;
    overlay.classList.add('hidden');
    wrapper.classList.remove('quiz-active');
    // No timestamp jump: another question can be at this exact same second.
    check();
    if (!opened) play();
  });
  window.addEventListener('pagehide', () => { if (timer) clearInterval(timer); });
  window.addEventListener('pageshow', event => { if (event.persisted) { timer = setInterval(check, 100); check(); } });
}
