/** @odoo-module **/

(function () {
    'use strict';

    const EYE_ICON_SVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-svg">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>
    `;

    const EYE_SLASH_ICON_SVG = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-svg eye-slash">
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"></path>
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"></path>
            <line x1="2" x2="22" y1="2" y2="22"></line>
        </svg>
    `;

    function initPasswordToggle() {
        const passwordInputs = document.querySelectorAll('input[type="password"], input[name="password"], #password');

        passwordInputs.forEach((input) => {
            if (input.dataset.passwordToggleInitialized === 'true') {
                return;
            }
            input.dataset.passwordToggleInitialized = 'true';

            // Wrap input in a dedicated relative wrapper
            let wrapper = input.parentElement;
            if (!wrapper.classList.contains('password-input-wrapper')) {
                wrapper = document.createElement('div');
                wrapper.className = 'password-input-wrapper';
                input.parentNode.insertBefore(wrapper, input);
                wrapper.appendChild(input);
            }

            // Remove any old toggle button
            const existingBtn = wrapper.querySelector('.password-toggle-btn');
            if (existingBtn) {
                existingBtn.remove();
            }

            // Create eye toggle button
            const toggleBtn = document.createElement('button');
            toggleBtn.type = 'button';
            toggleBtn.className = 'password-toggle-btn';
            toggleBtn.setAttribute('aria-label', 'Toggle password visibility');
            toggleBtn.setAttribute('title', 'Show / Hide Password');
            toggleBtn.innerHTML = EYE_ICON_SVG;

            // Prevent button click from losing input focus or submitting form
            toggleBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });

            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const isPassword = input.getAttribute('type') === 'password';
                if (isPassword) {
                    input.setAttribute('type', 'text');
                    toggleBtn.innerHTML = EYE_SLASH_ICON_SVG;
                    toggleBtn.classList.add('visible');
                } else {
                    input.setAttribute('type', 'password');
                    toggleBtn.innerHTML = EYE_ICON_SVG;
                    toggleBtn.classList.remove('visible');
                }
            });

            wrapper.appendChild(toggleBtn);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPasswordToggle);
    } else {
        initPasswordToggle();
    }

    window.addEventListener('load', initPasswordToggle);
    setTimeout(initPasswordToggle, 100);
    setTimeout(initPasswordToggle, 400);
    setTimeout(initPasswordToggle, 1000);
})();
