function log(...args) {
    console.log("%c[Background]", "color: chartreuse", ...args);
}

// Make sure any saved tabs still exist upon reactivation of the extension
chrome.tabs.query({}, (tabs) => {
    log("Checking that all saved tabs still exist after reload");
    chrome.storage.local.get(null, (items) => {
        const existingTabIds = new Set(tabs.map((tab) => tab.id));
        log("existingTabIds:", existingTabIds);
        log("existingKeys:", Object.keys(items));
        const keysToRemove = Object.keys(items).filter((key) => {
            const match = key.match(/^(?:customTitle|maintain)_(\d+)$/);
            return match && !existingTabIds.has(parseInt(match[1]));
        });
        log("keysToRemove", keysToRemove);
        if (keysToRemove.length) {
            chrome.storage.local.remove(keysToRemove);
        }
    });
});

function logState() {
    chrome.storage.local.get(null, (items) => {
        log("Current storage:", items);
    });
}

function processCustomTitleInput(tabId, customTitle) {
    chrome.storage.local.set({
        [`customTitle_${tabId}`]: customTitle,
    });
    logState();
}
function resetCustomTitleData(tabId) {
    chrome.storage.local.remove([`customTitle_${tabId}`]);
    logState();
}

function updateMaintainData(tabId, maintain) {
    chrome.storage.local.set({
        [`maintain_${tabId}`]: maintain,
    });
    logState();
}

function sendToContentScript(tabId, message) {
    chrome.tabs.sendMessage(tabId, message).catch(() => {
        log("Could not send message to content script:", message);
    });
}

function processCustomTitle(title) {
    // If the title is an empty string or just whitespace, the URL is shown
    // by the browser instead. If the user puts something like " " as their
    // title, they would expect the title to show up as blank/empty in the
    // title bar. Setting it to the zero-width space character makes it show
    // up as blank.
    if (title === null || title === undefined) {
        return null;
    } else if (title.trim() === "") {
        return "\u200B";
    } else {
        return title;
    }
}

// Handle updates from the popup or the content script,
// and handle requests for data from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log("-".repeat(40));
    log("Message received:", message);
    let tabId = message.tabId;
    let isFromContentScript = false;

    if (!tabId) {
        tabId = sender.tab && sender.tab.id;
        isFromContentScript = true;
    }

    if (message.customTitle !== null && message.customTitle !== undefined) {
        message.customTitle = processCustomTitle(message.customTitle);
    }

    switch (message.action) {
        case "getState":
            log(
                "Getting tab data from local storage and sending it back in the response",
            );
            chrome.storage.local.get(
                [`customTitle_${tabId}`, `maintain_${tabId}`, "debugMode"],
                (result) => {
                    sendResponse({
                        customTitle: result[`customTitle_${tabId}`],
                        maintain: result[`maintain_${tabId}`],
                        debugMode: result["debugMode"],
                    });
                },
            );

            logState();
            return true; // Indicates async response

        case "setCustomTitle":
            log("Setting custom title in local storage");
            processCustomTitleInput(tabId, message.customTitle);
            if (!isFromContentScript) {
                sendToContentScript(tabId, message);
            }
            break;

        case "resetCustomTitle":
            log("Resetting custom title in local storage");
            resetCustomTitleData(tabId);
            if (!isFromContentScript) {
                sendToContentScript(tabId, message);
            }
            break;

        case "updateMaintain":
            log("Updating maintain status in local storage");
            updateMaintainData(tabId, message.maintain);
            if (!isFromContentScript) {
                sendToContentScript(tabId, message);
            }
            sendToContentScript(tabId, {
                action: "showNotification",
                text: `Maintain on navigation: ${message.maintain ? "ON" : "OFF"}`,
            });
            break;

        case "changeDebugMode":
            log(
                "Updating debug status in local storage and broadcasting change to all tabs",
            );
            chrome.storage.local.set({ debugMode: message.debugMode }, () => {
                // Broadcast to all tabs
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach((tab) => {
                        chrome.tabs
                            .sendMessage(tab.id, {
                                action: "changeDebugMode",
                                debugMode: message.debugMode,
                            })
                            // Ignore errors for tabs where content script isn't loaded
                            .catch(() => {});
                    });
                });
            });

            logState();
            break;

        case "ping":
            sendResponse(true);
            break;
    }
});

