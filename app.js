// == YouTube Data API v3 – Enhanced Category Fetcher ==
// FIX: แก้ไขการสร้าง URL ของวิดีโอ/เพลย์ลิสต์ และปรับปรุงคำค้นหา
// FIX: ปรับแก้หมวดหมู่ "ซีรีส์", "ละครย้อนหลัง", "เทคโนโลยี", "การเมือง" ให้ดึงข้อมูลได้ดีขึ้น

// **คำเตือนด้านความปลอดภัยที่สำคัญมาก:**
// การใส่ API Key ไว้ในโค้ดฝั่งหน้าบ้าน (Client-side) มีความเสี่ยงสูงมากที่ Key ของคุณจะถูกขโมย
// และนำไปใช้จนโควต้า (Quota) หมด หรือเกิดค่าใช้จ่ายได้
// วิธีที่ปลอดภัยคือการเรียก API ผ่านเซิร์ฟเวอร์หลังบ้าน (Backend) ของคุณเอง
const API_KEY = "AIzaSyDe9ca5SRnYppUCacq8gh2W1ygrkJUl_Lw"; // <-- ใส่ API Key ของคุณที่นี่

// ตั้งค่าทั่วไป
const DEFAULT_MAX_RESULTS = 8;
const MAX_RESULTS_PER_QUERY = 6;
const CACHE_EXPIRY_SECONDS = 3600; // 1 ชั่วโมง
const REGION_CODE = "TH";
const RELEVANCE_LANG = "th";

// **หมวดหมู่ที่ปรับปรุงใหม่**
const categories = [
  { title: "🎬 วิดีโอแนะนำ", query: "วิดีโอมาแรงวันนี้", params: { order: "viewCount" } },
  { title: "🎥 หนังใหม่", query: "หนังเต็มเรื่อง พากย์ไทย 2025", params: { order: "relevance", videoDuration: "long" } },
  { title: "🦸 หนังแอ็คชั่น", query: "หนังแอคชั่นมันๆ", params: { order: "viewCount" } },
  { title: "👻 หนังผี", query: "หนังผีไทย เต็มเรื่อง", params: { order: "viewCount" } },

  // 📺 ซีรีส์ — ปรับ order เป็น relevance เพื่อให้เจอจากหลายคำค้นได้ง่ายขึ้น
  {
    title: "📺 ซีรีส์",
    query: "ซีรี่ย์เกาหลี พากย์ไทย",
    alternatives: ["ซีรีส์แนะนำ", "ซีรี่ย์จีน ซับไทย", "tv series interesting", "kdrama ซับไทย", "thai series", "drama series"],
    params: {
      order: "relevance", // <--- ***FIX: เปลี่ยนเป็น relevance เพื่อผลลัพธ์ที่กว้างขึ้น***
      videoType: "episode",
      videoDuration: "any",
      safeSearch: "none"
    }
  },

  // 💖 ละครย้อนหลัง — เน้น type=playlist เพื่อดึงเพลย์ลิสต์ตอนย้อนหลังจากช่องหลัก
  {
    title: "💖 ละครย้อนหลัง",
    query: "ละคร ย้อนหลัง Official",
    alternatives: ["ละครย้อนหลังช่อง 3", "ละครย้อนหลัง one31", "ละครย้อนหลังช่อง 7", "ละครย้อนหลัง เต็มตอน"],
    type: "playlist",
    params: {
      order: "relevance",
      safeSearch: "none"
    },
    fallback: {
      type: "video",
      params: { order: "date", videoDuration: "long", safeSearch: "none" }
    }
  },

  { title: "🥗 สูตรอาหาร", query: "สูตรอาหารง่ายๆ", params: { order: "relevance" } },

  // 📱 เทคโนโลยี — ปรับคำค้นหลักให้กว้างขึ้น และเรียงตามล่าสุด (date)
  {
    title: "📱 เทคโนโลยี",
    query: "รีวิว เทคโนโลยี", // <--- ***FIX: เปลี่ยนคำค้นหลักให้กว้างขึ้น***
    alternatives: ["รีวิวมือถือ", "รีวิวคอมพิวเตอร์", "แกะกล่อง มือถือ", "โน๊ตบุ๊ค รีวิว 2025"],
    params: {
      order: "date",
      videoDuration: "medium",
      safeSearch: "none"
    }
  },

  { title: "💪 สุขภาพและการออกกำลังกาย", query: "ออกกำลังกายที่บ้าน", params: { order: "relevance" } },
  { title: "✈️ การท่องเที่ยว", query: "เที่ยวไทย รีวิว", params: { order: "relevance" } },

  // 🗣️ การเมือง — เน้นข่าวล่าสุด 14 วัน (เหมือนเดิม, ตั้งค่าถูกต้องแล้ว)
  {
    title: "🗣️ การเมือง",
    query: "ข่าวการเมืองวันนี้",
    alternatives: ["สรุปข่าวการเมือง", "อภิปรายล่าสุด", "แถลงข่าวนายก", "เลือกตั้ง", "ดีเบต การเมือง"],
    params: {
      order: "date",
      safeSearch: "none",
      publishedAfterDays: 14 // เราจะคำนวณเป็น RFC3339 ใน runtime
    }
  },

  { title: "🎮 เกมส์", query: "รีวิวเกมใหม่น่าเล่น", params: { order: "date" } }
];


