let customTitle = null;
let maintain = true;
let debugMode = false;
let fallbackActive = false;
let pageTitle = "";
let originalTitle;
let notificationTimeout;

function log(...args) {
    if (debugMode) {
        console.log("%c[Content Script]", "color: cyan", ...args);
    }
}

// A simple implementation of the extension's core functionality for situations
// like when the injected script gets blocked by CORS.
function setupFallback() {
    log("[Fallback] USING FALLBACK TITLE MANAGEMENT");
    fallbackActive = true;

    const observer = new MutationObserver(() => {
        if (fallbackActive === false) {
            log("[Fallback] DISABLING FALLBACK TITLE MANAGEMENT");
            observer.disconnect();
        }
        if (customTitle === null && document.title !== pageTitle) {
            log("[Fallback] Saving page title as", document.title);
            pageTitle = document.title;
        }

        if (customTitle !== null && document.title !== customTitle) {
            log("[Fallback] Setting title to", customTitle);
            document.title = customTitle;
        }
    });

    observer.observe(document, {
        subtree: true,
        childList: true,
        characterData: true,
    });

    // Periodically check if the extension has been disabled, clean up if so
    const checkIfExtensionEnabled = setInterval(() => {
        if (fallbackActive === false) {
            log("[Fallback] Disabling checking if extension is enabled");
            clearInterval(checkIfExtensionEnabled);
        }

        try {
            chrome.runtime.sendMessage({ action: "ping" }, (response) => {
                if (response) {
                    log("[Fallback] Response from background:", response);
                }
            });
        } catch (error) {
            log("[Fallback] Background script not found, cleaning up");
            observer.disconnect();
            // Purposely not changing the title back to the original in this
            // situation just in case it is a false alarm somehow.
            clearInterval(checkIfExtensionEnabled);
        }
    }, 2000);
}

function injectCustomTitleScript() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("titleOverride.js");

    let scriptLoadTimeout = setTimeout(() => {
        log("Title override script didn't respond in time, using fallback");
        setupFallback();
    }, 200);

    const messageListener = (event) => {
        if (event.data.action === "titleOverrideScriptLoaded") {
            script.remove();
            clearTimeout(scriptLoadTimeout);
            fallbackActive = false;
            updateTitleOverrideScript(customTitle, debugMode);
            window.removeEventListener("message", messageListener);
        }
    };
    window.addEventListener("message", messageListener);

    script.onerror = function () {
        log("Title override script failed to inject, using fallback");
        script.remove();
        clearTimeout(scriptLoadTimeout);
        setupFallback();
    };

    (document.head || document.documentElement).appendChild(script);
}

function updateTitleOverrideScript(title, debugMode) {
    const message = {
        action: "updateTitleOverrideScript",
        originalTitle,
        customTitle: title,
        debugMode,
    };
    log("Sending updateTitleOverrideScript WINDOW message:", message);
    window.postMessage(message, "*");
}

function showNotification(message) {
    clearTimeout(notificationTimeout);

    let notification = document.getElementById("titleOverrideNotification");
    if (!notification) {
        notification = document.createElement("div");
        notification.id = "titleOverrideNotification";
        document.body.appendChild(notification);
    }

    notification.innerHTML = `
        <strong>Title Override</strong><br>
        ${message}
    `;

    notification.style.cssText = `
        all: unset;
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, hsl(193, 80%, 30%), hsl(193, 100%, 41%));
        color: white;
        padding: 12px 15px;
        border-radius: 8px;
        z-index: 2147483647;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        font-family: Arial, sans-serif;
        font-size: 14px;
        max-width: 300px;
        opacity: 0;
        transform: translateX(20px);
        transition: opacity 0.3s ease-out, transform 0.3s ease-out;
        pointer-events: none;
    `;

    notification.offsetHeight; // Force reflow (necessary)
    notification.style.opacity = "1";
    notification.style.transform = "translateX(0)";

    notificationTimeout = setTimeout(() => {
        notification.style.opacity = "0";
        notification.style.transform = "translateX(20px)";
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log("-".repeat(40));
    log("Message received from background script:", message);

    switch (message.action) {
        case "setCustomTitle":
            customTitle = message.customTitle;

            if (fallbackActive) {
                document.title = customTitle;
                return;
            }

            updateTitleOverrideScript(customTitle, debugMode);
            break;

        case "resetCustomTitle":
            customTitle = null;

            if (fallbackActive) {
                document.title = pageTitle;
                return;
            }

            updateTitleOverrideScript(customTitle, debugMode);
            break;

        case "changeDebugMode":
            debugMode = message.debugMode;
            log("Debug mode enabled");

            if (fallbackActive) {
                return;
            }

            updateTitleOverrideScript(customTitle, debugMode);
            break;

        case "showNotification":
            showNotification(message.text);
            break;

        case "ping":
            sendResponse(true);
            break;
    }
});

chrome.runtime.sendMessage({ action: "getState" }, (response) => {
    originalTitle = document.title;
    pageTitle = originalTitle;

    if (response) {
        customTitle = response.customTitle ?? customTitle;
        maintain = response.maintain ?? maintain;
        debugMode = response.debugMode ?? debugMode;
    }

    log("Got current state from background script:", response);

    const navigationEntry = performance.getEntriesByType("navigation")[0];
    const isNavigate = navigationEntry.type === "navigate";
    const isBackForward = navigationEntry.type === "back_forward";

    if (customTitle !== null && !maintain) {
        if (isNavigate) {
            log("Resetting title due to navigation without maintain");
            chrome.runtime.sendMessage({ action: "resetCustomTitle" });
            customTitle = null;
        } else if (isBackForward) {
            log("Resetting title due to back/forward without maintain");
            chrome.runtime.sendMessage({ action: "resetCustomTitle" });
            customTitle = null;
        }
    }

    // Change the title as soon as possible to minimize flicker on load
    if (customTitle !== null && customTitle !== undefined) {
        document.title = customTitle;
    }

    injectCustomTitleScript();
});
