// ============================================
// CRESCENT AI — PARSING + GROQ + DONOR SEARCH
// (সব আগের ফিচার + স্মার্টার AI + নাম ধরে কথা বলা + অপটিমাইজড কোড)
// ============================================

let userProfilePic = null;
let currentUser = null;
let userName = 'User';
let isProcessing = false;

// এই কথোপকথনের সংক্ষিপ্ত ইতিহাস — AI-কে প্রসঙ্গ মনে রাখতে ও আরও বুদ্ধিমান উত্তর দিতে সাহায্য করে
let conversationHistory = [];
const MAX_HISTORY_TURNS = 8;

// Groq API ক্রেডেনশিয়াল
const GROQ_API_KEY = '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';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_TIMEOUT_MS = 20000;
const GROQ_MAX_RETRIES = 1; // ব্যর্থ হলে একবার আবার চেষ্টা করবে (network hiccup সামলাতে)

// =============================================
// KNOWLEDGE BASE (পার্সিং) — ডুপ্লিকেট টেক্সট এক জায়গায় রেখে অপটিমাইজ করা
// =============================================
const KB_TEXT = {
    beforeDonationBn: 'রক্ত দেওয়ার আগে ভালো করে খাবার খান (ডিম, মাংস, শাক-সবজি)। পর্যাপ্ত পানি পান করুন। রাতে ভালো ঘুম নিন। অ্যালকোহল ও চর্বিযুক্ত খাবার এড়িয়ে চলুন।',
    afterDonationBn: 'রক্ত দেওয়ার পরে ১০-১৫ মিনিট বিশ্রাম নিন। পানি ও জুস পান করুন। কিছু মিষ্টি খেতে পারেন (চকলেট, মিষ্টি)। ২৪ ঘন্টা ভারী কাজ বা ব্যায়াম করবেন না। ধূমপান ও অ্যালকোহল এড়িয়ে চলুন।',
    donorTreatmentBn: 'ডোনারকে আন্তরিক ধন্যবাদ ও কৃতজ্ঞতা জানান। তাকে পর্যাপ্ত বিশ্রাম ও পানি দিন। তার শারীরিক অবস্থা খোঁজ রাখুন। পরবর্তী ডোনেশনের তারিখ মনে করিয়ে দিন (পুরুষ: ৩ মাস পর, মহিলা: ৪ মাস পর)।',
    eligibilityBn: 'রক্ত দেওয়ার যোগ্যতা: বয়স ১৮-৬৫ বছর, ওজন ৪৫ কেজি বা তার বেশি, হিমোগ্লোবিন: পুরুষ ১৩.০ g/dL ও মহিলা ১২.৫ g/dL। প্রয়োজনে ডাক্তারের পরামর্শ নিন।',
    benefitsBn: 'রক্ত দানের উপকারিতা: নতুন রক্তকণিকা তৈরি হয়। শরীরে আয়রনের মাত্রা নিয়ন্ত্রণে থাকে। হৃদরোগের ঝুঁকি কমায়। মানসিক সন্তুষ্টি ও সমাজসেবার অংশ।',
    greetingBn: 'হ্যালো! আমি Crescent AI – আপনার রক্তদান সংক্রান্ত সহচর। Developed by Al Fitar Ahmed. কীভাবে সাহায্য করতে পারি?',
    howAreYouBn: 'আমি ভালো আছি, ধন্যবাদ! Developed by Al Fitar Ahmed. আপনার রক্তদান সংক্রান্ত যেকোনো প্রশ্ন করতে পারেন।',
    thanksBn: 'আপনাকে অসংখ্য ধন্যবাদ! রক্তদান একটি মহৎ কাজ – আপনি একজন সত্যিকারের হিরো।',

    beforeDonationEn: 'Before donation: eat iron-rich food (eggs, meat, greens), drink plenty of water, get good sleep, avoid alcohol and fatty foods, don\'t smoke.',
    afterDonationEn: 'After donation: rest 10-15 min, drink water/juice, eat sweets (chocolate, candy), avoid heavy work/exercise for 24 hours.',
    donorTreatmentEn: 'Thank the donor sincerely. Provide rest and water. Check their condition. Remind next donation date (male: 3 months, female: 4 months).',
    eligibilityEn: 'Age 18-65, weight ≥45 kg, hemoglobin: male ≥13.0, female ≥12.5. No infections, chronic diseases, pregnancy, recent surgery.',
    benefitsEn: 'Physical: new blood cells, iron control, lower heart disease risk. Mental: confidence, social responsibility, satisfaction.',
    greetingEn: "Hello! I'm Crescent AI – your blood donation companion. Developed by Al Fitar Ahmed. How can I help?",
    howAreYouEn: "I'm good, thank you! Developed by Al Fitar Ahmed. How can I help you with blood donation?",
    thanksEn: 'Thank you so much! Blood donation is a noble act – you are a true hero!'
};