const mainContent = document.getElementById('main-content');

// ===== Utility =====
function toRFC3339DaysAgo(days = 7) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

function buildSearchUrl(q, opts = {}) {
  const params = new URLSearchParams({
    part: 'snippet',
    q,
    key: API_KEY,
    maxResults: String(opts.maxResults || MAX_RESULTS_PER_QUERY),
    type: opts.type || 'video'
  });

  if (opts.order) params.set('order', opts.order);
  if (opts.videoType) params.set('videoType', opts.videoType);
  if (opts.videoDuration) params.set('videoDuration', opts.videoDuration);
  if (opts.eventType) params.set('eventType', opts.eventType);
  if (opts.safeSearch) params.set('safeSearch', opts.safeSearch);

  params.set('regionCode', opts.regionCode || REGION_CODE);
  params.set('relevanceLanguage', opts.relevanceLanguage || RELEVANCE_LANG);

  if (opts.publishedAfter) params.set('publishedAfter', opts.publishedAfter);
  if (opts.publishedBefore) params.set('publishedBefore', params.set('publishedBefore'));

  return `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
}

function cacheGet(cacheKey) {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_EXPIRY_SECONDS * 1000) return null;
    return cached.data;
  } catch (e) {
    return null;
  }
}

function cacheSet(cacheKey, data) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) { console.error("Failed to set cache:", e); }
}

function uniqueResults(items) {
  const seen = new Set();
  return items.filter(it => {
    const kind = it?.id?.kind || '';
    const key = kind === 'youtube#playlist' ? it?.id?.playlistId : it?.id?.videoId;
    if (!key) return false;
    const composite = `${kind}:${key}`;
    if (seen.has(composite)) return false;
    seen.add(composite);
    return true;
  });
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for URL: ${url}`);
  return await res.json();
}

async function fetchCategoryItems(category) {
  const typePrimary = category.type || 'video';
  const queries = [category.query, ...(category.alternatives || [])].filter(Boolean);
  let combined = [];
  const baseOpts = { ...category.params };

  if (baseOpts && baseOpts.publishedAfterDays) {
    baseOpts.publishedAfter = toRFC3339DaysAgo(baseOpts.publishedAfterDays);
    delete baseOpts.publishedAfterDays;
  }

  // --- Primary fetch ---
  for (const q of queries) {
    const url = buildSearchUrl(q, { ...baseOpts, type: typePrimary });
    const cacheKey = `yt_cache_${encodeURIComponent(url)}`;
    let data = cacheGet(cacheKey);
    if (!data) {
      data = await fetchJson(url);
      cacheSet(cacheKey, data);
    }
    if (Array.isArray(data.items)) combined.push(...data.items);
    if (uniqueResults(combined).length >= DEFAULT_MAX_RESULTS) break;
  }

  combined = uniqueResults(combined);

  // --- Fallback fetch ---
  if (combined.length < DEFAULT_MAX_RESULTS && category.fallback) {
    const fbOpts = { ...(category.fallback.params || {}) };
    if (fbOpts.publishedAfterDays) {
      fbOpts.publishedAfter = toRFC3339DaysAgo(fbOpts.publishedAfterDays);
      delete fbOpts.publishedAfterDays;
    }
    for (const q of queries) {
      const url = buildSearchUrl(q, { ...fbOpts, type: category.fallback.type || 'video' });
      const cacheKey = `yt_cache_${encodeURIComponent(url)}`;
      let data = cacheGet(cacheKey);
      if (!data) {
        data = await fetchJson(url);
        cacheSet(cacheKey, data);
      }
      if (Array.isArray(data.items)) combined.push(...data.items);
      if (uniqueResults(combined).length >= DEFAULT_MAX_RESULTS) break;
    }
    combined = uniqueResults(combined);
  }

  return combined.slice(0, DEFAULT_MAX_RESULTS);
}

