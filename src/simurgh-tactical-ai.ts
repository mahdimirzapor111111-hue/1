/**
 * سیمرغ حکمت - مشاور تاکتیکی و هوش مصنوعی با تفکر عمیق (High Thinking)
 * مبتنی بر مدل gemini-3.1-pro-preview و تحلیل استراتژیک چیدمان ارتش ۶×۳ شاهنامه
 */

import { auth, db, doc, setDoc } from './firebase';

interface TacticalAnalysisRequest {
  prompt: string;
  userDeck?: any;
  userProfile?: any;
  opponent?: any;
}

export async function askSimurghAdvisor(request: TacticalAnalysisRequest): Promise<string> {
  try {
    const res = await fetch('/api/ai/tactical-advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const data = await res.json();
    if (data.advice) {
      // Save analysis to Firestore for persistence
      const uid = auth.currentUser?.uid || request.userProfile?.id || 'guest';
      if (uid && db) {
        try {
          await setDoc(doc(db, 'users', uid), {
            lastSimurghAdvice: {
              prompt: request.prompt,
              advice: data.advice,
              model: data.model || 'gemini-3.1-pro-preview (Thinking: HIGH)',
              timestamp: Date.now()
            }
          }, { merge: true });
        } catch (e) {
          console.warn('Firestore advice save note:', e);
        }
      }
      return data.advice;
    }
    throw new Error('No advice returned');
  } catch (err: any) {
    console.error('Simurgh AI Error:', err);
    return `🦅 درود بر پهلوان! سیمرغ خرد گوید:
۱. در چیدمان ارتش ۶×۳، مدافعان استوار (مانند کاوه آهنگر و سیاوش) را همواره در خط نخست (ستون اول) بگمار تا ضربات هولناک حریف را مهار کنند.
۲. دلاوران دوربرد مانند آرش کمانگیر را در صف میانی یا عقبی قرار ده تا با حفظ فاصله، آسیب سنگین پیوسته وارد آورند.
۳. جهان‌پهلوان رستم دستان را در قلب میدان قرار ده تا با هاله قدرت خویش به تمامی یاران روحیه و توان حمله بخشد.
۴. در مواجهه با دیو سپید، هرگز به حمله انفرادی دست نزن؛ با افسون آتش و تیرهای آتشین از فاصله دور او را محاصره کن!`;
  }
}

export function openSimurghTacticalModal() {
  const existing = document.getElementById('simurgh-tactical-modal');
  if (existing) { existing.remove(); return; }

  // Get active user data
  let activeUser: any = null;
  try {
    const actId = localStorage.getItem('nabard_active_user_id_v3');
    const users = JSON.parse(localStorage.getItem('nabard_users_v3') || '[]');
    activeUser = users.find((u: any) => u.id === actId) || users[0];
  } catch (e) {}

  const modal = document.createElement('div');
  modal.id = 'simurgh-tactical-modal';
  modal.className = 'fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md text-stone-100 select-none overflow-y-auto';
  modal.dir = 'rtl';

  modal.innerHTML = `
    <div class="relative w-full max-w-2xl bg-stone-900/98 border-2 border-amber-500/80 rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
      <!-- Header -->
      <div class="flex items-center justify-between pb-3 border-b border-stone-800">
        <button id="close-simurgh-modal" class="w-8 h-8 flex items-center justify-center rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition">✕</button>
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xl shadow-lg shadow-amber-500/20">🦅</div>
          <div>
            <h2 class="font-extrabold text-amber-300 text-base flex items-center gap-2">
              <span>مشاور تاکتیکی سیمرغ</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono">هوش مصنوعی با تفکر عمیق (Gemini Thinking)</span>
            </h2>
            <p class="text-[11px] text-stone-400">راهنمای خردمندانه چیدمان ۶×۳ ارتش، پاتک به دیوان و قهرمانان برتر</p>
          </div>
        </div>
      </div>

      <!-- Quick Analysis Bar -->
      <div class="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <img src="${activeUser?.avatar || '/assets/rostam_hero_1791041080508-hArU2IiH.jpg'}" class="w-10 h-10 rounded-xl object-cover border border-amber-500/50" />
          <div>
            <div class="font-bold text-amber-200">${activeUser?.displayName || 'پهلوان دربار'}</div>
            <div class="text-[10px] text-stone-400">کاپ: ${activeUser?.trophies || 1000} • سطح ${activeUser?.level || 1} • کارت‌های آزاد: ${(activeUser?.unlockedCardIds || []).length}</div>
          </div>
        </div>
        <button id="btn-analyze-my-deck" class="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-stone-950 shadow transition active:scale-95 flex items-center justify-center gap-1.5">
          <span>⚡</span>
          <span>تحلیل فوری چیدمان ارتش من</span>
        </button>
      </div>

      <!-- Preset Strategic Queries -->
      <div>
        <span class="block font-bold text-amber-300 mb-2">پرسش‌های راهبردی آماده:</span>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <button class="simurgh-preset p-2.5 rounded-xl bg-stone-950 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/50 text-right transition flex items-center justify-between" data-q="چگونه بر دیو سپید مازندران و جادوهای او پیروز شوم؟">
            <span>👹 شیوه غلبه بر دیو سپید مازندران</span>
            <span class="text-amber-400">←</span>
          </button>
          <button class="simurgh-preset p-2.5 rounded-xl bg-stone-950 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/50 text-right transition flex items-center justify-between" data-q="بهترین چیدمان خط نخست ۶×۳ برای دفاع در برابر آرش و سهراب چیست؟">
            <span>🛡️ بهترین چیدمان خط نخست ارتش</span>
            <span class="text-amber-400">←</span>
          </button>
          <button class="simurgh-preset p-2.5 rounded-xl bg-stone-950 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/50 text-right transition flex items-center justify-between" data-q="هم‌افزایی رستم دستان و سیمرغ حکمت چگونه حداکثر آسیب را ایجاد می‌کند؟">
            <span>⚔️ هم‌افزایی رستم و سیمرغ</span>
            <span class="text-amber-400">←</span>
          </button>
          <button class="simurgh-preset p-2.5 rounded-xl bg-stone-950 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/50 text-right transition flex items-center justify-between" data-q="چگونه در مسابقات رنکد آنلاین کاپ خود را سریع‌تر افزایش دهیم؟">
            <span>🏆 راهکار فتح رنکد و افزایش کاپ</span>
            <span class="text-amber-400">←</span>
          </button>
        </div>
      </div>

      <!-- Advice Response Box -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between text-stone-400 text-[10px]">
          <span class="font-bold text-amber-200 flex items-center gap-1">
            <span>📜</span> پند و تدبیر سیمرغ خردمند:
          </span>
          <span id="simurgh-status-indicator" class="text-stone-500">آماده پاسخگویی</span>
        </div>
        <div id="simurgh-response-area" class="min-h-[120px] max-h-[220px] overflow-y-auto p-3.5 rounded-2xl bg-stone-950 border border-stone-800 text-stone-200 text-xs leading-relaxed whitespace-pre-line">
          جهان‌آفرین را سپاس!
          من سیمرغ کوه قاف، دانای اسرار دربار شاهنامه هستم.
          چیدمان ارتش خود را بگوی یا سوالی از تاکتیک‌های نبرد بپرس تا با تفکر عمیق و تدبیر اساطیری، راه پیروزی را به تو بنمایانم.
        </div>
      </div>

      <!-- Custom Query Input -->
      <div class="flex gap-2 pt-1">
        <input id="input-simurgh-custom" type="text" placeholder="پرسش استراتژیک شما از سیمرغ خردمند (مثلاً: چطور سهراب را مهار کنم؟)..." class="flex-1 bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-400 text-xs" />
        <button id="btn-send-simurgh-query" class="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 text-stone-950 font-extrabold rounded-xl transition active:scale-95 flex items-center gap-1.5 shadow">
          <span>پرسش</span>
          <span>🦅</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handler
  document.getElementById('close-simurgh-modal')!.onclick = () => modal.remove();

  const responseArea = document.getElementById('simurgh-response-area')!;
  const statusIndicator = document.getElementById('simurgh-status-indicator')!;
  const customInput = document.getElementById('input-simurgh-custom') as HTMLInputElement;

  async function handleQuery(queryText: string) {
    if (!queryText.trim()) return;
    statusIndicator.textContent = '🧠 در حال تفکر عمیق و تحلیل استراتژیک (Thinking: HIGH)...';
    statusIndicator.className = 'text-amber-400 font-bold animate-pulse';
    responseArea.innerHTML = '<div class="flex items-center justify-center py-8 gap-3 text-amber-300"><span class="animate-spin text-xl">⏳</span> سیمرغ در حال بررسی تاکتیک‌های میدان نبرد و تفکر چندلایه...</div>';

    const advice = await askSimurghAdvisor({
      prompt: queryText,
      userProfile: activeUser,
      userDeck: activeUser?.activeDeck
    });

    statusIndicator.textContent = '✓ پاسخ آماده شد';
    statusIndicator.className = 'text-emerald-400 font-bold';
    responseArea.textContent = advice;
    responseArea.scrollTop = 0;
  }

  // Analyze deck click
  document.getElementById('btn-analyze-my-deck')!.onclick = () => {
    handleQuery('چیدمان کنونی ارتش ۶×۳ و ترکیب کارت‌های من را به دقت تحلیل کن. نقاط ضعف، شکاف‌های خط دفاعی و راهکار حمله موثر را بگو.');
  };

  // Preset buttons
  modal.querySelectorAll('.simurgh-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-q') || '';
      handleQuery(q);
    });
  });

  // Custom submit
  document.getElementById('btn-send-simurgh-query')!.onclick = () => {
    const q = customInput.value;
    customInput.value = '';
    handleQuery(q);
  };
  customInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const q = customInput.value;
      customInput.value = '';
      handleQuery(q);
    }
  };
}

export function renderSimurghAdvisorFloatingBadge() {
  if (document.getElementById('simurgh-floating-badge')) return;
  const badge = document.createElement('div');
  badge.id = 'simurgh-floating-badge';
  badge.className = 'fixed bottom-4 right-4 z-[9999] flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-950/90 border border-amber-500/80 shadow-2xl backdrop-blur-md cursor-pointer hover:scale-105 transition-all text-[11px] select-none text-stone-200';
  badge.dir = 'rtl';
  badge.title = 'مشاور تاکتیکی سیمرغ - هوش مصنوعی با تفکر عمیق برای تحلیل ارتش';
  badge.innerHTML = `
    <span class="text-base animate-bounce">🦅</span>
    <span class="font-bold text-amber-300">مشاور تاکتیکی سیمرغ</span>
    <span class="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">AI Thinking</span>
  `;
  badge.onclick = openSimurghTacticalModal;
  document.body.appendChild(badge);
}

// Auto init badge
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSimurghAdvisorFloatingBadge);
  } else {
    renderSimurghAdvisorFloatingBadge();
  }
}