const knowledgeBase = {
    bn: {
        'রক্ত দেওয়ার আগে': KB_TEXT.beforeDonationBn,
        'রক্ত দেওয়ার আগে কি করব': KB_TEXT.beforeDonationBn,
        'rokto deyar age ki korbo': KB_TEXT.beforeDonationBn,
        'roko deyar age ki korbo': KB_TEXT.beforeDonationBn,

        'রক্ত দেওয়ার পরে': KB_TEXT.afterDonationBn,
        'রক্ত দেওয়ার পর কি করব': KB_TEXT.afterDonationBn,
        'rokto deyar por ki korbo': KB_TEXT.afterDonationBn,
        'roko deyar por ki korbo': KB_TEXT.afterDonationBn,

        'ডোনার ট্রিটমেন্ট': KB_TEXT.donorTreatmentBn,
        'donor treatment': KB_TEXT.donorTreatmentBn,

        'যোগ্যতা': KB_TEXT.eligibilityBn,
        'joggota': KB_TEXT.eligibilityBn,
        'eligibility': KB_TEXT.eligibilityBn,

        'উপকারিতা': KB_TEXT.benefitsBn,
        'upokarita': KB_TEXT.benefitsBn,
        'benefits': KB_TEXT.benefitsBn,

        'হ্যালো': KB_TEXT.greetingBn,
        'hello': KB_TEXT.greetingBn,
        'হাই': KB_TEXT.greetingBn,
        'hi': KB_TEXT.greetingBn,
        'কেমন আছো': KB_TEXT.howAreYouBn,
        'kemon acho': KB_TEXT.howAreYouBn,
        'how are you': KB_TEXT.howAreYouEn,

        'ধন্যবাদ': KB_TEXT.thanksBn,
        'thank you': KB_TEXT.thanksBn
    },
    en: {
        'blood donation before': KB_TEXT.beforeDonationEn,
        'before donation': KB_TEXT.beforeDonationEn,
        'blood donation after': KB_TEXT.afterDonationEn,
        'after donation': KB_TEXT.afterDonationEn,
        'donor treatment': KB_TEXT.donorTreatmentEn,
        'eligibility': KB_TEXT.eligibilityEn,
        'benefits': KB_TEXT.benefitsEn,
        'hello': KB_TEXT.greetingEn,
        'hi': KB_TEXT.greetingEn,
        'how are you': KB_TEXT.howAreYouEn,
        'thank you': KB_TEXT.thanksEn
    }
};

const BANGLISH_MAP = {
    roko: 'রক্ত', rokto: 'রক্ত', deyar: 'দেওয়ার', dewar: 'দেওয়ার',
    dan: 'দান', pore: 'পরে', age: 'আগে', jotno: 'যত্ন',
    upokarita: 'উপকারিতা', joggota: 'যোগ্যতা', donor: 'ডোনার',
    dib: 'দিব', dibo: 'দিবো', korte: 'করতে', pari: 'পারি',
    korbo: 'করব', hobe: 'হবে', ki: 'কি', kemon: 'কেমন',
    acho: 'আছো', achen: 'আছেন'
};

const BLOOD_GROUP_PATTERN = /(A\+|A-|B\+|B-|AB\+|AB-|O\+|O-)/i;