// ***FIXED: แก้ไขการสร้าง URL ให้ถูกต้อง***
function renderVideos(category, items) {
  const videoGridId = `videos-for-${category.title.replace(/[^a-z0-9]/gi, '-')}`;
  const videoGrid = document.getElementById(videoGridId);
  if (!videoGrid) return;

  if (!items || items.length === 0) {
    videoGrid.innerHTML = '<p style="padding: 0 20px;">ไม่พบวิดีโอที่เกี่ยวข้อง</p>';
    return;
  }

  videoGrid.innerHTML = ''; // Clear previous content

  for (const item of items) {
    const kind = item?.id?.kind;
    const snippet = item?.snippet || {};
    const title = snippet?.title || 'ไม่มีชื่อเรื่อง';
    const thumb = snippet?.thumbnails?.high?.url || snippet?.thumbnails?.medium?.url || '';

    let href = '#';
    if (kind === 'youtube#playlist') {
      const listId = item?.id?.playlistId;
      // ***FIXED: แก้ไขรูปแบบ URL ของ Playlist ให้ถูกต้องโดยใช้ template literals***
      href = `http://googleusercontent.com/youtube.com/${listId}`;
    } else if (kind === 'youtube#video') {
      const vid = item?.id?.videoId;
      // ***FIXED: แก้ไขรูปแบบ URL ของ Video ให้ถูกต้องโดยใช้ template literals***
      href = `http://googleusercontent.com/youtube.com/${vid}`;
    }

    const card = `
      <a href="${href}" target="_blank" rel="noopener" class="video-card">
        <img src="${thumb}" alt="${title}" loading="lazy">
        <h3>${title}</h3>
      </a>
    `;
    videoGrid.insertAdjacentHTML('beforeend', card);
  }
}


function createCategorySection(category) {
  const section = document.createElement('div');
  section.className = 'category-section';

  const heading = document.createElement('h2');
  heading.textContent = category.title;
  section.appendChild(heading);

  const videoGrid = document.createElement('div');
  videoGrid.className = 'video-grid';
  videoGrid.id = `videos-for-${category.title.replace(/[^a-z0-9]/gi, '-')}`;
  videoGrid.innerHTML = '<p style="padding: 0 20px;">กำลังโหลด...</p>';
  section.appendChild(videoGrid);

  mainContent.appendChild(section);
}

async function hydrateCategory(category) {
  const sectionId = `videos-for-${category.title.replace(/[^a-z0-9]/gi, '-')}`;
  try {
    const items = await fetchCategoryItems(category);
    renderVideos(category, items);
  } catch (error) {
    console.error(`เกิดข้อผิดพลาดในการดึงข้อมูลสำหรับหมวดหมู่ "${category.title}":`, error);
    const videoGrid = document.getElementById(sectionId);
    if (videoGrid) {
      videoGrid.innerHTML = '<p style="color:red; padding: 0 20px;">ไม่สามารถดึงวิดีโอได้ (โปรดตรวจสอบ Console)</p>';
    }
  }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  if (!API_KEY || API_KEY.includes("YOUR_API_KEY")) {
      mainContent.innerHTML = '<h2 style="color:red; text-align:center;">ข้อผิดพลาด: กรุณาใส่ API Key ของคุณในโค้ดก่อนใช้งาน</h2>';
      return;
  }
  mainContent.innerHTML = '';
  categories.forEach(category => {
    createCategorySection(category);
    hydrateCategory(category);
  });
});