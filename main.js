/* =============================================
   NOSTAGAMES - MAIN ENGINE v9.0 (Hybrid Hydration + Smart Diff)
   المعمارية الهجينة: Server Snapshot + Firebase Live Sync
   ============================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBjy1mH-Mjikc5aiX_oI2uoGHuI0Y1ZptI",
    authDomain: "n-core-nostagames.firebaseapp.com",
    databaseURL: "https://n-core-nostagames-default-rtdb.firebaseio.com",
    projectId: "n-core-nostagames",
    storageBucket: "n-core-nostagames.firebasestorage.app",
    messagingSenderId: "705596610155",
    appId: "1:705596610155:web:8c076439331d4ff604c32e"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// window.gamesDatabase قد تكون مملوءة بالفعل من build.js (Server Snapshot)
window.gamesDatabase = window.gamesDatabase || [];
window.secretGames = { games: [] };

document.addEventListener("DOMContentLoaded", () => {
    initAppBanner();
    initCounter();

    if (typeof NPCSystem !== 'undefined') NPCSystem.init();
    initScrollReveal();
    initDownloadBtns();
    initFullscreen();
    initShare();
    initSecretCode();
    initBackToTop();
    initGoogleTranslate();
    
    // ── إضافة AdBlock watcher والتفاعل الأول ──
    startAdWatcher();
    initFirstInteractionCheck();

    // ==============================
    // الترطيب الأولي (Initial Hydration)
    // ==============================
    if (window.__serverSnapshot && window.gamesDatabase.length > 0) {
        // البيانات جاهزة من الـ Server Snapshot — عرضها فوراً
        console.log(`[NostGames] ⚡ Hydrating from server snapshot: ${window.gamesDatabase.length} games`);
        renderGames();
        injectSEOSchema();
        initBgIcons();
        initCarousel();
        initSearch();
        initRandomGame();

        // مزامنة صامتة في الخلفية للألعاب الجديدة
        silentSyncWithFirebase();
    } else {
        // لا يوجد snapshot (أول نشر أو بيئة تطوير) — الجلب المباشر
        console.log('[NostGames] No server snapshot found, fetching from Firebase directly...');
        fetchGamesFromFirebase();
    }
});

/* =============================================
   المزامنة الصامتة (Silent Sync + Diff & Merge)
   ============================================= */
async function silentSyncWithFirebase() {
    try {
        const gamesRef = ref(db, 'games');
        const snapshot = await get(gamesRef);

        if (!snapshot.exists()) return;

        const data = snapshot.val();

        // بناء Set من الـ IDs الموجودة مسبقاً في الـ snapshot
        const existingIds = new Set(window.gamesDatabase.map(g => g.id));
        let newGamesCount = 0;

        for (const key in data) {
            const game = data[key];
            if (!game.downloadUrl || game.downloadUrl.trim() === "") continue;

            // تجاهل الألعاب الموجودة بالفعل
            if (existingIds.has(key)) continue;

            // لعبة جديدة لم تكن في الـ snapshot!
            const newGame = {
                id: key,
                title: game.name || "بدون اسم",
                image: game.iconUrl || "images/icon.png",
                src: game.downloadUrl,
                ageRating: game.ageRating || "+3",
                type: game.downloadUrl.toLowerCase().endsWith('.swf') ? 'swf' : 'iframe',
                controls: game.controls || null,
                description: game.description || "",
                description_en: game.description_en || "",
                categories: game.categories || []
            };

            window.gamesDatabase.push(newGame);
            existingIds.add(key);
            newGamesCount++;

            // حقن بطاقة اللعبة الجديدة ديناميكياً في الـ Grid
            injectNewGameCard(newGame);
        }

        if (newGamesCount > 0) {
            console.log(`[NostGames] 🆕 Silent sync: added ${newGamesCount} new game(s) from Firebase`);
            // تحديث محرك البحث بالألعاب الجديدة
            initSearch();
            initRandomGame();
        } else {
            console.log('[NostGames] ✅ Silent sync complete: no new games');
        }

    } catch (error) {
        // فشل الـ sync الصامت لا يؤثر على الموقع
        console.warn('[NostGames] Silent sync failed (non-critical):', error.message);
    }
}

/* =============================================
   الحقن الديناميكي للعبة الجديدة
   ============================================= */
function injectNewGameCard(game) {
    const grid = document.getElementById('games-grid');
    if (!grid) return;

    // التأكد من عدم وجود البطاقة بالفعل (guard)
    if (grid.querySelector(`[data-id="${game.id}"]`)) return;

    const card = buildGameCard(game);
    grid.appendChild(card);
    setTimeout(() => { if (card.parentNode) card.classList.add('visible'); }, 100);
}

/* =============================================
   الجلب المباشر من Firebase (Fallback بدون Snapshot)
   ============================================= */
async function fetchGamesFromFirebase() {
    const grid = document.getElementById('games-grid');
    if (grid) grid.innerHTML = '<div class="pixel-loading-text" style="text-align:center;width:100%;padding:20px;color:#f1c40f;">جاري تحميل الألعاب...</div>';

    try {
        const gamesRef = ref(db, 'games');
        const snapshot = await get(gamesRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            window.gamesDatabase = [];

            for (const key in data) {
                const game = data[key];
                if (!game.downloadUrl || game.downloadUrl.trim() === "") continue;

                window.gamesDatabase.push({
                    id: key,
                    title: game.name || "بدون اسم",
                    image: game.iconUrl || "images/icon.png",
                    src: game.downloadUrl,
                    ageRating: game.ageRating || "+3",
                    type: game.downloadUrl.toLowerCase().endsWith('.swf') ? 'swf' : 'iframe',
                    controls: game.controls || null,
                    description: game.description || "",
                    description_en: game.description_en || "",
                    categories: game.categories || []
                });
            }

            renderGames();
            injectSEOSchema();
            initBgIcons();
            initCarousel();
            initSearch();
            initRandomGame();
        } else {
            if (grid) grid.innerHTML = '<div class="no-results">🎮 لا توجد ألعاب متاحة حالياً</div>';
        }
    } catch (error) {
        console.error("خطأ في جلب البيانات من Firebase:", error);
        if (grid) grid.innerHTML = '<div class="no-results">⚠️ حدث خطأ في الاتصال. يرجى إعادة المحاولة.</div>';
    }
}

/* =============================================
   بناء بطاقة لعبة واحدة (مشترك بين render و inject)
   ============================================= */
function buildGameCard(game, idx = 0) {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.dataset.id = game.id;

    const img = document.createElement('img');
    img.src = game.image;
    img.alt = game.title;
    img.loading = 'lazy';
    img.onerror = () => card.remove();

    const ageBadge = document.createElement('div');
    ageBadge.className = `age-badge age-${(game.ageRating || '+3').replace('+', '')}`;
    ageBadge.textContent = game.ageRating;

    const titleSpan = document.createElement('div');
    titleSpan.className = 'game-title';
    titleSpan.textContent = game.title;

    card.appendChild(img);
    card.appendChild(ageBadge);
    card.appendChild(titleSpan);
    card.addEventListener('click', () => showGamePanel(game));
    setTimeout(() => { if (card.parentNode) card.classList.add('visible'); }, idx * 55);

    return card;
}