// =============================================
// BANGLISH শনাক্তকরণের জন্য পরিচিত বাংলা শব্দ (রোমান হরফে)
// এর যেকোনো একটা পেলেই মেসেজকে বাংলা হিসেবে ধরা হবে
// =============================================
const BANGLISH_INDICATOR_WORDS = [
    'ami', 'tumi', 'apni', 'tomar', 'amar', 'apnar', 'amake', 'tomake',
    'kemon', 'kemne', 'achen', 'acho', 'aachi', 'ache', 'achi',
    'bhalo', 'valo', 'bhalo achi', 'valo achi',
    'ki', 'naki', 'kina',
    'korbo', 'korte', 'korchi', 'korlam', 'korsi', 'korte hobe', 'korte pari', 'kore', 'korle',
    'hocche', 'hoyeche', 'hobe', 'hoise', 'hoy', 'hobena',
    'chai', 'lagbe', 'lagse', 'lagche',
    'deya', 'deyar', 'dewar', 'dite', 'dibo', 'dib', 'debo',
    'neya', 'nite', 'nibo',
    'jonno', 'theke', 'kotha', 'bolo', 'bolen', 'bolte',
    'dhonnobad', 'dhonnobaad', 'dhanyabad',
    'jani', 'jano', 'jante', 'bujhi', 'bujhlam', 'bujhte',
    'rokto', 'roko', 'rokter', 'dan', 'donor', 'joggota', 'upokarita',
    'kobe', 'kothay', 'kivabe', 'kibhabe', 'kemon kore',
    'ekhon', 'ajke', 'kalke', 'porshu',
    'tui', 'tomra', 'oder', 'oneke', 'shobai', 'shokoler',
    'mane', 'pari', 'parbo', 'parina', 'parbona',
    'na', 'nei', 'nai'
];

// =============================================
// বাংলা শনাক্তকরণ + "in bangla" চেক
// =============================================
function detectLanguage(text) {
    // খাঁটি বাংলা ইউনিকোড লেখা
    if (/[\u0980-\u09FF]/.test(text)) return 'bn';

    const lower = text.toLowerCase();
    if (lower.includes('in bangla') || lower.includes('বাংলা')) return 'bn';

    // Banglish (রোমান হরফে বাংলা) — পরিচিত বাংলা শব্দ থাকলে বাংলা ধরা হবে
    for (const word of BANGLISH_INDICATOR_WORDS) {
        const pattern = new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'i');
        if (pattern.test(lower)) return 'bn';
    }

    // কোনো বাংলা সংকেত না পেলে খাঁটি ইংরেজি ধরা হবে
    return 'en';
}

// =============================================
// Knowledge Base থেকে উত্তর খোঁজা (পার্সিং)
// =============================================
function getAnswerFromKB(userMessage, language) {
    const lowerMsg = userMessage.toLowerCase().trim();
    const kb = knowledgeBase[language] || {};

    if (kb[lowerMsg]) return kb[lowerMsg];

    for (const [keyword, answer] of Object.entries(kb)) {
        if (lowerMsg.includes(keyword) || keyword.includes(lowerMsg)) return answer;
    }

    if (language === 'bn') {
        let modifiedMsg = lowerMsg;
        for (const [key, value] of Object.entries(BANGLISH_MAP)) {
            modifiedMsg = modifiedMsg.replace(new RegExp(key, 'g'), value);
        }
        for (const [keyword, answer] of Object.entries(kb)) {
            if (modifiedMsg.includes(keyword) || lowerMsg.includes(keyword)) return answer;
        }
    }

    return null;
}

// =============================================
// ** (বোল্ড) স্ট্রিপ করার ফাংশন
// =============================================
function stripBold(text) {
    return text.replace(/\*\*/g, '').trim();
}

// =============================================
// ইউজারকে নাম ধরে সম্বোধন করা
// =============================================
function personalize(text) {
    if (!userName || userName === 'User') return text;
    if (text.trim().startsWith(userName)) return text; // ইতিমধ্যে নাম আছে (Groq থেকে আসতে পারে)
    return `${userName}, ${text}`;
}

