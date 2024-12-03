const warning = document.getElementById("warning");
const customTitleInput = document.getElementById("customTitleInput");
const setTitleButton = document.getElementById("setTitleButton");
const resetTitleButton = document.getElementById("resetTitleButton");
const maintainCheckbox = document.getElementById("maintainCheckbox");
const configureShortcutsButton = document.getElementById(
    "configureShortcutsButton",
);
const debugModeCheckbox = document.getElementById("debugModeCheckbox");

function log(...args) {
    console.log("%c[Popup]", "color: fuchsia", ...args);
}

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

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;

    chrome.runtime.sendMessage({ action: "getState", tabId }, (response) => {
        console.log("Received response", response);
        if (response) {
            customTitleInput.value = response.customTitle ?? "";
            maintainCheckbox.checked = response.maintain ?? true;
            debugModeCheckbox.checked = response.debugMode ?? false;
        }

        // Setting it here so it doesn't flash from this to the value on load
        customTitleInput.placeholder = "Enter custom title";
    });

    if (isRestrictedPage(tabs[0].url)) {
        warning.style.display = "block";
        // Don't disable any inputs, just in case the user is planning on
        // setting them for subsequent navigations in this tab
    }
});

function setCustomTitleData(customTitle) {
    if (customTitleInput.value?.trim() === "") {
        // To reflect what it is converted to by the background script
        customTitleInput.value = "\u200B";
    }

    console.log("Sending setCustomTitle message to background");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;
        chrome.runtime.sendMessage({
            action: "setCustomTitle",
            customTitle,
            tabId,
        });
    });
}

customTitleInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        setCustomTitleData(customTitleInput.value);
    }
});

setTitleButton.addEventListener("click", () => {
    setCustomTitleData(customTitleInput.value);
});

resetTitleButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;

        console.log("Sending resetCustomTitle message to background");
        chrome.runtime.sendMessage({
            action: "resetCustomTitle",
            tabId,
        });

        customTitleInput.value = "";
    });
});

maintainCheckbox.addEventListener("change", (event) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0].id;

        console.log("Sending updateMaintain message to background");
        chrome.runtime.sendMessage({
            action: "updateMaintain",
            maintain: event.target.checked,
            tabId,
        });
    });
});

configureShortcutsButton.addEventListener("click", () => {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

debugModeCheckbox.addEventListener("change", (event) => {
    chrome.runtime.sendMessage({
        action: "changeDebugMode",
        debugMode: event.target.checked,
    });
});
