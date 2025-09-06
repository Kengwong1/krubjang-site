const express = require('express');
const axios = require('axios');
require('dotenv').config();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// เปิดใช้งาน CORS เพื่อให้หน้าบ้านสามารถเรียก API นี้ได้
app.use(cors());

// ตั้งค่าทั่วไป (ค่าเดิมจากโค้ดของคุณ)
const DEFAULT_MAX_RESULTS = 8;
const MAX_RESULTS_PER_QUERY = 6;
const REGION_CODE = "TH";
const RELEVANCE_LANG = "th";

// หมวดหมู่ที่คุณกำหนดไว้ในโค้ดเดิม
const categories = [
    { title: "🎬 วิดีโอแนะนำ", query: "วิดีโอมาแรงวันนี้", params: { order: "viewCount" } },
    { title: "🎥 หนังใหม่", query: "หนังเต็มเรื่อง พากย์ไทย 2025", params: { order: "relevance", videoDuration: "long" } },
    { title: "🦸 หนังแอ็คชั่น", query: "หนังแอคชั่นมันๆ", params: { order: "viewCount" } },
    { title: "👻 หนังผี", query: "หนังผีไทย เต็มเรื่อง", params: { order: "viewCount" } },
    { title: "📺 ซีรีส์", query: "ซีรี่ย์เกาหลี พากย์ไทย", alternatives: ["ซีรีส์แนะนำ", "ซีรี่ย์จีน ซับไทย"], params: { order: "relevance" } },
    { title: "💖 ละครย้อนหลัง", query: "ละคร ย้อนหลัง Official", type: "playlist", params: { order: "relevance" } },
    { title: "🥗 สูตรอาหาร", query: "สูตรอาหารง่ายๆ", params: { order: "relevance" } },
    { title: "📱 เทคโนโลยี", query: "รีวิว เทคโนโลยี", alternatives: ["รีวิวมือถือ", "รีวิวคอมพิวเตอร์"], params: { order: "date" } },
    { title: "💪 สุขภาพและการออกกำลังกาย", query: "ออกกำลังกายที่บ้าน", params: { order: "relevance" } },
    { title: "✈️ การท่องเที่ยว", query: "เที่ยวไทย รีวิว", params: { order: "relevance" } },
    { title: "🗣️ การเมือง", query: "ข่าวการเมืองวันนี้", params: { order: "date", publishedAfterDays: 14 } },
    { title: "🎮 เกมส์", query: "รีวิวเกมใหม่น่าเล่น", params: { order: "date" } }
];

// ฟังก์ชันสำหรับสร้าง URL ของ YouTube API (ย้ายจากโค้ดของคุณ)
function buildSearchUrl(q, opts = {}) {
    const params = new URLSearchParams({
        part: 'snippet',
        q,
        key: YOUTUBE_API_KEY, // ใช้ API Key จากไฟล์ .env
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

    // จัดการ publishedAfterDays
    if (opts.publishedAfterDays) {
        const d = new Date(Date.now() - opts.publishedAfterDays * 24 * 60 * 60 * 1000);
        params.set('publishedAfter', d.toISOString());
    }

    return `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
}

// สร้าง API Endpoint สำหรับให้หน้าบ้านเรียกใช้งาน
app.get('/api/youtube', async (req, res) => {
    try {
        const results = {};
        for (const category of categories) {
            const query = category.query;
            const alternatives = category.alternatives || [];
            const allQueries = [query, ...alternatives];

            let combinedItems = [];
            for (const q of allQueries) {
                const url = buildSearchUrl(q, category.params);
                const response = await axios.get(url);
                if (response.data.items) {
                    combinedItems.push(...response.data.items);
                }
                if (combinedItems.length >= DEFAULT_MAX_RESULTS) break;
            }
            results[category.title] = combinedItems.slice(0, DEFAULT_MAX_RESULTS);
        }
        res.json(results);
    } catch (error) {
        console.error('Error fetching YouTube data:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch data from YouTube API' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});