/* =============================================
   عرض الألعاب في الـ Grid
   ============================================= */
function renderGames(filterText = '') {
    const grid = document.getElementById('games-grid');
    if (!grid) return;
    grid.innerHTML = '';

    let filtered = [...window.gamesDatabase];
    if (filterText.trim() !== '') {
        const lower = filterText.toLowerCase();
        filtered = window.gamesDatabase.filter(game =>
            game.title.toLowerCase().includes(lower) ||
            (game.description || '').toLowerCase().includes(lower)
        );
    }

    filtered.forEach((game, idx) => {
        grid.appendChild(buildGameCard(game, idx));
    });
}

/* =============================================
   POPUP MODAL — وسط الشاشة مع Blur
   ============================================= */
function showGamePanel(game) {
    document.getElementById('game-panel')?.remove();

    const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
    const desc = lang === 'ar'
        ? (game.description || game.description_en || '')
        : (game.description_en || game.description || '');

    const ageColors = {
        '+3': '#2ecc71', '+7': '#3498db',
        '+12': '#f39c12', '+16': '#e67e22', '+18': '#e74c3c'
    };
    const ageColor = ageColors[game.ageRating] || '#2ecc71';
    const cats = (game.categories || []).map(c => `<span class="panel-cat">${c}</span>`).join('');

    const panel = document.createElement('div');
    panel.id = 'game-panel';
    panel.className = 'game-panel-backdrop';
    panel.innerHTML = `
        <div class="game-panel-modal" role="dialog" aria-modal="true">
            <button class="panel-close-btn" id="panel-close-btn" aria-label="إغلاق">✕</button>
            <div class="panel-hero">
                <img src="${game.image}" alt="${game.title}" class="panel-icon" onerror="this.src='images/icon.png'">
                <div class="panel-hero-glow" style="background:radial-gradient(circle, ${ageColor}33 0%, transparent 70%);"></div>
            </div>
            <div class="panel-body">
                <h3 class="panel-title">${game.title}</h3>
                <div class="panel-meta">
                    <span class="panel-age-badge" style="background:${ageColor}22;color:${ageColor};border-color:${ageColor}66;">
                        🔞 ${game.ageRating}
                    </span>
                    ${cats ? `<div class="panel-cats">${cats}</div>` : ''}
                </div>
                <p class="panel-desc">${desc || '<span class="panel-no-desc">لا يوجد وصف متاح لهذه اللعبة.</span>'}</p>
            </div>
            <button class="panel-play-btn" id="panel-play-btn">
                <i class="fa-solid fa-play"></i> ابدأ اللعبة
            </button>
        </div>
    `;

    document.body.appendChild(panel);

    function closePanel() {
        panel.classList.add('panel-closing');
        setTimeout(() => panel.remove(), 250);
    }

    const onKey = (e) => { if (e.key === 'Escape') { closePanel(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    panel.addEventListener('click', e => { if (e.target === panel) { closePanel(); document.removeEventListener('keydown', onKey); } });
    document.getElementById('panel-close-btn').onclick = closePanel;
    document.getElementById('panel-play-btn').onclick = () => {
        // ← التحقق من AdBlock فقط عند الضغط على ابدأ اللعبة
        showAdBlockWall(() => {
            closePanel();
            setTimeout(() => openGame(game), 260);
        });
    };

    requestAnimationFrame(() => panel.classList.add('panel-visible'));
}

/* =============================================
   ADBLOCK — يعمل فقط عند الضغط على أزرار حساسة
   عناكب جوجل تتصفح بحرية كاملة ✅
   ============================================= */

// ── كائن الترجمات (20 لغة) ──
const AB_LANGS = {
    ar: { title: "⚠️ تم اكتشاف مانع الإعلانات", body: "الإعلانات هي المصدر الوحيد لاستمرار الموقع مجاناً. يرجى تعطيل مانع الإعلانات للمتابعة.", note: "* الموقع مجاني 100%، الإعلانات فقط لدعم التطوير", btn: "✅ عطّلته، متابعة", steps: ["1. افتح إضافة AdBlock", "2. اختر 'تعطيل في هذا الموقع'", "3. اضغط زر المتابعة"] },
    en: { title: "⚠️ AdBlock Detected", body: "Ads are the only way to keep this site free. Please disable your ad blocker to continue.", note: "* This site is 100% free, ads only support development", btn: "✅ Disabled, Continue", steps: ["1. Open AdBlock extension", "2. Choose 'Disable on this site'", "3. Click continue button"] },
    fr: { title: "⚠️ Bloqueur de pub détecté", body: "Les publicités sont le seul moyen de maintenir ce site gratuit. Veuillez désactiver votre bloqueur.", note: "* Site 100% gratuit, pubs pour le développement", btn: "✅ Désactivé, Continuer", steps: ["1. Ouvrez AdBlock", "2. 'Désactiver sur ce site'", "3. Cliquez Continuer"] },
    es: { title: "⚠️ Bloqueador de anuncios detectado", body: "Los anuncios son la única forma de mantener este sitio gratis. Desactiva tu bloqueador.", note: "* Sitio 100% gratis, anuncios solo para desarrollo", btn: "✅ Desactivado, Continuar", steps: ["1. Abre AdBlock", "2. 'Desactivar en este sitio'", "3. Haz clic en Continuar"] },
    de: { title: "⚠️ AdBlock erkannt", body: "Werbung ist der einzige Weg, diese Seite kostenlos zu halten. Bitte deaktiviere deinen AdBlocker.", note: "* Seite 100% kostenlos, Werbung nur für Entwicklung", btn: "✅ Deaktiviert, Weiter", steps: ["1. Öffne AdBlock", "2. 'Auf dieser Seite deaktivieren'", "3. Klicke auf Weiter"] },
    it: { title: "⚠️ Blocco annunci rilevato", body: "Gli annunci sono l'unico modo per mantenere gratuito questo sito. Disabilita il blocco annunci.", note: "* Sito 100% gratuito, annunci solo per sviluppo", btn: "✅ Disabilitato, Continua", steps: ["1. Apri AdBlock", "2. 'Disabilita su questo sito'", "3. Clicca Continua"] },
    pt: { title: "⚠️ Bloqueador de anúncios detectado", body: "Os anúncios são a única forma de manter este site gratuito. Desative seu bloqueador.", note: "* Site 100% gratuito, anúncios apenas para desenvolvimento", btn: "✅ Desativado, Continuar", steps: ["1. Abra o AdBlock", "2. 'Desativar neste site'", "3. Clique em Continuar"] },
    ru: { title: "⚠️ Обнаружен блокировщик рекламы", body: "Реклама — единственный способ поддерживать сайт бесплатным. Отключите блокировщик.", note: "* Сайт полностью бесплатен, реклама только для развития", btn: "✅ Отключено, Продолжить", steps: ["1. Откройте AdBlock", "2. 'Отключить на этом сайте'", "3. Нажмите Продолжить"] },
    zh: { title: "⚠️ 检测到广告拦截器", body: "广告是保持本网站免费的唯一方式。请禁用您的广告拦截器。", note: "* 本网站100%免费，广告仅用于支持开发", btn: "✅ 已禁用，继续", steps: ["1. 打开AdBlock扩展", "2. 选择'在此网站上禁用'", "3. 点击继续按钮"] },
    ja: { title: "⚠️ 広告ブロッカーを検出しました", body: "広告はこのサイトを無料で維持する唯一の方法です。広告ブロッカーを無効にしてください。", note: "* このサイトは100%無料です。広告は開発支援のためです", btn: "✅ 無効にしました、続行", steps: ["1. AdBlockを開く", "2. 'このサイトで無効にする'を選択", "3. 続行ボタンをクリック"] },
    ko: { title: "⚠️ 광고 차단기 감지됨", body: "광고는 이 사이트를 무료로 유지하는 유일한 방법입니다. 광고 차단기를 비활성화하세요.", note: "* 이 사이트는 100% 무료입니다. 광고는 개발 지원용입니다", btn: "✅ 비활성화됨, 계속", steps: ["1. AdBlock 열기", "2. '이 사이트에서 비활성화' 선택", "3. 계속 버튼 클릭"] },
    hi: { title: "⚠️ विज्ञापन अवरोधक का पता चला", body: "विज्ञापन इस साइट को मुफ्त रखने का एकमात्र तरीका है। कृपया अपना अवरोधक अक्षम करें।", note: "* साइट 100% मुफ्त है, विज्ञापन केवल विकास के लिए", btn: "✅ अक्षम किया, जारी रखें", steps: ["1. AdBlock खोलें", "2. 'इस साइट पर अक्षम करें' चुनें", "3. जारी रखें बटन दबाएं"] },
    tr: { title: "⚠️ Reklam Engelleyici Algılandı", body: "Reklamlar, bu sitenin ücretsiz kalmasının tek yoludur. Lütfen reklam engelleyicinizi devre dışı bırakın.", note: "* Site %100 ücretsizdir, reklamlar sadece geliştirme içindir", btn: "✅ Devre Dışı, Devam Et", steps: ["1. AdBlock'u açın", "2. 'Bu sitede devre dışı bırak' seçin", "3. Devam Et düğmesine tıklayın"] },
    nl: { title: "⚠️ AdBlock gedetecteerd", body: "Advertenties zijn de enige manier om deze site gratis te houden. Schakel uw adblocker uit.", note: "* Site 100% gratis, advertenties alleen voor ontwikkeling", btn: "✅ Uitgeschakeld, Doorgaan", steps: ["1. Open AdBlock", "2. Kies 'Uitschakelen op deze site'", "3. Klik op Doorgaan"] },
    sv: { title: "⚠️ AdBlock upptäckt", body: "Annonser är det enda sättet att hålla denna sida gratis. Vänligen inaktivera din annonsblockerare.", note: "* Webbplatsen är 100% gratis, annonser endast för utveckling", btn: "✅ Inaktiverad, Fortsätt", steps: ["1. Öppna AdBlock", "2. Välj 'Inaktivera på denna webbplats'", "3. Klicka på Fortsätt"] },
    pl: { title: "⚠️ Wykryto blokowanie reklam", body: "Reklamy są jedynym sposobem na utrzymanie tej strony za darmo. Wyłącz blokowanie reklam.", note: "* Strona jest w 100% darmowa, reklamy tylko dla rozwoju", btn: "✅ Wyłączono, Kontynuuj", steps: ["1. Otwórz AdBlock", "2. Wybierz 'Wyłącz na tej stronie'", "3. Kliknij Kontynuuj"] },
    uk: { title: "⚠️ Виявлено блокувальник реклами", body: "Реклама — єдиний спосіб підтримувати сайт безкоштовним. Вимкніть блокувальник.", note: "* Сайт 100% безкоштовний, реклама тільки для розвитку", btn: "✅ Вимкнено, Продовжити", steps: ["1. Відкрийте AdBlock", "2. 'Вимкнути на цьому сайті'", "3. Натисніть Продовжити"] },
    vi: { title: "⚠️ Phát hiện chặn quảng cáo", body: "Quảng cáo là cách duy nhất để giữ trang web này miễn phí. Vui lòng tắt trình chặn quảng cáo.", note: "* Trang web 100% miễn phí, quảng cáo chỉ hỗ trợ phát triển", btn: "✅ Đã tắt, Tiếp tục", steps: ["1. Mở AdBlock", "2. Chọn 'Tắt trên trang này'", "3. Nhấn nút Tiếp tục"] },
    th: { title: "⚠️ ตรวจพบโปรแกรมบล็อกโฆษณา", body: "โฆษณาเป็นวิธีเดียวที่จะทำให้เว็บไซต์นี้ฟรี กรุณาปิดโปรแกรมบล็อกโฆษณา", note: "* เว็บไซต์ฟรี 100% โฆษณาเพื่อสนับสนุนการพัฒนา", btn: "✅ ปิดแล้ว, ดำเนินการต่อ", steps: ["1. เปิด AdBlock", "2. เลือก 'ปิดใช้งานบนเว็บไซต์นี้'", "3. คลิกปุ่มดำเนินการต่อ"] }
};

let _adWatcherInterval = null;

function stopAdWatcher() {
    if (_adWatcherInterval) {
        clearInterval(_adWatcherInterval);
        _adWatcherInterval = null;
    }
}

function startAdWatcher() {
    stopAdWatcher();
    _adWatcherInterval = setInterval(async () => {
        const isBot = /googlebot|bingbot|yandex|duckduckbot|slurp|baiduspider/i.test(navigator.userAgent);
        if (isBot) return;
        if (await checkAdBlock()) { 
            stopAdWatcher(); 
            showAdWallUI(); 
        }
    }, 20000); // كل 20 ثانية
}

// ── تحديد لغة المستخدم ──
function detectLang() {
    const lang = (navigator.language || 'en').split('-')[0].toLowerCase();
    return AB_LANGS[lang] ? lang : 'en';
}

// ── تحديث نصوص الجدار حسب اللغة ──
function localizeAdWall() {
    const t    = AB_LANGS[detectLang()];
    const wall = document.getElementById('adblock-wall');
    if (!wall || !t) return;
    const titleEl = wall.querySelector('h2');
    const bodyEl  = wall.querySelector('p');
    const noteEl  = wall.querySelector('.adblock-note');
    const btnEl   = document.getElementById('adblock-continue-btn');
    const steps   = wall.querySelectorAll('.step');
    if (titleEl) titleEl.textContent = t.title;
    if (bodyEl)  bodyEl.textContent  = t.body;
    if (noteEl)  noteEl.textContent  = t.note;
    if (btnEl)   btnEl.textContent   = t.btn;
    steps.forEach((s, i) => {
        if (!t.steps[i]) return;
        const num = s.querySelector('span');
        s.textContent = t.steps[i];
        if (num) s.prepend(num);
    });
    const rtl = ['ar','fa','ur'];
    wall.style.direction = rtl.includes(detectLang()) ? 'rtl' : 'ltr';
}

// ── عرض جدار AdBlock ──
function showAdWallUI() {
    localizeAdWall();
    const wall = document.getElementById('adblock-wall');
    if (!wall) return;
    wall.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const player = document.getElementById('game-player');
    if (player && !player.classList.contains('hidden')) {
        document.getElementById('close-btn')?.click();
    }
    const oldBtn = document.getElementById('adblock-continue-btn');
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    newBtn.addEventListener('click', () => location.reload());
}

// ── الكشف عند أول تفاعل فقط ──
function initFirstInteractionCheck() {
    const isBot = /googlebot|bingbot|yandex|duckduckbot|slurp|baiduspider/i.test(navigator.userAgent);
    if (isBot) return;
    const onInteract = async () => {
        ['scroll','click','touchstart','keydown'].forEach(ev =>
            document.removeEventListener(ev, onInteract, { passive: true })
        );
        if (await checkAdBlock()) { stopAdWatcher(); showAdWallUI(); }
    };
    ['scroll','click','touchstart','keydown'].forEach(ev =>
        document.addEventListener(ev, onInteract, { passive: true })
    );
}

async function checkAdBlock() {
    // طريقة 1: فحص عناصر الـ bait في DOM
    const bait1 = document.getElementById('ab-bait1');
    const bait2 = document.getElementById('ab-bait2');
    const domBlocked =
        !bait1 || !bait2 ||
        bait1.offsetHeight === 0 ||
        bait1.offsetWidth  === 0 ||
        getComputedStyle(bait1).display    === 'none' ||
        getComputedStyle(bait1).visibility === 'hidden' ||
        getComputedStyle(bait2).display    === 'none';

    if (domBlocked) return true;

    // طريقة 2: محاولة جلب ملف إعلاني معروف
    try {
        await fetch(
            'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
            { method: 'HEAD', mode: 'no-cors', cache: 'no-store' }
        );
        return false; // نجح الطلب — لا يوجد مانع
    } catch (e) {
        return true;  // فشل الطلب — يوجد مانع
    }
}

async function showAdBlockWall(onPass) {
    // بوتات محركات البحث — تمرّ مباشرة
    const isBot = /googlebot|bingbot|yandex|duckduckbot|slurp|baiduspider|facebot|ia_archiver/i.test(navigator.userAgent);
    if (isBot) { onPass(); return; }

    // فحص جديد في كل مرة بدون cache
    const blocked = await checkAdBlock();
    if (!blocked) { onPass(); return; }

    // يوجد مانع — أظهر الجدار
    showAdWallUI();
    // لا نستدعي onPass() لأننا منعنا الوصول
}

function initDownloadBtns() {
    const APK_URL = 'https://archive.org/download/n-core-nostagames-debug_20260523/N-CORE-NOSTAGAMES-debug.apk';
    ['download-btn', 'android-download-btn', 'banner-download-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // ← التحقق من AdBlock فقط عند الضغط على التحميل
            showAdBlockWall(() => {
                if (typeof NPCSystem !== 'undefined') NPCSystem.onDownloadClick();
                window.location.href = APK_URL;
            });
        });
    });
}

