/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE ACCELERATED ANIMATIONS ENGINE
 * ====================================================================
 * 
 * Provides IntersectionObserver animations for scroll revealing,
 * typewriter printing effects, and statistical counting tickers.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inject animation styles into document dynamically
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
        .scroll-reveal {
            opacity: 0 !important;
            transform: translateY(30px) !important;
            transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), 
                        transform 0.8s cubic-bezier(0.4, 0, 0.2, 1) !important;
            will-change: transform, opacity;
        }
        .scroll-reveal.revealed {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(styleEl);

    // 2. IntersectionObserver for Scroll Revealing
    const revealElements = document.querySelectorAll('.scroll-reveal');
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                // Trigger nested text counters or typing effects
                const counter = entry.target.querySelector('.number-counter');
                if (counter && !counter.classList.contains('counted')) {
                    animateCounter(counter);
                }
                const typer = entry.target.querySelector('.typewriter-text');
                if (typer && !typer.classList.contains('typed')) {
                    animateTyping(typer);
                }
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));

    // 3. Dynamic Number Counters
    function animateCounter(el) {
        el.classList.add('counted');
        const targetVal = parseFloat(el.getAttribute('data-target') || el.innerText.replace(/[^0-9.]/g, ''));
        const duration = 2000; // 2 seconds animation
        const startTimestamp = performance.now();
        const startVal = 0;
        const prefix = el.getAttribute('data-prefix') || '';
        const suffix = el.getAttribute('data-suffix') || '';

        function step(now) {
            const progress = Math.min((now - startTimestamp) / duration, 1);
            // Ease out quad
            const easeProgress = progress * (2 - progress);
            const currentVal = easeProgress * (targetVal - startVal) + startVal;

            if (targetVal % 1 === 0) {
                el.innerText = `${prefix}${Math.floor(currentVal)}${suffix}`;
            } else {
                el.innerText = `${prefix}${currentVal.toFixed(2)}${suffix}`;
            }

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                el.innerText = `${prefix}${targetVal.toLocaleString()}${suffix}`;
            }
        }
        window.requestAnimationFrame(step);
    }

    // 4. Typewriter Effects
    function animateTyping(el) {
        el.classList.add('typed');
        const text = el.getAttribute('data-text') || el.innerText;
        el.innerText = '';
        let index = 0;
        const speed = parseInt(el.getAttribute('data-speed')) || 50;

        function type() {
            if (index < text.length) {
                el.innerText += text.charAt(index);
                index++;
                setTimeout(type, speed);
            }
        }
        type();
    }

    // Expose helpers globally for dynamic elements
    window.AppAnimations = {
        observeAll() {
            document.querySelectorAll('.scroll-reveal:not(.revealed)').forEach(el => {
                revealObserver.observe(el);
            });
        },
        triggerCounter(el) {
            if (!el.classList.contains('counted')) {
                animateCounter(el);
            }
        },
        triggerTyping(el) {
            if (!el.classList.contains('typed')) {
                animateTyping(el);
            }
        }
    };
});
