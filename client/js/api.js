/**
 * ====================================================================
 * IDP ROLE-BASED E-COMMERCE WEB APPLICATION
 * CUSTOM AJAX HTTP CLIENT UTILITY (FRAMEWORK-FREE FETCH)
 * ====================================================================
 * 
 * Provides unified GET, POST, PUT, and DELETE API fetch requests.
 * Automatically injects authorization session tokens from localStorage
 * and handles standard REST error toasts.
 */

const API_BASE = ''; // Same-origin host URL

const API = {
    /**
     * Set credentials token in storage.
     */
    setToken(token) {
        localStorage.setItem('idp_auth_token', token);
    },

    /**
     * Get credentials token from storage.
     */
    getToken() {
        return localStorage.getItem('idp_auth_token');
    },

    /**
     * Clear credentials session.
     */
    clearSession() {
        localStorage.removeItem('idp_auth_token');
        localStorage.removeItem('idp_user_profile');
    },

    /**
     * Make unified HTTP request using fetch.
     */
    async request(endpoint, method = 'GET', body = null) {
        const url = `${API_BASE}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json'
        };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            method,
            headers
        };

        if (body && ['POST', 'PUT', 'DELETE'].includes(method)) {
            config.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                // Trigger auto logout if token expired
                if (response.status === 401 && endpoint !== '/api/auth/login') {
                    this.clearSession();
                    window.location.href = '/pages/login.html?session_expired=true';
                }
                throw new Error(data.error?.message || `Request failed with status ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`>> [API Client Error] Route: ${endpoint} failed.`, error.message);
            throw error;
        }
    },

    get(endpoint) {
        return this.request(endpoint, 'GET');
    },

    post(endpoint, body) {
        return this.request(endpoint, 'POST', body);
    },

    put(endpoint, body) {
        return this.request(endpoint, 'PUT', body);
    },

    delete(endpoint, body) {
        return this.request(endpoint, 'DELETE', body);
    }
};