function initAppBanner() {
    const banner = document.getElementById('app-banner');
    const closeBtn = document.getElementById('banner-close');
    if (!banner) return;
    if (sessionStorage.getItem('banner_closed')) { banner.classList.add('hidden'); return; }
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            banner.classList.add('hidden');
            sessionStorage.setItem('banner_closed', '1');
        });
    }
}

function initCounter() {
    const el = document.getElementById('counter-num');
    if (!el) return;
    const base = 50000;
    let stored = parseInt(localStorage.getItem('ng_count') || base);
    stored += Math.floor(Math.random() * 7) + 1;
    localStorage.setItem('ng_count', stored);
    el.textContent = stored.toLocaleString('ar-EG');
}

function initSearch() {
    const searchInput = document.getElementById('search-games');
    if (!searchInput) return;
    // إزالة المستمع القديم قبل إضافة جديد
    const newInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newInput, searchInput);
    let timeout;
    newInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => renderGames(e.target.value), 300);
    });
}

function initRandomGame() {
    const btn = document.getElementById('random-game-btn');
    if (!btn) return;
    // إزالة المستمع القديم
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
        if (window.gamesDatabase.length === 0) return;
        openGame(window.gamesDatabase[Math.floor(Math.random() * window.gamesDatabase.length)]);
    });
}

