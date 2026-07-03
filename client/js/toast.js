/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * CUSTOM TOAST NOTIFICATION ENGINE (FRAMEWORK-FREE TOASTS)
 * ====================================================================
 * 
 * Replaces browser native alert() dialogs with modern, non-blocking
 * self-dismissing toast notification panels with rich role-compatible aesthetics.
 */

const Toast = {
    /**
     * Internal container creation guard
     */
    _getContainer() {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    },

    /**
     * Spawn a new toast instance
     */
    show(message, type = 'info', duration = 4000) {
        const container = this._getContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;
        
        // Define icons based on notification type
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        const icon = icons[type] || icons.info;

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-message">${message}</div>
            <div class="toast-close">&times;</div>
            <div class="toast-progress"></div>
        `;

        container.appendChild(toast);

        // Close button click handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.dismiss(toast));

        // Auto dismiss timeout
        const timeoutId = setTimeout(() => {
            this.dismiss(toast);
        }, duration);

        toast.dataset.timeoutId = timeoutId;
    },

    /**
     * Gracefully animate out and destroy toast DOM element
     */
    dismiss(toast) {
        if (toast.classList.contains('dismissing')) return;
        toast.classList.add('dismissing');

        // Clear automatic timeout if manually dismissed
        if (toast.dataset.timeoutId) {
            clearTimeout(Number(toast.dataset.timeoutId));
        }

        // Wait for CSS animation to finish before removing
        toast.addEventListener('animationend', (e) => {
            if (e.animationName === 'toastSlideOut') {
                toast.remove();
            }
        });
    },

    success(message, duration) { this.show(message, 'success', duration); },
    error(message, duration) { this.show(message, 'error', duration); },
    warning(message, duration) { this.show(message, 'warning', duration); },
    info(message, duration) { this.show(message, 'info', duration); }
};
