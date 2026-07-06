/**
 * ====================================================================
 * EDUSHOP WEBSITE ASSISTANT — CHATBOT ENGINE (chatbot-engine.js)
 * ====================================================================
 *
 * Modular, future-ready chatbot engine that powers the knowledge-base
 * search and response logic.
 *
 * Architecture:
 *  - ChatbotEngine class with a single public method: respond(message)
 *  - Multi-layered matching: keyword → partial → similarity scoring
 *  - Configurable threshold for fallback responses
 *  - AI-Upgrade Ready: swap the internal matching logic for an
 *    OpenAI / Gemini / DeepSeek API call without changing the UI layer.
 *    The ChatbotEngine.respond(message) contract stays identical.
 *
 * Future AI Upgrade Example:
 *  async respond(userMessage) {
 *    const res = await fetch('https://api.openai.com/v1/chat/completions', {...});
 *    return { answer: res.choices[0].message.content, confidence: 1.0 };
 *  }
 */

class ChatbotEngine {
    /**
     * @param {Array} knowledgeBase - Array of knowledge base entries
     * @param {Object} options
     * @param {number} options.minScore - Minimum score (0-1) to return a result (default: 0.2)
     * @param {string} options.fallbackMessage - Message when no match found
     */
    constructor(knowledgeBase = [], options = {}) {
        this.kb = knowledgeBase;
        this.minScore = options.minScore ?? 0.2;
        this.fallbackMessage = options.fallbackMessage ||
            "Sorry, I couldn't find an exact answer to your question. Please contact our support team at <strong>support@edushop.edu</strong> or visit our <a href='/pages/contact.html' style='color:#6366f1;'>Contact Page</a> for assistance.";

        // Pre-process knowledge base for faster lookups
        this._index = this._buildIndex();
    }

    // ─── Private: Build keyword index ────────────────────────────────
    _buildIndex() {
        return this.kb.map(entry => ({
            ...entry,
            _lowerQuestion: (entry.question || '').toLowerCase(),
            _lowerAnswer:   (entry.answer || '').toLowerCase(),
            _lowerKeywords: (entry.keywords || []).map(k => k.toLowerCase())
        }));
    }

    // ─── Private: Tokenize input into cleaned words ───────────────────
    _tokenize(text) {
        return text
            .toLowerCase()
            .replace(/[?!.,;:'"()\[\]{}]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 1);
    }

    // ─── Private: Stop words to ignore ───────────────────────────────
    _stopWords() {
        return new Set(['the','a','an','is','are','was','were','i','me','my',
            'can','could','would','should','do','does','did','will','be',
            'have','has','had','to','of','in','on','at','for','with',
            'this','that','these','those','it','its','and','or','not',
            'how','what','when','where','why','who','which','please','tell',
            'me','us','you','your','our','we','they','them','their']);
    }

    // ─── Private: Score a single entry against query tokens ──────────
    _scoreEntry(entry, queryTokens, stopWords) {
        let score = 0;
        const meaningful = queryTokens.filter(t => !stopWords.has(t) && t.length > 2);

        if (meaningful.length === 0) {
            // Only stop words — use all tokens
            meaningful.push(...queryTokens);
        }

        for (const token of meaningful) {
            // 1. Exact keyword match (highest weight)
            if (entry._lowerKeywords.some(kw => kw === token)) {
                score += 3;
            }
            // 2. Keyword contains the token (partial keyword match)
            else if (entry._lowerKeywords.some(kw => kw.includes(token) || token.includes(kw))) {
                score += 2;
            }
            // 3. Token appears in the question (medium weight)
            else if (entry._lowerQuestion.includes(token)) {
                score += 1.5;
            }
            // 4. Token appears in the answer (low weight)
            else if (entry._lowerAnswer.includes(token)) {
                score += 0.5;
            }
        }

        // Normalize score by number of meaningful tokens
        return meaningful.length > 0 ? score / meaningful.length : 0;
    }

    // ─── Private: Calculate Jaccard similarity between two token sets ─
    _jaccardSimilarity(setA, setB) {
        if (setA.size === 0 && setB.size === 0) return 0;
        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);
        return intersection.size / union.size;
    }

    // ─── Private: Find best match in knowledge base ───────────────────
    _findBestMatch(userMessage) {
        const queryTokens = this._tokenize(userMessage);
        const stopWords = this._stopWords();
        const querySet = new Set(queryTokens.filter(t => !stopWords.has(t)));

        let bestScore = 0;
        let bestEntry = null;

        for (const entry of this._index) {
            // Keyword + partial matching score
            const keywordScore = this._scoreEntry(entry, queryTokens, stopWords);

            // Jaccard similarity with question tokens
            const questionTokens = new Set(this._tokenize(entry._lowerQuestion).filter(t => !stopWords.has(t)));
            const jaccard = this._jaccardSimilarity(querySet, questionTokens);

            // Combined score (weighted)
            const totalScore = (keywordScore * 0.7) + (jaccard * 3 * 0.3);

            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestEntry = entry;
            }
        }

        return { entry: bestEntry, score: bestScore };
    }

    // ─── Public API: respond(userMessage) ────────────────────────────
    /**
     * Processes a user message and returns the best matching response.
     *
     * FUTURE AI UPGRADE: Replace this method's internals with an API call:
     *   const response = await openai.chat.completions.create({...});
     *   return { answer: response.choices[0].message.content, confidence: 1.0, source: 'ai' };
     *
     * The return signature stays the same, so ChatbotUI never needs changes.
     *
     * @param {string} userMessage
     * @returns {Promise<{answer: string, confidence: number, source: string, category: string}>}
     */
    async respond(userMessage) {
        if (!userMessage || userMessage.trim().length === 0) {
            return {
                answer: "Please type a question and I'll do my best to help you! 😊",
                confidence: 1.0,
                source: 'system',
                category: 'System'
            };
        }

        const { entry, score } = this._findBestMatch(userMessage.trim());

        if (entry && score >= this.minScore) {
            return {
                answer:     entry.answer,
                confidence: Math.min(score / 3, 1.0),
                source:     'knowledge-base',
                category:   entry.category
            };
        }

        // No confident match found
        return {
            answer:     this.fallbackMessage,
            confidence: 0,
            source:     'fallback',
            category:   'Unknown'
        };
    }

    /**
     * Get all entries for a specific category (used by quick replies).
     * @param {string} category
     * @returns {Array}
     */
    getByCategory(category) {
        return this.kb.filter(e =>
            e.category.toLowerCase() === category.toLowerCase()
        );
    }

    /**
     * Get a specific entry by ID.
     * @param {string} id
     * @returns {Object|null}
     */
    getById(id) {
        return this.kb.find(e => e.id === id) || null;
    }
}

// Export for use in chatbot-ui.js
window.ChatbotEngine = ChatbotEngine;