function initShare() {
    const btn = document.getElementById('share-game-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        if (navigator.share) {
            navigator.share({ title: 'NostGames', text: 'العب ألعاب Flash مجاناً!', url: window.location.href }).catch(() => {});
        }
    });
}

function initSecretCode() {
    let konamiIndex = 0;
    const konamiCode = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    window.addEventListener('keydown', (e) => {
        const key = (e.key === 'b' || e.key === 'a') ? e.key.toLowerCase() : e.key;
        if (key === konamiCode[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === konamiCode.length) { unlockSecretGames(); konamiIndex = 0; }
        } else { konamiIndex = 0; }
    });
    const logo = document.querySelector('.hero-logo');
    if (logo) {
        let tapCount = 0, tapTimer;
        logo.addEventListener('click', () => {
            if (window.innerWidth > 768) return;
            tapCount++;
            clearTimeout(tapTimer);
            tapTimer = setTimeout(() => { tapCount = 0; }, 1000);
            if (tapCount === 5) {
                const pass = prompt('🔐 أدخل كلمة السر:');
                if (pass === 'nostagames') unlockSecretGames();
                tapCount = 0;
            }
        });
    }
}

function unlockSecretGames() {
    if (window.secretGames?.games?.length > 0) {
        const newGames = window.secretGames.games.filter(g => !window.gamesDatabase.some(ex => ex.id === g.id));
        if (newGames.length) {
            window.gamesDatabase.push(...newGames);
            renderGames();
            alert('🎉 تم فتح الألعاب السرية!');
        } else {
            alert('✨ كود صحيح! لا توجد ألعاب سرية جديدة حالياً.');
        }
    } else {
        alert('🔓 كود صحيح! ألعاب سرية قريباً.');
    }
}

