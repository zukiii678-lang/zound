require("dotenv").config({ path: ".env.local" });

const categories = ["whoosh", "notification", "impact", "nature", "cinematic", "human", "glitch"];
const targetPerCategory = 40;
const apiKey = process.env.FREESOUND_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!apiKey || !supabaseUrl || !supabaseKey) {
  console.error("Missing FREESOUND_API_KEY, SUPABASE_URL, or SUPABASE_KEY in .env.local");
  process.exit(1);
}

const freesoundHeaders = { Authorization: `Token ${apiKey}` };
const supabaseHeaders = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(url, options = {}) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, options);
    const body = await response.text();
    if (response.status === 204) return null;
    if (response.ok && body.trim()) {
      try { return JSON.parse(body); } catch { throw new Error(`Invalid JSON response from ${new URL(url).hostname}`); }
    }
    if (attempt < 3 && (response.status === 429 || response.status >= 500 || !body.trim())) { await sleep(attempt * 1200); continue; }
    throw new Error(`${response.status} ${response.statusText}: ${body || "empty response"}`);
  }
}

function text(value) {
  return String(value || "").toLowerCase().replace(/[_.-]+/g, " ").replace(/\s+/g, " ").trim();
}

const titleRules = {
  whoosh: [["fast|quick|rapid|speed", "Cepat"], ["slow|soft|gentle", "Lembut"], ["heavy|deep|large", "Berat"], ["reverse|backward", "Balik"], ["short|quick", "Pendek"], ["long", "Panjang"]],
  notification: [["pop", "Pop"], ["bell|ring|chime", "Lonceng"], ["alert|alarm", "Alarm"], ["beep|bleep", "Bip"], ["message|text|sms", "Pesan"], ["click|tap", "Klik"]],
  impact: [["explosion|explode", "Ledakan"], ["bass|sub", "Bass"], ["boom", "Dentuman"], ["hit|punch|slam", "Hantaman"], ["crash|smash", "Benturan"], ["drop", "Jatuhan"]],
  nature: [["heavy|hard|storm", "Deras"], ["light|soft|gentle", "Lembut"], ["rain|rainfall", "Hujan"], ["thunder", "Guntur"], ["wind|breeze", "Angin"], ["water|stream|river", "Air"], ["bird|birds", "Burung"], ["ocean|sea|wave", "Ombak"]],
  cinematic: [["epic|heroic", "Epik"], ["dark|horror", "Gelap"], ["riser|rising", "Riser"], ["drone", "Drone"], ["tension|suspense", "Tegang"], ["trailer", "Trailer"], ["impact|hit", "Hantaman"]],
  human: [["laugh|laughter", "Tawa"], ["breath|breathing", "Napas"], ["voice|vocal|speech", "Suara"], ["clap|applause", "Tepuk"], ["step|footstep", "Langkah"], ["crowd", "Kerumunan"], ["cry|scream", "Teriakan"]],
  glitch: [["error|failure", "Error"], ["static|noise", "Statik"], ["digital|computer", "Digital"], ["distort|distortion", "Distorsi"], ["zap|electric", "Listrik"], ["data|scan", "Data"], ["bit|8bit", "Bit"]],
};

const categoryNames = { whoosh: "Whoosh", notification: "Notifikasi", impact: "Dampak", nature: "Alam", cinematic: "Sinematik", human: "Manusia", glitch: "Glitch" };

function makeTitle(rawName, category) {
  const source = text(rawName);
  const rule = titleRules[category].find(([pattern]) => new RegExp(`(?:^| )(${pattern})(?: |$)`).test(source));
  const descriptor = rule?.[1] || { whoosh: "Cepat", notification: "Pop", impact: "Hantaman", nature: "Alam", cinematic: "Epik", human: "Suara", glitch: "Digital" }[category];
  if (category === "whoosh") return `${descriptor} Whoosh`;
  if (category === "notification") return `Notifikasi ${descriptor}`;
  if (category === "impact") return descriptor === "Bass" ? "Ledakan Bass" : `${descriptor} Impact`;
  if (category === "nature") return descriptor === "Hujan" || descriptor === "Deras" ? `${descriptor} Hujan` : `${descriptor} Alam`;
  if (category === "cinematic") return `${descriptor} Sinematik`;
  if (category === "human") return `${descriptor} Manusia`;
  return `${descriptor} Glitch`;
}