// =============================================
// স্মার্ট সিস্টেম প্রম্পট — ইউজার যেভাবে মেসেজ দেয়, সেভাবেই উত্তর দেওয়ার জন্য
// =============================================
function buildSystemPrompt(isBn) {
    const name = userName && userName !== 'User' ? userName : (isBn ? 'ব্যবহারকারী' : 'the user');
    if (isBn) {
        return `তুমি Crescent AI, একজন বন্ধুত্বপূর্ণ ও বুদ্ধিমান রক্তদান সহকারী, developed by Al Fitar Ahmed। ` +
            `ব্যবহারকারীর নাম "${name}", তাকে স্বাভাবিকভাবে নাম ধরে সম্বোধন করো (জোর করে প্রতি লাইনে না, স্বাভাবিকভাবে)। ` +
            `ব্যবহারকারী যেভাবে/যে ভাষায়/যে টোনে মেসেজ দেয় (আনুষ্ঠানিক, রসিকতা, সংক্ষিপ্ত, বিস্তারিত) সেভাবেই মানানসই উত্তর দাও — ` +
            `শুধু একই ধরনের উত্তর বারবার রিপিট করবে না। রক্তদান সংক্রান্ত প্রশ্নে তথ্যবহুল, নির্ভুল ও প্রাসঙ্গিক উত্তর দাও। ` +
            `উত্তর সংক্ষিপ্ত রাখো — সাধারণত ২-৪ বাক্যের মধ্যে, দরকার ছাড়া লম্বা ব্যাখ্যা বা বাড়তি ভূমিকা দেবে না। শুধু জটিল/বিস্তারিত প্রশ্নে একটু বড় উত্তর দাও। ` +
            `সাধারণ কথাবার্তাতেও স্বাভাবিক ও সহানুভূতিশীলভাবে সাড়া দাও, কিন্তু সংক্ষিপ্তভাবে। আগের কথোপকথনের প্রসঙ্গ মনে রেখে উত্তর দাও, একই কথা বারবার বলবে না।`;
    }
    return `You are Crescent AI, a friendly and intelligent blood donation assistant, developed by Al Fitar Ahmed. ` +
        `The user's name is "${name}" — address them by name naturally within your replies (not forced into every line). ` +
        `Match your response to how the user writes — their tone, formality, and level of detail — instead of repeating the same canned style every time. ` +
        `Give accurate, concise, relevant answers for blood-donation questions, and respond naturally and warmly to general conversation too. ` +
        `Keep replies short — usually 2-4 sentences, no unnecessary preamble or over-explaining. Only go longer for genuinely complex or detailed questions. ` +
        `Keep track of context from earlier in this chat so you don't repeat yourself.`;
}

// =============================================
// Groq API কল (রিট্রাই + টাইমআউট সহ, আরও রিলায়েবল)
// =============================================
async function callGroqAPI(userMessage, language) {
    const isBn = (language === 'bn');
    const messages = [
        { role: 'system', content: buildSystemPrompt(isBn) },
        ...conversationHistory,
        { role: 'user', content: userMessage }
    ];

    for (let attempt = 0; attempt <= GROQ_MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

        try {
            const response = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    messages,
                    temperature: 0.7,
                    max_completion_tokens: 350,
                    top_p: 1,
                    reasoning_effort: 'low',
                    include_reasoning: false,
                    stream: false
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error(`Groq API error (status ${response.status}, attempt ${attempt + 1}):`, errorData);
                // ৪xx (যেমন 401 বাড key ভুল/বন্ধ) হলে রিট্রাই করে লাভ নেই
                if (response.status >= 400 && response.status < 500) return null;
                continue; // 5xx হলে রিট্রাই ট্রাই করবে
            }

            const data = await response.json();
            const reply = data.choices?.[0]?.message?.content || null;
            return reply ? stripBold(reply) : null;

        } catch (error) {
            clearTimeout(timeoutId);
            console.error(`Groq API call failed (attempt ${attempt + 1}):`, error);
        }
    }

    return null;
}

// =============================================
// PARSE USER MESSAGE FOR BLOOD GROUP & LOCATION
// =============================================
function parseUserQuery(text) {
    const lower = text.toLowerCase();
    const match = text.match(BLOOD_GROUP_PATTERN);
    const bloodGroup = match ? match[0].toUpperCase() : null;

    const locationKeywords = ['dhaka', 'chittagong', 'sylhet', 'khulna', 'rajshahi', 'barisal', 'rangpur', 'mymensingh', 'gulshan', 'banani', 'mirpur', 'uttara', 'dhanmondi', 'mohammadpur'];
    let location = null;
    for (const word of locationKeywords) {
        if (lower.includes(word)) {
            location = word.charAt(0).toUpperCase() + word.slice(1);
            break;
        }
    }

    return { bloodGroup, location };
}

