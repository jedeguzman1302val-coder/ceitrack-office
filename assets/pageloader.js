/* ========== CEITrack Page Loader Script - Minimal & Fixed Timing ========== */

/**
 * Auto-typing animation for CEITrack text with colors and pin icon
 */
function animateCEITrack() {
    const text = "CEITrack";
    const container = document.querySelector('.loader-typing-text');
    
    if (!container) return;
    
    // Clear any existing content
    container.innerHTML = '';
    
    // Create each character with staggered animation (no colors, just black)
    text.split('').forEach((char, index) => {
        if (char === 'I') {
            // Replace "I" with pin.gif
            const img = document.createElement('img');
            img.src = '../assets/pin.gif';
            img.className = 'char pin-icon';
            img.alt = 'I';
            img.style.animationDelay = `${index * 0.08}s`;
            container.appendChild(img);
        } else {
            const span = document.createElement('span');
            span.className = 'char';
            span.textContent = char;
            span.style.animationDelay = `${index * 0.08}s`;
            container.appendChild(span);
        }
    });
}

/**
 * Hide the CEITrack page loader
 */
function hidePageLoader() {
    const loader = document.querySelector('.ceitrack-page-loader');
    
    if (loader) {
        loader.classList.add('fade-out');
        // Re-enable body scrolling
        document.body.classList.remove('loading');
        setTimeout(() => {
            loader.remove();
        }, 400);
    }
}

/**
 * Initialize page loader - with manual control option
 */
function initPageLoader(autoHide = true) {
    // Start typing animation after a brief moment
    setTimeout(() => {
        animateCEITrack();
    }, 100);
    
    // Only auto-hide if specified (for dashboard, we want manual control)
    if (autoHide) {
        window.addEventListener('load', () => {
            // Minimum display time of 3 seconds for smooth animation
            setTimeout(() => {
                hidePageLoader();
            }, 3000);
        });
    }
}

// Auto-initialize with manual control (no auto-hide for dashboard)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initPageLoader(false));
} else {
    initPageLoader(false);
}

// Export functions for manual control
window.CEITrackLoader = {
    hide: hidePageLoader,
    init: initPageLoader
};