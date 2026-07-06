/**
 * ====================================================================
 * EDUSHOP WEBSITE ASSISTANT — CHATBOT UI CONTROLLER (chatbot-ui.js)
 * ====================================================================
 *
 * Manages the floating chat widget: rendering, animations, message
 * threading, typing indicators, quick replies, and auto-scroll.
 *
 * Dependencies (load order):
 *  1. knowledge-base.json  (fetched async)
 *  2. chatbot-engine.js    (provides ChatbotEngine class)
 *  3. chatbot-ui.js        (this file)
 *
 * Features:
 *  - Floating toggle button with pulse animation
 *  - Expand/collapse chat window with smooth animation
 *  - Typing indicator (3-dot animation)
 *  - Quick reply buttons: Order Help, Delivery, Contact, Seller, Payments
 *  - Conversation history with timestamps
 *  - Auto-scroll to latest message
 *  - Mobile responsive
 *  - Unread badge counter
 */

(function () {
    'use strict';

    // ─── Configuration ────────────────────────────────────────────────
    const CONFIG = {
        knowledgeBaseUrl: '/js/chatbot/knowledge-base.json',
        botName:         'EduBot',
        botAvatar:       '🎓',
        typingDelay:     { min: 600, max: 1400 },
        welcomeMessage:  "Hi there! 👋 I'm **EduBot**, your EduShop assistant. I can help you with orders, products, shipping, and more!\n\nWhat can I help you with today?",
        quickReplies: [
            { label: '🛒 Order Help',       query: 'How can I place an order?' },
            { label: '🚚 Delivery Info',     query: 'How does delivery work?' },
            { label: '💳 Payment Methods',   query: 'What payment methods are available?' },
            { label: '🏪 Become a Seller',   query: 'How can I become a seller?' },
            { label: '📞 Contact Us',        query: 'How can I contact support?' }
        ]
    };

    // ─── State ────────────────────────────────────────────────────────
    let engine          = null;
    let isOpen          = false;
    let isTyping        = false;
    let unreadCount     = 0;
    let messageHistory  = [];

    // ─── DOM References ───────────────────────────────────────────────
    let chatWidget, chatToggleBtn, chatWindow, chatMessages,
        chatInput, chatSendBtn, unreadBadge, chatStatus;

    // ─── Utility: Format timestamp ────────────────────────────────────
    function formatTime(date) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    // ─── Utility: Markdown-lite renderer (bold, line breaks, links) ────
    function renderMarkdown(text) {
        if (!text) return '';
        return text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/<a /g, '<a target="_blank" ');
    }

    // ─── Build Widget HTML ────────────────────────────────────────────
    function buildWidget() {
        const wrapper = document.createElement('div');
        wrapper.id = 'edushop-chatbot';
        wrapper.innerHTML = `
            <!-- Toggle Button -->
            <button class="edubot-toggle-btn" id="edubotToggleBtn" aria-label="Open EduShop Assistant">
                <span class="edubot-icon-open">💬</span>
                <span class="edubot-icon-close">✕</span>
                <span class="edubot-unread-badge" id="edubotUnreadBadge" style="display:none;">0</span>
            </button>

            <!-- Chat Window -->
            <div class="edubot-window" id="edubotWindow" role="dialog" aria-label="EduShop Assistant Chat">

                <!-- Header -->
                <div class="edubot-header">
                    <div class="edubot-header-info">
                        <div class="edubot-bot-avatar">${CONFIG.botAvatar}</div>
                        <div class="edubot-header-text">
                            <div class="edubot-bot-name">${CONFIG.botName}</div>
                            <div class="edubot-status" id="edubotStatus">
                                <span class="edubot-status-dot"></span>
                                <span class="edubot-status-text">Online</span>
                            </div>
                        </div>
                    </div>
                    <button class="edubot-close-btn" id="edubotCloseBtn" aria-label="Close chat">✕</button>
                </div>

                <!-- Messages Container -->
                <div class="edubot-messages" id="edubotMessages" role="log" aria-live="polite"></div>

                <!-- Quick Replies -->
                <div class="edubot-quick-replies" id="edubotQuickReplies">
                    ${CONFIG.quickReplies.map(qr => `
                        <button class="edubot-quick-reply-btn" data-query="${qr.query}">${qr.label}</button>
                    `).join('')}
                </div>

                <!-- Input Area -->
                <div class="edubot-input-area">
                    <textarea
                        id="edubotInput"
                        class="edubot-input"
                        placeholder="Ask me anything about EduShop..."
                        rows="1"
                        maxlength="500"
                        aria-label="Type your message"
                    ></textarea>
                    <button class="edubot-send-btn" id="edubotSendBtn" aria-label="Send message">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>

                <!-- Footer -->
                <div class="edubot-footer">
                    Powered by <strong>EduShop AI</strong>
                </div>
            </div>
        `;
        document.body.appendChild(wrapper);
    }

    // ─── Bind DOM References ──────────────────────────────────────────
    function bindDOMRefs() {
        chatWidget    = document.getElementById('edushop-chatbot');
        chatToggleBtn = document.getElementById('edubotToggleBtn');
        chatWindow    = document.getElementById('edubotWindow');
        chatMessages  = document.getElementById('edubotMessages');
        chatInput     = document.getElementById('edubotInput');
        chatSendBtn   = document.getElementById('edubotSendBtn');
        unreadBadge   = document.getElementById('edubotUnreadBadge');
        chatStatus    = document.getElementById('edubotStatus');
    }

    // ─── Toggle Chat Open/Closed ──────────────────────────────────────
    function toggleChat() {
        isOpen = !isOpen;
        chatWidget.classList.toggle('edubot-open', isOpen);

        if (isOpen) {
            // Reset unread badge
            unreadCount = 0;
            unreadBadge.style.display = 'none';
            unreadBadge.textContent = '0';
            setTimeout(() => chatInput.focus(), 350);
            scrollToBottom();
        }
    }

    // ─── Open Chat ────────────────────────────────────────────────────
    function openChat() {
        if (!isOpen) toggleChat();
    }

    // ─── Scroll Messages to Bottom ────────────────────────────────────
    function scrollToBottom() {
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 50);
    }

    // ─── Append Message to Thread ─────────────────────────────────────
    function appendMessage(role, text, isHTML = false) {
        const isBot = role === 'bot';
        const now   = new Date();
        const msgId = 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2);

        messageHistory.push({ role, text, timestamp: now });

        const msgEl = document.createElement('div');
        msgEl.className = `edubot-message ${isBot ? 'bot-message' : 'user-message'}`;
        msgEl.id = msgId;

        const contentHTML = isHTML ? text : renderMarkdown(text);

        msgEl.innerHTML = `
            ${isBot ? `<div class="edubot-msg-avatar">${CONFIG.botAvatar}</div>` : ''}
            <div class="edubot-msg-bubble">
                <div class="edubot-msg-content">${contentHTML}</div>
                <div class="edubot-msg-time">${formatTime(now)}</div>
            </div>
        `;

        chatMessages.appendChild(msgEl);

        // Animate in
        requestAnimationFrame(() => {
            msgEl.classList.add('msg-visible');
        });

        scrollToBottom();

        // Update unread badge if chat is closed
        if (!isOpen && isBot) {
            unreadCount++;
            unreadBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            unreadBadge.style.display = 'flex';
        }

        return msgId;
    }

    // ─── Show/Hide Typing Indicator ───────────────────────────────────
    function showTyping() {
        if (isTyping) return;
        isTyping = true;

        const typingEl = document.createElement('div');
        typingEl.className = 'edubot-message bot-message edubot-typing-indicator-wrapper';
        typingEl.id = 'edubotTypingIndicator';
        typingEl.innerHTML = `
            <div class="edubot-msg-avatar">${CONFIG.botAvatar}</div>
            <div class="edubot-msg-bubble">
                <div class="edubot-typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        chatMessages.appendChild(typingEl);
        requestAnimationFrame(() => typingEl.classList.add('msg-visible'));
        scrollToBottom();
    }

    // ─── Hide Typing ──────────────────────────────────────────────────
    function hideTyping() {
        isTyping = false;
        const el = document.getElementById('edubotTypingIndicator');
        if (el) el.remove();
    }

    // ─── Show Quick Replies ───────────────────────────────────────────
    function showQuickReplies() {
        const container = document.getElementById('edubotQuickReplies');
        if (container) container.style.display = 'flex';
    }

    // ─── Hide Quick Replies ───────────────────────────────────────────
    function hideQuickReplies() {
        const container = document.getElementById('edubotQuickReplies');
        if (container) container.style.display = 'none';
    }

    // ─── Process & Send User Message ─────────────────────────────────
    async function sendMessage(text) {
        const trimmed = text.trim();
        if (!trimmed || isTyping) return;

        // Hide quick replies after first real interaction
        hideQuickReplies();

        // Show user message
        appendMessage('user', trimmed);
        chatInput.value = '';
        chatInput.style.height = 'auto';
        chatSendBtn.disabled = true;

        // Show typing indicator
        showTyping();

        // Simulate realistic typing delay
        const delay = CONFIG.typingDelay.min + Math.random() * (CONFIG.typingDelay.max - CONFIG.typingDelay.min);

        try {
            const result = await engine.respond(trimmed);
            await new Promise(resolve => setTimeout(resolve, delay));
            hideTyping();
            appendMessage('bot', result.answer);
        } catch (err) {
            await new Promise(resolve => setTimeout(resolve, 500));
            hideTyping();
            appendMessage('bot', "I'm having trouble right now. Please try again or contact support at **support@edushop.edu**.");
        } finally {
            chatSendBtn.disabled = false;
            chatInput.focus();
        }
    }

    // ─── Event Listeners ─────────────────────────────────────────────
    function bindEvents() {
        // Toggle open/close
        chatToggleBtn.addEventListener('click', toggleChat);
        document.getElementById('edubotCloseBtn').addEventListener('click', toggleChat);

        // Send on button click
        chatSendBtn.addEventListener('click', () => {
            sendMessage(chatInput.value);
        });

        // Send on Enter (Shift+Enter = new line)
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(chatInput.value);
            }
        });

        // Auto-resize textarea
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
        });

        // Quick reply buttons
        document.querySelectorAll('.edubot-quick-reply-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.getAttribute('data-query');
                if (query) sendMessage(query);
            });
        });

        // Close on outside click (mobile UX)
        document.addEventListener('click', (e) => {
            if (isOpen && !chatWidget.contains(e.target)) {
                // Only close on mobile
                if (window.innerWidth <= 480) {
                    toggleChat();
                }
            }
        });
    }

    // ─── Send Welcome Message ─────────────────────────────────────────
    function sendWelcome() {
        setTimeout(() => {
            appendMessage('bot', CONFIG.welcomeMessage);
        }, 500);
    }

    // ─── Load Knowledge Base and Initialize Engine ────────────────────
    async function loadKnowledgeBase() {
        try {
            const response = await fetch(CONFIG.knowledgeBaseUrl);
            if (!response.ok) throw new Error('KB fetch failed: ' + response.status);
            const data = await response.json();
            return data.entries || [];
        } catch (err) {
            console.warn('[EduBot] Failed to load knowledge base:', err.message);
            return [];
        }
    }

    // ─── Initialize Chatbot ───────────────────────────────────────────
    async function init() {
        // 1. Build the DOM widget
        buildWidget();

        // 2. Bind DOM references
        bindDOMRefs();

        // 3. Bind events
        bindEvents();

        // 4. Load knowledge base and create engine
        const entries = await loadKnowledgeBase();
        engine = new ChatbotEngine(entries, {
            minScore: 0.2,
            fallbackMessage: "Sorry, I couldn't find an exact answer to that. Please contact our support team at <strong>support@edushop.edu</strong> or visit our <a href='/pages/contact.html' style='color:#6366f1;text-decoration:underline;'>Contact Page</a>."
        });

        // 5. Show welcome message after a short delay
        sendWelcome();

        console.log('[EduBot] Chatbot initialized with', entries.length, 'knowledge base entries.');
    }

    // ─── Auto-init on DOM Ready ───────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
