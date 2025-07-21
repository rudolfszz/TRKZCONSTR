// Shared utility functions for client-side JavaScript

/**
 * Setup CSRF token handling for all fetch requests
 * This should be called once per page load
 */
export function setupCSRFProtection() {
    // Only setup once
    if (window.fetch.csrfSetup) return;
    
    const originalFetch = window.fetch;
    window.fetch = function(input, init = {}) {
        if (init && (!init.method || ['POST','PUT','DELETE'].includes(init.method.toUpperCase()))) {
            init.headers = init.headers || {};
            const csrfToken = window.localStorage.getItem('csrfToken') || document.querySelector('meta[name="csrf-token"]')?.content;
            if (csrfToken) {
                init.headers['x-csrf-token'] = csrfToken;
            }
        }
        return originalFetch(input, init);
    };
    
    // Mark as setup to prevent double setup
    window.fetch.csrfSetup = true;
    
    // Initialize CSRF token
    fetch('/user').then(res => res.json()).then(data => {
        if (data.csrfToken) {
            window.localStorage.setItem('csrfToken', data.csrfToken);
        }
    }).catch(() => {
        // Ignore errors during token fetch
    });
}

/**
 * Common error handlers for global error handling
 */
export function setupErrorHandlers() {
    // Only setup once
    if (window.errorHandlersSetup) return;
    
    window.addEventListener('error', function(e) {
        console.error('JavaScript error:', e.message, e.filename, e.lineno);
        // Don't show alert for minor errors in production
        if (window.location.hostname !== 'localhost') return;
        alert('A critical error occurred: ' + e.message);
    });
    
    window.addEventListener('unhandledrejection', function(e) {
        console.error('Unhandled promise rejection:', e.reason);
        // Don't show alert for minor errors in production
        if (window.location.hostname !== 'localhost') return;
        alert('A critical error occurred: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
    });
    
    window.errorHandlersSetup = true;
}

/**
 * Common DOM helper functions
 */
export function getElementById(id) {
    return document.getElementById(id);
}

export function createElement(tag, attributes = {}, textContent = '') {
    const element = document.createElement(tag);
    Object.keys(attributes).forEach(key => {
        element.setAttribute(key, attributes[key]);
    });
    if (textContent) {
        element.textContent = textContent;
    }
    return element;
}

/**
 * Common fetch wrapper with error handling
 */
export async function fetchWithErrorHandling(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

/**
 * Debounce function to limit how often a function can fire
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Setup common functionality for all pages
 */
export function initializeCommonFeatures() {
    setupCSRFProtection();
    setupErrorHandlers();
}