function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', () => { btn.style.display = window.scrollY > 500 ? 'flex' : 'none'; });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function initGoogleTranslate() {
    // إشعار تغيير اللغة
    const userLang = (navigator.language || 'ar').split('-')[0].toLowerCase();
    const langNames = {
        en:'🇺🇸 English', fr:'🇫🇷 Français', es:'🇪🇸 Español',
        de:'🇩🇪 Deutsch', tr:'🇹🇷 Türkçe', id:'🇮🇩 Indonesia',
        pt:'🇧🇷 Português', ru:'🇷🇺 Русский', zh:'🇨🇳 中文',
        ja:'🇯🇵 日本語', ko:'🇰🇷 한국어', hi:'🇮🇳 हिन्दी',
        fa:'🇮🇷 فارسی', ur:'🇵🇰 اردو', ms:'🇲🇾 Melayu',
        it:'🇮🇹 Italiano', nl:'🇳🇱 Nederlands', th:'🇹🇭 ไทย',
        vi:'🇻🇳 Tiếng Việt'
    };

    // لا نعرض الإشعار إذا كانت اللغة العربية
    if (userLang === 'ar') return;

    const langName = langNames[userLang];
    if (!langName) return;

    // إشعار بتصميم بيكسلي
    const toast = document.createElement('div');
    toast.id = 'lang-toast';
    toast.textContent = `🌐 تم تغيير اللغة إلى ${langName}`;
    toast.style.cssText = `
        position: fixed;
        top: 70px;
        left: 50%;
        transform: translateX(-50%);
        background: #000;
        color: #0f0;
        font-family: 'Press Start 2P', monospace;
        font-size: 11px;
        padding: 10px 20px;
        border: 2px solid #0f0;
        box-shadow: 0 0 10px rgba(0,255,0,0.3);
        z-index: 99998;
        white-space: nowrap;
        opacity: 1;
        transition: opacity 0.5s ease;
        pointer-events: none;
        text-align: center;
    `;
    document.body.appendChild(toast);

    // إخفاء الإشعار بعد 4 ثوانٍ
    setTimeout(() => { toast.style.opacity = '0'; }, 4000);
    setTimeout(() => { toast.remove(); }, 4500);

    // إزالة كود الإخفاء القسري لشريط الترجمة من هنا حتى يتمكن الزائر من استخدامه
}

function showPixelLoadingBar(onComplete) {
    const barContainer = document.createElement('div');
    barContainer.className = 'pixel-loading-overlay';
    barContainer.innerHTML = `
        <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;background:rgba(0,0,0,0.85);padding:24px;border:2px solid #0f0;border-radius:4px;text-align:center;">
            <div style="color:#0f0;font-family:'Press Start 2P',monospace;font-size:12px;margin-bottom:12px;">LOADING...</div>
            <div style="width:200px;height:18px;border:2px solid #0f0;background:#000;"><div class="fill" style="width:0%;height:100%;background:#0f0;transition:width 0.05s;"></div></div>
        </div>
    `;
    document.body.appendChild(barContainer);
    let width = 0;
    const interval = setInterval(() => {
        width += Math.random() * 30 + 10;
        if (width >= 100) {
            clearInterval(interval);
            setTimeout(() => { barContainer.remove(); if (onComplete) onComplete(); }, 200);
        }
        const fill = barContainer.querySelector('.fill');
        if (fill) fill.style.width = Math.min(width, 100) + '%';
    }, 50);
}

/* =============================================
   KEYBOARD EVENT SIMULATOR
   ============================================= */
const KEY_DICT = {
    'A':{code:65,key:'a',codeStr:'KeyA'},'B':{code:66,key:'b',codeStr:'KeyB'},
    'C':{code:67,key:'c',codeStr:'KeyC'},'D':{code:68,key:'d',codeStr:'KeyD'},
    'E':{code:69,key:'e',codeStr:'KeyE'},'F':{code:70,key:'f',codeStr:'KeyF'},
    'G':{code:71,key:'g',codeStr:'KeyG'},'H':{code:72,key:'h',codeStr:'KeyH'},
    'I':{code:73,key:'i',codeStr:'KeyI'},'J':{code:74,key:'j',codeStr:'KeyJ'},
    'K':{code:75,key:'k',codeStr:'KeyK'},'L':{code:76,key:'l',codeStr:'KeyL'},
    'M':{code:77,key:'m',codeStr:'KeyM'},'N':{code:78,key:'n',codeStr:'KeyN'},
    'O':{code:79,key:'o',codeStr:'KeyO'},'P':{code:80,key:'p',codeStr:'KeyP'},
    'Q':{code:81,key:'q',codeStr:'KeyQ'},'R':{code:82,key:'r',codeStr:'KeyR'},
    'S':{code:83,key:'s',codeStr:'KeyS'},'T':{code:84,key:'t',codeStr:'KeyT'},
    'U':{code:85,key:'u',codeStr:'KeyU'},'V':{code:86,key:'v',codeStr:'KeyV'},
    'W':{code:87,key:'w',codeStr:'KeyW'},'X':{code:88,key:'x',codeStr:'KeyX'},
    'Y':{code:89,key:'y',codeStr:'KeyY'},'Z':{code:90,key:'z',codeStr:'KeyZ'},
    'SPACE':{code:32,key:' ',codeStr:'Space'},
    'UP':{code:38,key:'ArrowUp',codeStr:'ArrowUp'},
    'DOWN':{code:40,key:'ArrowDown',codeStr:'ArrowDown'},
    'LEFT':{code:37,key:'ArrowLeft',codeStr:'ArrowLeft'},
    'RIGHT':{code:39,key:'ArrowRight',codeStr:'ArrowRight'}
};

function triggerRuffleKeyEvent(type, keyName) {
    const keyData = KEY_DICT[keyName.toUpperCase()];
    if (!keyData) return;
    const event = new KeyboardEvent(type, {
        bubbles:true,cancelable:true,
        keyCode:keyData.code,which:keyData.code,
        key:keyData.key,code:keyData.codeStr
    });
    window.dispatchEvent(event);
    const rufflePlayer = document.querySelector('ruffle-player');
    if (rufflePlayer) rufflePlayer.dispatchEvent(event);
}

/* =============================================
   SMART CONTROLS v2 — يقرأ المفاتيح من Firebase فقط
   Joystick ثابت يسار — أزرار أكشن مصطفة يمين
   ============================================= */
let currentEditTarget = null;
let controlsEditMode  = false;

// الترتيب الافتراضي الذكي للأزرار (يمين — مصطفة عموديًا)
const DEFAULT_BTN_SIZE = 62;
const DEFAULT_JOY_SIZE = 130;

function calcDefaultLayout(actionKeys) {
    const layout = {};
    // Joystick: يسار وسط-أسفل
    layout['JOYSTICK'] = { x: 3, y: 55, size: DEFAULT_JOY_SIZE };

    // أزرار الأكشن: عمود يمين مرتب
    const total  = actionKeys.length;
    const startY = total <= 2 ? 55 : 40;
    const step   = total <= 4 ? 16 : 12;
    actionKeys.forEach((key, i) => {
        layout[key] = {
            x:    total <= 2 ? 82 : (i % 2 === 0 ? 78 : 88),
            y:    startY + i * step,
            size: DEFAULT_BTN_SIZE
        };
    });
    return layout;
}