// =============================================
// SEARCH DONORS FROM FIRESTORE (ভাষা অনুযায়ী)
// =============================================
async function searchDonors(query, language) {
    const { bloodGroup, location } = parseUserQuery(query);

    if (!bloodGroup) {
        const msg = language === 'bn'
            ? 'আমি বুঝতে পারিনি কোন ব্লাড গ্রুপ লাগবে। দয়া করে A+, O- ইত্যাদি উল্লেখ করুন।'
            : "I couldn't understand which blood group you need. Please mention a blood group like O+, A-, B+, etc.";
        return { found: false, message: msg };
    }

    try {
        const snapshot = await firebase.firestore()
            .collection('users')
            .where('isDonor', '==', true)
            .where('bloodGroup', '==', bloodGroup)
            .get();

        let donors = [];
        snapshot.forEach(doc => donors.push(doc.data()));

        if (location) {
            const loc = location.toLowerCase();
            donors = donors.filter(d => {
                const city = (d.location?.city || '').toLowerCase();
                const area = (d.location?.area || '').toLowerCase();
                return city.includes(loc) || area.includes(loc);
            });
        }

        if (donors.length === 0) {
            const msg = language === 'bn'
                ? `কোন ডোনার পাওয়া যায়নি ${bloodGroup} গ্রুপের${location ? ` ${location} এলাকায়` : ''}। অন্য গ্রুপ ট্রাই করুন অথবা ডোনার হন!`
                : `No donors found with blood group ${bloodGroup}${location ? ` in ${location}` : ''}. Try a different group or become a donor yourself!`;
            return { found: false, message: msg };
        }

        let response = language === 'bn'
            ? `${donors.length} জন ডোনার পাওয়া গেছে ${bloodGroup} গ্রুপের${location ? ` ${location} এলাকায়` : ''}:\n\n`
            : `I found ${donors.length} donor(s) with blood group ${bloodGroup}${location ? ` near ${location}` : ''}:\n\n`;

        donors.forEach((d, i) => {
            const name = d.name || 'Unknown';
            const phone = d.phone || 'N/A';
            const city = d.location?.city || 'N/A';
            const area = d.location?.area || 'N/A';
            response += `🔹 ${i + 1}. ${name} – ${bloodGroup} (${city}, ${area}) 📞 ${phone}\n`;
        });

        response += language === 'bn'
            ? '\nযোগাযোগ করতে ড্যাশবোর্ডে তাদের কার্ডে Talk বা Call বাটন ট্যাপ করুন!'
            : '\nTap Talk or Call on their card in the dashboard to contact them!';
        return { found: true, message: response };

    } catch (error) {
        console.error('Error searching donors:', error);
        const msg = language === 'bn'
            ? 'দুঃখিত, ডোনার খোঁজা সম্ভব হচ্ছে না। পরে আবার চেষ্টা করুন।'
            : "Sorry, I couldn't search for donors right now. Please try again later.";
        return { found: false, message: msg };
    }
}

// =============================================
// স্মার্ট রেস্পন্স (পার্সিং → ডোনার → Groq)
// =============================================
async function getSmartResponse(text) {
    const lang = detectLanguage(text);

    // ১. Knowledge Base থেকে খোঁজ (দ্রুততম, নেটওয়ার্ক লাগে না)
    const kbAnswer = getAnswerFromKB(text, lang);
    if (kbAnswer) {
        console.log('✅ Knowledge Base match:', text);
        return kbAnswer;
    }

    // ২. ব্লাড গ্রুপ → ডোনার সার্চ
    if (BLOOD_GROUP_PATTERN.test(text)) {
        const donorResult = await searchDonors(text, lang);
        if (donorResult.found !== undefined) return donorResult.message;
    }

    // ৩. Groq API (কথোপকথনের প্রসঙ্গসহ, তাই আরও বুদ্ধিমান ও প্রাসঙ্গিক)
    console.log('🔄 Calling Groq for:', text);
    const groqReply = await callGroqAPI(text, lang);
    if (groqReply) return groqReply;

    // ৪. Groq আনরিচেবল হলে স্পষ্ট বার্তা
    return lang === 'bn'
        ? 'AI সার্ভিস বর্তমানে অনুপলব্ধ। একটু পর আবার চেষ্টা করুন।'
        : 'AI service is currently unavailable. Please try again in a moment.';
}