function createCustomTitleModal(tabId) {
    const existingModal = document.getElementById("customTitleModalContainer");
    if (existingModal) {
        existingModal.remove();
        return;
    }

    const container = document.createElement("div");
    container.id = "customTitleModalContainer";
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.zIndex = "2147483647";
    container.style.pointerEvents = "none";

    const shadowRoot = container.attachShadow({ mode: "closed" });

    const modal = document.createElement("div");
    modal.id = "customTitleModal";
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border: 2px solid hsl(0, 0%, 80%);
        border-radius: 4px;
        box-shadow: 0 0 10px 0 hsl(0, 0%, 0%, 0.9);
        font-family: Arial, sans-serif;
        z-index: 2147483647;
        pointer-events: auto;
    `;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Enter custom title";
    input.style.cssText = `
        background-color: hsl(0, 0%, 7%);
        color: hsl(0, 0%, 91%);
        width: 500px;
        max-width: 80vw;
        padding: 10px;
        font-size: 18px;
    `;

    input.addEventListener("keydown", (e) => {
        if (/^[a-zA-Z]$/.test(e.key)) {
            e.stopPropagation();
        }
        if (e.key === "Enter") {
            chrome.runtime.sendMessage({
                action: "setCustomTitle",
                customTitle: input.value,
                tabId,
            });
            container.remove();
        }
        if (e.key === "Escape" && container.parentNode) {
            container.remove();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && container.parentNode) {
            container.remove();
        }
    });

    modal.appendChild(input);
    shadowRoot.appendChild(modal);

    document.body.appendChild(container);
    input.focus();
}

chrome.commands.onCommand.addListener((command) => {
    log("Command pressed:", command);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;

        switch (command) {
            case "set_custom_title":
                chrome.scripting
                    .executeScript({
                        target: { tabId },
                        function: createCustomTitleModal,
                        args: [tabId],
                    })
                    .catch(() =>
                        log(
                            "Could not execute createCustomTitleModal script in tab:",
                            tabId,
                        ),
                    );
                break;

            case "reset_custom_title":
                resetCustomTitleData(tabId);
                sendToContentScript(tabId, {
                    action: "resetCustomTitle",
                });
                break;

            case "toggle_maintain":
                chrome.storage.local.get(`maintain_${tabId}`, (result) => {
                    const previousMaintain =
                        result[`maintain_${tabId}`] ?? true;
                    const newMaintain = !previousMaintain;
                    updateMaintainData(tabId, newMaintain);
                    sendToContentScript(tabId, {
                        action: "updateMaintain",
                        maintain: newMaintain,
                    });
                    sendToContentScript(tabId, {
                        action: "showNotification",
                        text: `Maintain on navigation: ${newMaintain ? "ON" : "OFF"}`,
                    });
                });
                break;
        }
    });
});

// Clean up storage when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    log(`Tab ${tabId} closed, removing its data from storage, if any`);
    chrome.storage.local.remove([`customTitle_${tabId}`, `maintain_${tabId}`]);
    logState();
});

function isRestrictedPage(url) {
    const restrictedPages = [
        /^chrome:\/\//,
        /^edge:\/\//,
        /^about:/,
        /^view-source:/,
        /^data:/,
        /chromewebstore.google.com/,
    ];
    return restrictedPages.some((pattern) => url.match(pattern));
}

// Ensure functionality in all tabs after the extension is installed, updated,
// or re-enabled without requiring page reloads.
chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
        if (isRestrictedPage(tab.url)) continue;

        chrome.tabs.sendMessage(tab.id, { action: "ping" }).catch(() => {
            log(
                `Could not find content script in tab ${tab.id}, attempting to inject now`,
            );
            chrome.scripting
                .executeScript({
                    target: { tabId: tab.id },
                    files: ["content.js"],
                })
                .catch(() => {
                    // Ignore errors for tabs where we can't inject scripts
                    log(
                        `Failed to inject content script in tab ${tab.id}, moving on`,
                    );
                });
        });
    }
});

function updateIcon(tabId, url) {
    if (isRestrictedPage(url)) {
        chrome.action.setIcon({
            tabId,
            path: {
                16: "icons/icon16_inactive.png",
                48: "icons/icon48_inactive.png",
                128: "icons/icon128_inactive.png",
            },
        });
    } else {
        chrome.action.setIcon({
            tabId,
            path: {
                16: "icons/icon16.png",
                48: "icons/icon48.png",
                128: "icons/icon128.png",
            },
        });
    }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === "complete") {
        chrome.tabs.get(tabId, (updatedTab) => {
            if (updatedTab.url) {
                updateIcon(tabId, updatedTab.url);
            }
        });
    }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (tab.url) {
            updateIcon(tab.id, tab.url);
        }
    });
});