function renderSmartControls(gameId, controlsData, container) {
    if (!controlsData) return;

    // p1 قد يكون مصفوفة (من build.js الجديد) أو كائن (من Firebase مباشرة)
    let p1Keys = [];
    if (Array.isArray(controlsData.p1)) {
        p1Keys = controlsData.p1;                                      // ['JOYSTICK','A','S']
    } else if (controlsData.p1 && typeof controlsData.p1 === 'object') {
        p1Keys = Object.keys(controlsData.p1);                         // من Firebase القديم
    }

    const useWasd    = controlsData.wasd === true;
    const hasJoystick = p1Keys.includes('JOYSTICK') || useWasd;
    const actionKeys  = p1Keys.filter(k => k !== 'JOYSTICK');

    if (!hasJoystick && actionKeys.length === 0) return;

    /* ── wrapper الرئيسي ── */
    const wrapper = document.createElement('div');
    wrapper.id = 'smart-controls-wrapper';
    wrapper.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:9999;direction:ltr;overflow:hidden;';

    /* ── شريط الأدوات ── */
    const toolbar = document.createElement('div');
    toolbar.id    = 'controls-toolbar';
    toolbar.style.cssText = [
        'position:absolute;top:8px;left:50%;transform:translateX(-50%);',
        'display:flex;gap:8px;pointer-events:auto;z-index:10000;',
        'background:rgba(0,0,0,0.65);padding:5px 14px;border-radius:24px;',
        'border:1px solid rgba(255,255,255,0.15);backdrop-filter:blur(6px);'
    ].join('');

    const mkTbBtn = (icon, title) => {
        const b = document.createElement('button');
        b.innerHTML = icon;
        b.title = title;
        b.style.cssText = 'background:transparent;color:#ddd;border:none;font-size:20px;cursor:pointer;padding:4px 6px;border-radius:8px;transition:color .2s,background .2s;line-height:1;';
        b.onmouseenter = () => b.style.background = 'rgba(255,255,255,0.12)';
        b.onmouseleave = () => b.style.background = 'transparent';
        return b;
    };

    const flipBtn    = mkTbBtn('🔄', 'قلب الجانبين');
    const editBtn    = mkTbBtn('✏️', 'تحريك الأزرار');
    const plusBtn    = mkTbBtn('🔍+', 'تكبير');
    const minusBtn   = mkTbBtn('🔍-', 'تصغير');
    const saveBtn    = mkTbBtn('💾', 'حفظ');
    const resetBtn   = mkTbBtn('↩️', 'إعادة الضبط');

    // نخفي أزرار التعديل حتى وضع التحرير
    [plusBtn, minusBtn, saveBtn, resetBtn].forEach(b => b.style.display = 'none');
    [flipBtn, editBtn, plusBtn, minusBtn, saveBtn, resetBtn].forEach(b => toolbar.appendChild(b));
    wrapper.appendChild(toolbar);

    /* ── حاوية العناصر ── */
    const elContainer = document.createElement('div');
    elContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    wrapper.appendChild(elContainer);
    container.appendChild(wrapper);

    /* ── تحميل الـ layout (من localStorage أو الحساب الافتراضي) ── */
    let layout = {};
    try { layout = JSON.parse(localStorage.getItem('nosta_ctrls_' + gameId)) || {}; } catch(e) {}
    if (!Object.keys(layout).length) {
        layout = calcDefaultLayout(actionKeys);
    }

    /* ── إنشاء عناصر التحكم ── */
    const ctrlEls = [];

    if (hasJoystick) {
        const jd  = layout['JOYSTICK'] || { x:3, y:55, size: DEFAULT_JOY_SIZE };
        const joy = buildAnalogStick(useWasd);
        placeEl(joy, jd.x, jd.y, jd.size);
        joy.dataset.ctrlId = 'JOYSTICK';
        elContainer.appendChild(joy);
        ctrlEls.push(joy);
    }

    actionKeys.forEach(key => {
        const bd  = layout[key] || { x:80, y:60, size: DEFAULT_BTN_SIZE };
        const btn = buildActionBtn(key);
        placeEl(btn, bd.x, bd.y, bd.size);
        btn.dataset.ctrlId = key;
        elContainer.appendChild(btn);
        ctrlEls.push(btn);
    });

    /* ── قلب الجانبين ── */
    flipBtn.onclick = () => {
        ctrlEls.forEach(el => {
            const lp  = parseFloat(el.style.left);       // نسبة مئوية
            const sw  = parseFloat(el.style.width);
            const swP = sw / window.innerWidth * 100;
            el.style.left = Math.max(0, 100 - lp - swP) + '%';
        });
    };

    /* ── وضع التحرير ── */
    editBtn.onclick = () => {
        controlsEditMode = true;
        editBtn.style.color = '#f1c40f';
        [plusBtn, minusBtn, saveBtn, resetBtn].forEach(b => b.style.display = '');
        wrapper.style.background = 'rgba(0,0,0,0.35)';
        ctrlEls.forEach(el => {
            el.classList.add('ctrl-edit-mode');
            el.style.outline = '2px dashed rgba(0,255,0,0.7)';
            el.style.outlineOffset = '2px';
        });
    };

    /* ── حفظ ── */
    saveBtn.onclick = () => {
        controlsEditMode = false;
        currentEditTarget = null;
        editBtn.style.color = '#ddd';
        [plusBtn, minusBtn, saveBtn, resetBtn].forEach(b => b.style.display = 'none');
        wrapper.style.background = '';
        const saved = {};
        ctrlEls.forEach(el => {
            el.classList.remove('ctrl-edit-mode');
            el.style.outline = '';
            saved[el.dataset.ctrlId] = {
                x:    parseFloat(el.style.left),
                y:    parseFloat(el.style.top),
                size: parseFloat(el.style.width)
            };
        });
        localStorage.setItem('nosta_ctrls_' + gameId, JSON.stringify(saved));
    };

    /* ── تكبير/تصغير العنصر المحدد ── */
    plusBtn.onclick  = () => resizeTarget(+8);
    minusBtn.onclick = () => resizeTarget(-8);
    function resizeTarget(delta) {
        if (!currentEditTarget) return;
        const s = Math.max(36, parseFloat(currentEditTarget.style.width) + delta);
        currentEditTarget.style.width = currentEditTarget.style.height = s + 'px';
        // تحديث font-size زر الأكشن
        const lbl = currentEditTarget.querySelector('.ctrl-key-label');
        if (lbl) lbl.style.fontSize = Math.max(10, s * 0.3) + 'px';
    }

    /* ── إعادة ضبط الـ layout ── */
    resetBtn.onclick = () => {
        localStorage.removeItem('nosta_ctrls_' + gameId);
        const fresh = calcDefaultLayout(actionKeys);
        ctrlEls.forEach(el => {
            const key = el.dataset.ctrlId;
            const d   = fresh[key] || { x:50, y:50, size: DEFAULT_BTN_SIZE };
            placeEl(el, d.x, d.y, d.size);
        });
    };

    /* ── السحب في وضع التحرير (Touch) ── */
    ctrlEls.forEach(el => {
        let dragging = false, startX, startY, initL, initT;

        el.addEventListener('touchstart', e => {
            if (!controlsEditMode) return;
            e.preventDefault(); e.stopPropagation();
            dragging = true;
            currentEditTarget = el;
            ctrlEls.forEach(c => c.style.outlineColor = 'rgba(0,255,0,0.7)');
            el.style.outlineColor = '#ff0';
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            initL  = parseFloat(el.style.left) / 100 * window.innerWidth;
            initT  = parseFloat(el.style.top)  / 100 * window.innerHeight;
        }, { passive: false });

        el.addEventListener('touchmove', e => {
            if (!dragging || !controlsEditMode) return;
            e.preventDefault();
            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;
            const sw = parseFloat(el.style.width);
            el.style.left = Math.max(0, Math.min((initL + dx) / window.innerWidth  * 100, 100 - sw / window.innerWidth  * 100)) + '%';
            el.style.top  = Math.max(0, Math.min((initT + dy) / window.innerHeight * 100, 100 - sw / window.innerHeight * 100)) + '%';
        }, { passive: false });

        el.addEventListener('touchend',   () => { dragging = false; });
        el.addEventListener('touchcancel',() => { dragging = false; });
    });
}