// =============================================
// SEND MESSAGE
// =============================================
async function sendMessage() {
    if (isProcessing) return;
    const input = document.getElementById('chatInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    isProcessing = true;
    addMessage('user', text);
    input.value = '';
    showTyping();

    try {
        const reply = await getSmartResponse(text);
        const finalReply = personalize(reply);

        // কথোপকথনের ইতিহাস আপডেট (পরবর্তী প্রশ্নের প্রসঙ্গের জন্য — AI আরও বুদ্ধিমান উত্তর দেয়)
        conversationHistory.push({ role: 'user', content: text });
        conversationHistory.push({ role: 'assistant', content: reply });
        if (conversationHistory.length > MAX_HISTORY_TURNS * 2) {
            conversationHistory = conversationHistory.slice(-MAX_HISTORY_TURNS * 2);
        }

        removeTyping();
        addMessage('ai', finalReply);
    } catch (error) {
        console.error('Send error:', error);
        removeTyping();
        addMessage('ai', 'একটু সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
    isProcessing = false;
}

// =============================================
// QUICK SUGGESTION
// =============================================
function sendQuickMessage(text) {
    document.getElementById('chatInput').value = text;
    sendMessage();
}

// =============================================
// TYPING INDICATOR
// =============================================
function showTyping() {
    const container = document.getElementById('chatMessages');
    if (!container || document.getElementById('typingIndicator')) return;
    const el = document.createElement('div');
    el.className = 'message ai-message typing-indicator-wrapper';
    el.id = 'typingIndicator';
    el.innerHTML = `
        ${aiAvatarHTML()}
        <div class="typing-indicator"><span></span><span></span><span></span></div>
    `;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
}

function removeTyping() {
    document.getElementById('typingIndicator')?.remove();
}

// =============================================
// AVATAR HELPERS (কোড অপটিমাইজেশন — ডুপ্লিকেট HTML সরানো হয়েছে)
// =============================================
function aiAvatarHTML() {
    return `
        <div class="avatar ai-avatar" style="background:#2c3e50; overflow:hidden; border:2px solid #2c3e50; border-radius:50%;">
            <img src="assets/Crescentlogo.jpeg" alt="Crescent AI" style="width:100%; height:100%; object-fit:contain; padding:3px; border-radius:50%;" />
        </div>
    `;
}

function userAvatarHTML() {
    const imgSrc = userProfilePic && (userProfilePic.startsWith('data:image') || userProfilePic.startsWith('http'))
        ? userProfilePic
        : `https://ui-avatars.com/api/?name=${userName.charAt(0).toUpperCase()}&background=2c3e50&color=fff&size=64&bold=true`;
    return `
        <div class="avatar user-avatar" style="background:#2c3e50; overflow:hidden; border:2px solid #2c3e50; border-radius:50%;">
            <img src="${imgSrc}" alt="${userName}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />
        </div>
    `;
}

// =============================================
// ADD MESSAGE
// =============================================
function addMessage(type, text) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `message ${type}-message`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const avatarHTML = type === 'ai' ? aiAvatarHTML() : userAvatarHTML();
    const bubble = `<div class="bubble"><p>${text.replace(/\n/g, '<br>')}</p><span class="timestamp">${time}</span></div>`;
    div.innerHTML = type === 'ai' ? avatarHTML + bubble : bubble + avatarHTML;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    if (type === 'user') {
        const chips = document.getElementById('suggestionChips');
        if (chips) chips.style.display = 'none';
    }
}

// =============================================
// FETCH CURRENT USER PROFILE PICTURE & NAME
// =============================================
async function loadUserProfile() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    currentUser = user;

    const fallbackAvatar = (name) =>
        `https://ui-avatars.com/api/?name=${name.charAt(0).toUpperCase()}&background=2c3e50&color=fff&size=64&bold=true`;

    try {
        const doc = await firebase.firestore().collection('users').doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();
            userName = data.name || user.displayName || 'User';
            userProfilePic = (data.profilePic && typeof data.profilePic === 'string' &&
                (data.profilePic.startsWith('data:image') || data.profilePic.startsWith('http')))
                ? data.profilePic
                : fallbackAvatar(userName);
        } else {
            userName = user.displayName || 'User';
            userProfilePic = fallbackAvatar(userName);
        }
        console.log('👤 User:', userName, '| Profile pic:', userProfilePic ? '✅ Set' : '❌ Not set');
    } catch (error) {
        console.error('Error loading user profile:', error);
        userName = user.displayName || 'User';
        userProfilePic = fallbackAvatar(userName);
    }
}

// =============================================
// ENTER KEY HANDLER
// =============================================
document.addEventListener('DOMContentLoaded', async function () {
    console.log('🚀 Crescent AI loaded (Parsing + Groq + Donor Search)');
    await loadUserProfile();

    const input = document.getElementById('chatInput');
    if (input) {
        input.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    const sendBtn = document.querySelector('.chat-input-area button');
    if (sendBtn) {
        sendBtn.addEventListener('click', function (e) {
            e.preventDefault();
            sendMessage();
        });
    }
});

// =============================================
// ALSO RELOAD ON AUTH STATE CHANGE
// =============================================
firebase.auth().onAuthStateChanged(async function (user) {
    if (user) await loadUserProfile();
});