function uniqueTitle(title, usedTitles) {
  const base = title.replace(/\s+/g, " ").trim();
  const key = base.toLowerCase();
  if (!usedTitles.has(key)) { usedTitles.add(key); return base; }
  let index = 2;
  while (usedTitles.has(`${key} ${index}`)) index += 1;
  const unique = `${base} ${index}`;
  usedTitles.add(unique.toLowerCase());
  return unique;
}

function licenseInfo(sound) {
  const license = text(sound.license);
  const allowed = license.includes("creativecommons0") || license.includes("publicdomain") || license.includes("attribution") || license.includes("/by/");
  const cc0 = license.includes("creativecommons0") || license.includes("publicdomain") || license.includes("zero");
  return { allowed, type: cc0 ? "CC0" : "CC BY" };
}

async function getExisting() {
  return request(`${supabaseUrl}/rest/v1/sounds?select=id,title,category,file_url&order=created_at.asc`, { headers: supabaseHeaders });
}

async function searchCategory(category) {
  const query = encodeURIComponent(category);
  const url = `https://freesound.org/apiv2/search/text/?query=${query}&filter=duration:[0 TO 30]&fields=id,name,duration,previews,license,username&sort=rating_desc&page_size=40`;
  const results = [];
  let nextUrl = url;
  for (let page = 0; page < 5 && nextUrl; page += 1) {
    const result = await request(nextUrl, { headers: { ...freesoundHeaders, Accept: "application/json" } });
    results.push(...(result?.results || []));
    nextUrl = result?.next || null;
    if (results.length >= targetPerCategory * 2) break;
    await sleep(700);
  }
  return results;
}

async function saveRows(rows) {
  for (let start = 0; start < rows.length; start += 100) {
    const chunk = rows.slice(start, start + 100);
    await request(`${supabaseUrl}/rest/v1/sounds?on_conflict=id`, { method: "POST", headers: { ...supabaseHeaders, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(chunk) });
  }
}

async function main() {
  const existing = await getExisting();
  const usedTitles = new Set();
  const usedUrls = new Set();
  const usedIds = new Set();
  for (const sound of existing) {
    usedIds.add(String(sound.id));
    if (sound.file_url) usedUrls.add(sound.file_url);
    if (sound.title) usedTitles.add(text(sound.title));
  }

  const allRows = [];
  for (const category of categories) {
    console.log(`\n[${category}] searching up to ${targetPerCategory} usable sounds...`);
    try {
      const results = await searchCategory(category);
      const rows = [];
      for (const sound of results) {
        if (rows.length >= targetPerCategory) break;
        const license = licenseInfo(sound);
        const fileUrl = sound.previews?.["preview-hq-mp3"] || sound.previews?.["preview-lq-mp3"];
        if (!license.allowed || !fileUrl || usedIds.has(String(sound.id)) || usedUrls.has(fileUrl)) continue;
        const title = uniqueTitle(makeTitle(sound.name, category), usedTitles);
        rows.push({ id: String(sound.id), title, category, file_url: fileUrl, duration: sound.duration, license_type: license.type, source: `Freesound / ${sound.username}` });
        usedIds.add(String(sound.id));
        usedUrls.add(fileUrl);
      }
      if (rows.length) { allRows.push(...rows); await saveRows(rows); }
      console.log(`  inserted ${rows.length} new sounds`);
    } catch (error) { console.error(`  skipped: ${error.message}`); }
    await sleep(400);
  }

  const legacyTitles = new Set();
  const legacyRows = existing.map((sound) => ({ id: sound.id, title: uniqueTitle(makeTitle(sound.title, sound.category), legacyTitles) })).filter((sound) => sound.title);
  for (const sound of legacyRows) {
    await request(`${supabaseUrl}/rest/v1/sounds?id=eq.${encodeURIComponent(sound.id)}`, { method: "PATCH", headers: { ...supabaseHeaders, Prefer: "return=minimal" }, body: JSON.stringify({ title: sound.title }) });
  }

  const finalRows = await getExisting();
  const summary = Object.fromEntries(categories.map((category) => [category, finalRows.filter((sound) => sound.category === category).length]));
  console.log(`\nDone. Added ${allRows.length} new sounds and renamed ${legacyRows.length} existing sounds.`);
  console.log("Final totals by category:");
  for (const category of categories) console.log(`  ${category}: ${summary[category]}`);
}

main().catch((error) => { console.error(error); process.exit(1); });