/* ── مساعد: وضع عنصر بنسب مئوية ── */
function placeEl(el, xPct, yPct, sizePx) {
    el.style.position   = 'absolute';
    el.style.left       = xPct   + '%';
    el.style.top        = yPct   + '%';
    el.style.width      = sizePx + 'px';
    el.style.height     = sizePx + 'px';
    el.style.pointerEvents = 'auto';
}

/* ── بناء العصا التناظرية ── */
function buildAnalogStick(useWasd) {
    const base = document.createElement('div');
    base.className = 'ctrl-joystick-base';
    base.style.cssText = [
        'border-radius:50%;position:relative;touch-action:none;',
        'background:radial-gradient(circle at 35% 35%, rgba(255,255,255,0.18), rgba(0,0,0,0.5));',
        'border:2px solid rgba(255,255,255,0.25);',
        'box-shadow:0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);'
    ].join('');

    const knob = document.createElement('div');
    knob.style.cssText = [
        'width:42%;height:42%;border-radius:50%;',
        'background:radial-gradient(circle at 35% 35%, rgba(255,255,255,0.8), rgba(180,180,180,0.4));',
        'position:absolute;top:29%;left:29%;',
        'transition:transform 0.08s ease-out;',
        'box-shadow:0 2px 8px rgba(0,0,0,0.4);'
    ].join('');
    base.appendChild(knob);

    let activeKeys = [];
    const mapping  = useWasd
        ? { U:'W', D:'S', L:'A', R:'D' }
        : { U:'UP', D:'DOWN', L:'LEFT', R:'RIGHT' };

    const updateKeys = (next) => {
        activeKeys.forEach(k => { if (!next.includes(k)) triggerRuffleKeyEvent('keyup',   k); });
        next.forEach(k =>       { if (!activeKeys.includes(k)) triggerRuffleKeyEvent('keydown', k); });
        activeKeys = next;
    };

    const handleMove = e => {
        if (controlsEditMode) return;
        e.preventDefault();
        const rect = base.getBoundingClientRect();
        const cx = rect.left + rect.width  / 2;
        const cy = rect.top  + rect.height / 2;
        const mr = rect.width / 2;
        let dx = e.touches[0].clientX - cx;
        let dy = e.touches[0].clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > mr) { dx = dx / dist * mr; dy = dy / dist * mr; }
        knob.style.transform  = `translate(${dx}px,${dy}px)`;
        knob.style.transition = 'none';
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        let dirs = [];
        if (dist > mr * 0.18) {
            if      (angle > -112.5 && angle < -67.5)  dirs = [mapping.U];
            else if (angle >   67.5 && angle < 112.5)  dirs = [mapping.D];
            else if (angle >  -22.5 && angle <  22.5)  dirs = [mapping.R];
            else if (angle >  157.5 || angle < -157.5) dirs = [mapping.L];
            else if (angle >= -67.5 && angle <= -22.5) dirs = [mapping.U, mapping.R];
            else if (angle >=-157.5 && angle <=-112.5) dirs = [mapping.U, mapping.L];
            else if (angle >=  22.5 && angle <=  67.5) dirs = [mapping.D, mapping.R];
            else if (angle >= 112.5 && angle <= 157.5) dirs = [mapping.D, mapping.L];
        }
        updateKeys(dirs);
    };
    const handleEnd = e => {
        if (controlsEditMode) return;
        e.preventDefault();
        knob.style.transform  = 'translate(0,0)';
        knob.style.transition = 'transform 0.15s ease-out';
        updateKeys([]);
    };
    base.addEventListener('touchstart', handleMove, { passive: false });
    base.addEventListener('touchmove',  handleMove, { passive: false });
    base.addEventListener('touchend',   handleEnd,  { passive: false });
    base.addEventListener('touchcancel',handleEnd,  { passive: false });
    return base;
}

/* ── بناء زر أكشن (يرسم الحرف كنص) ── */
function buildActionBtn(keyName) {
    const btn = document.createElement('button');
    btn.className = 'ctrl-action-btn';

    // تحويل الأسماء الطويلة لاختصار مقروء
    const LABELS = { 'SPACE':'SPC','UP':'▲','DOWN':'▼','LEFT':'◄','RIGHT':'►' };
    const label  = LABELS[keyName.toUpperCase()] || keyName.toUpperCase().slice(0, 3);

    const lbl = document.createElement('span');
    lbl.className        = 'ctrl-key-label';
    lbl.textContent      = label;
    lbl.style.cssText    = 'font-family:monospace;font-weight:bold;font-size:18px;color:#fff;pointer-events:none;user-select:none;text-shadow:0 1px 3px rgba(0,0,0,0.8);';
    btn.appendChild(lbl);

    btn.style.cssText = [
        'border-radius:50%;display:flex;align-items:center;justify-content:center;',
        'touch-action:none;cursor:pointer;',
        'background:radial-gradient(circle at 35% 35%, rgba(255,255,255,0.22), rgba(0,0,0,0.55));',
        'border:2px solid rgba(255,255,255,0.35);',
        'box-shadow:0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15);',
        'transition:transform .08s, background .08s;'
    ].join('');

    const press = e => {
        if (controlsEditMode) return;
        e.preventDefault();
        btn.style.background = 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.55), rgba(80,80,80,0.6))';
        btn.style.transform  = 'scale(0.9)';
        triggerRuffleKeyEvent('keydown', keyName);
    };
    const release = e => {
        if (controlsEditMode) return;
        e.preventDefault();
        btn.style.background = 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.22), rgba(0,0,0,0.55))';
        btn.style.transform  = 'scale(1)';
        triggerRuffleKeyEvent('keyup', keyName);
    };
    btn.addEventListener('touchstart',  press,   { passive: false });
    btn.addEventListener('touchend',    release,  { passive: false });
    btn.addEventListener('touchcancel', release,  { passive: false });
    return btn;
}

