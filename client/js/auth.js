/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * AUTHENTICATION SESSION MANAGER & SECURITY GUARDS
 * ====================================================================
 * 
 * Manages local user profile states and handles role-based frontend
 * page-redirection guards.
 */

const Auth = {
    /**
     * Cache auth credentials in localStorage.
     */
    saveSession(token, user) {
        API.setToken(token);
        localStorage.setItem('idp_user_profile', JSON.stringify(user));
        this.applyTheme();
    },

    /**
     * Retrieve user profile from session storage.
     */
    getUser() {
        const userStr = localStorage.getItem('idp_user_profile');
        if (!userStr) return null;
        try {
            return JSON.parse(userStr);
        } catch (e) {
            return null;
        }
    },

    /**
     * End active session.
     */
    logout() {
        API.clearSession();
        localStorage.removeItem('idp_user_profile');
        this.applyTheme();
        window.location.href = '/pages/login.html';
    },

    /**
     * Enforce auth state validation on page load.
     * Prevents users from manually bypassing page roles in the URL.
     */
    checkPageGuard(allowedRoleIds = null) {
        const user = this.getUser();
        const token = API.getToken();

        // 1. Not logged in
        if (!token || !user) {
            this.logout();
            return false;
        }

        // 2. Logged in, check role permissions
        if (allowedRoleIds && !allowedRoleIds.includes(Number(user.roleId))) {
            console.warn('>> [Security Guard] Unauthorized dashboard access. Redirecting to appropriate role console...');
            this.redirectDashboard(user.roleId);
            return false;
        }

        this.applyTheme();
        return true;
    },

    /**
     * Router mapping account role IDs to their exact home dash URLs.
     */
    redirectDashboard(roleId) {
        const id = Number(roleId);
        if (id === 1) {
            window.location.href = '/pages/admin.html';
        } else if (id === 2) {
            window.location.href = '/pages/seller.html';
        } else if (id === 3) {
            window.location.href = '/pages/customer.html';
        } else if (id === 4) {
            window.location.href = '/pages/service.html';
        } else {
            window.location.href = '/';
        }
    },

    /**
     * Apply the user's role theme to the body element.
     */
    applyTheme() {
        const user = this.getUser();
        document.body.classList.remove('theme-admin', 'theme-seller', 'theme-customer', 'theme-service');
        if (user && user.roleId) {
            const roleId = Number(user.roleId);
            const themes = {
                1: 'theme-admin',
                2: 'theme-seller',
                3: 'theme-customer',
                4: 'theme-service'
            };
            const themeClass = themes[roleId];
            if (themeClass) {
                document.body.classList.add(themeClass);
            }
        }
    }
};

// Auto-apply theme on script load
document.addEventListener('DOMContentLoaded', () => {
    Auth.applyTheme();
});