/* =============================================
   GAME PLAYER
   ============================================= */
function openGame(game) {
    const player   = document.getElementById('game-player');
    const canvas   = document.getElementById('game-canvas');
    const overlay  = document.getElementById('game-overlay');
    const titleEl  = document.getElementById('playing-title');
    const closeBtn = document.getElementById('close-btn');
    if (!player||!canvas||!overlay||!titleEl||!closeBtn) return;

    titleEl.textContent = `▶ ${game.title}`;
    canvas.innerHTML    = '';
    overlay.style.display = 'flex';
    player.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // ── منع تمدد Flash خارج الحدود ──
    canvas.style.overflow   = 'hidden';
    canvas.style.position   = 'relative';
    canvas.style.contain    = 'strict';   // يمنع أي رسم خارج الـ canvas
    player.style.overflow   = 'hidden';

    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    let launched = false;

    const launchGame = () => {
        if (launched) return;
        launched = true;
        overlay.style.display = 'none';
        canvas.innerHTML = '';

        if (isMobile) {
            player.requestFullscreen?.().catch(()=>{});
            try { screen.orientation?.lock('landscape').catch(()=>{}); } catch(e) {}
        }

        if (game.type === 'swf') {
            window.RufflePlayer = window.RufflePlayer || {};
            const ruffle = window.RufflePlayer.newest();
            if (ruffle) {
                const p = ruffle.createPlayer();
                // تأكيد حصر Ruffle داخل الـ canvas فقط
                p.style.cssText = 'width:100%;height:100%;display:block;overflow:hidden;max-width:100%;max-height:100%;';
                p.setAttribute('tabindex', '0');
                canvas.appendChild(p);
                let finalUrl = game.src;
                if (finalUrl.includes('archive.org') || finalUrl.startsWith('http')) {
                    finalUrl = '/api/proxy?url=' + encodeURIComponent(game.src);
                }
                p.load(finalUrl);
            }
        } else if (game.type === 'iframe') {
            const iframe = document.createElement('iframe');
            iframe.src             = game.src;
            iframe.allowFullscreen = true;
            iframe.style.cssText   = 'width:100%;height:100%;border:none;display:block;overflow:hidden;';
            canvas.appendChild(iframe);
        }

        // ── عرض أزرار التحكم بعد تحميل اللعبة ──
        if (isMobile && game.controls) {
            // تأخير بسيط لضمان ظهور الأزرار فوق اللعبة
            setTimeout(() => {
                document.getElementById('smart-controls-wrapper')?.remove();
                renderSmartControls(game.id, game.controls, player);
            }, 400);
        }
    };

    overlay.onclick = () => showPixelLoadingBar(launchGame);

    closeBtn.onclick = () => {
        player.classList.add('hidden');
        canvas.innerHTML              = '';
        canvas.style.overflow         = '';
        canvas.style.contain          = '';
        player.style.overflow         = '';
        launched                      = false;
        overlay.style.display         = 'flex';
        document.body.style.overflow  = '';
        controlsEditMode              = false;
        currentEditTarget             = null;
        document.getElementById('smart-controls-wrapper')?.remove();
        try { screen.orientation?.unlock(); } catch(e) {}
        if (document.fullscreenElement) document.exitFullscreen?.();
    };
}

/* =============================================
   UI HELPERS
   ============================================= */
function initCarousel() {
    const grid = document.getElementById('games-grid');
    const prev = document.getElementById('carousel-prev');
    const next = document.getElementById('carousel-next');
    if (!grid||!prev||!next) return;
    const scrollAmt = () => Math.min(window.innerWidth * 0.75, 300);
    next.addEventListener('click', () => grid.scrollBy({left:scrollAmt(),behavior:'smooth'}));
    prev.addEventListener('click', () => grid.scrollBy({left:-scrollAmt(),behavior:'smooth'}));
}

function initBgIcons() {
    const layer = document.getElementById('bg-icons-layer');
    if (!layer||window.gamesDatabase.length===0) return;
    layer.innerHTML = '';
    const total = Math.min(window.gamesDatabase.length, 12);
    for (let i=0; i<total; i++) {
        const game = window.gamesDatabase[i%window.gamesDatabase.length];
        const img = document.createElement('img');
        img.src = game.image;
        img.className = 'bg-icon';
        img.onerror = () => img.remove();
        img.style.left = (Math.random()*95)+'%';
        img.style.animationDuration = (14+Math.random()*18)+'s';
        img.style.animationDelay = '-'+(Math.random()*14)+'s';
        const size = (38+Math.random()*28)+'px';
        img.style.width = img.style.height = size;
        layer.appendChild(img);
    }
}

function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
        });
    }, {threshold:0.1});
    document.querySelectorAll('.feature-card,.section-title,.android-section,.reveal').forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });
}

function initFullscreen() {
    const fsBtn = document.getElementById('fullscreen-btn');
    if (!fsBtn) return;
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) fsBtn.style.display = 'none';
    fsBtn.addEventListener('click', () => {
        const player = document.getElementById('game-player');
        if (!player) return;
        if (!document.fullscreenElement) {
            player.requestFullscreen?.();
            fsBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
        } else {
            document.exitFullscreen?.();
            fsBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
        }
    });
}

/* =============================================
   SEO: JSON-LD + نص مخفي (للـ Firebase-only fallback)
   ============================================= */
function injectSEOSchema() {
    // إذا كان الـ Server Snapshot موجوداً، لا نكرر schema موجودة
    if (window.__serverSnapshot && document.getElementById('server-games-schema')) return;

    document.getElementById('games-schema')?.remove();
    document.getElementById('seo-text-block')?.remove();

    const schemaData = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "ألعاب Flash الكلاسيكية - NostGames",
        "url": "https://nostagames.vercel.app/",
        "numberOfItems": window.gamesDatabase.length,
        "itemListElement": window.gamesDatabase.map((game, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "item": {
                "@type": "VideoGame",
                "name": game.title,
                "description": game.description || game.description_en || '',
                "image": game.image,
                "url": `https://nostagames.vercel.app/?game=${game.id}`,
                "contentRating": game.ageRating || '+3',
                "gamePlatform": ["Web Browser", "Android"],
                "offers": {"@type":"Offer","price":"0","priceCurrency":"USD"}
            }
        }))
    };

    const script = document.createElement('script');
    script.id = 'games-schema';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schemaData);
    document.head.appendChild(script);

    const seoBlock = document.createElement('div');
    seoBlock.id = 'seo-text-block';
    seoBlock.setAttribute('aria-hidden', 'true');
    seoBlock.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
    seoBlock.innerHTML = window.gamesDatabase.map(game => `
        <article>
            <h2>${game.title}</h2>
            <p>${game.description||''}</p>
            <p>${game.description_en||''}</p>
        </article>
    `).join('');
    document.body.appendChild(seoBlock);
}

// تصدير للاستخدام الخارجي
window.openGame = openGame;
window.renderGames = renderGames;
