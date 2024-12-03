(function () {
    window.postMessage({ action: "titleOverrideScriptLoaded" }, "*");

    // Check if title override script is already running
    if (window.__titleOverrideActive) {
        return;
    }
    window.__titleOverrideActive = true;

    let debugMode = false;
    let customTitle = null;
    let originalTitle = null;
    let pageTitle = document.title;
    let extensionId;

    function log(...args) {
        if (!debugMode) return;
        console.log("%c[Title Override]", "color: yellow", ...args);
    }

    // Get unchanged MutationObserver in case the page modified its version
    const iframe = document.createElement("iframe");
    document.documentElement.appendChild(iframe);
    const SafeMutationObserver = iframe.contentWindow.MutationObserver;
    document.documentElement.removeChild(iframe);
    log("SafeMutationObserver obtained");

    function setPageTitle(newTitle) {
        if (!newTitle?.trim() || newTitle === customTitle) {
            log("Ignoring page title change to:", newTitle);
        } else {
            log("Page title updated to:", newTitle);
            pageTitle = newTitle;
        }
    }

    // Overwriting the properties is preferable because it prevents flickering
    // when websites try to change the title
    const ourTitleElement = document.createElement("title");
    log("Custom title element created");

    const originalDescriptors = {
        textContent: Object.getOwnPropertyDescriptor(
            Node.prototype,
            "textContent",
        ),
        innerText: Object.getOwnPropertyDescriptor(
            HTMLElement.prototype,
            "innerText",
        ),
        innerHTML: Object.getOwnPropertyDescriptor(
            Element.prototype,
            "innerHTML",
        ),
        outerHTML: Object.getOwnPropertyDescriptor(
            Element.prototype,
            "outerHTML",
        ),
        text: Object.getOwnPropertyDescriptor(
            HTMLTitleElement.prototype,
            "text",
        ),
    };

    Object.keys(originalDescriptors).forEach((property) => {
        const descriptor = originalDescriptors[property];
        log(`Setting up descriptor for ${property}`);

        Object.defineProperty(ourTitleElement, property, {
            get() {
                log(`Getting ${property}:`, descriptor.get.call(this));
                return descriptor.get.call(this);
            },
            set(newValue) {
                log(`Attempting to set ${property} to:`, newValue);

                if (property === "outerHTML") {
                    const match = newValue.match(/<title>(.*?)<\/title>/);
                    newValue = match ? match[1] : "";
                }

                if (customTitle !== null) {
                    log("Custom title active, using:", customTitle);
                    setPageTitle(newValue);
                    if (property === "outerHTML") return;

                    descriptor.set.call(this, customTitle);
                } else {
                    log("No custom title, using provided value");
                    descriptor.set.call(this, newValue);
                }
            },
        });
    });

    ["appendChild", "insertBefore", "replaceChild"].forEach((method) => {
        let originalMethod = Node.prototype[method];

        ourTitleElement[method] = function (...args) {
            log(`Attempting ${method} operation`);
            if (args[0].nodeType === 3 /* Text node */) {
                let newText;
                if (method === "replaceChild") {
                    newText = args[0].textContent;
                } else if (method === "appendChild") {
                    newText = pageTitle + args[0].textContent;
                } else if (method === "insertBefore") {
                    newText = args[0].textContent + pageTitle;
                }
                setPageTitle(newText);
            }

            if (customTitle !== null) {
                log(`Blocked ${method} due to active custom title`);
                return;
            }

            log(`Allowing ${method}`);
            return originalMethod.apply(this, args);
        };
    });

    ourTitleElement.remove = function () {
        log("Attempting to remove title element");
        if (customTitle === null) {
            log("Allowing remove");
            Element.prototype.remove.call(this);
        } else {
            log("Blocked remove due to active custom title");
        }
    };

    // Override document.title
    const originalTitleDescriptor = Object.getOwnPropertyDescriptor(
        Document.prototype,
        "title",
    );
    try {
        Object.defineProperty(document, "title", {
            get() {
                const currentTitle = originalTitleDescriptor.get.call(this);
                return currentTitle;
            },
            set(newValue) {
                log("Attempting to set document.title to:", newValue);
                setPageTitle(newValue);
                if (customTitle !== null) {
                    log("Document.title using custom title instead");
                    if (document.title !== customTitle) {
                        ensureCustomTitle();
                    }
                } else {
                    log("Setting document.title normally");
                    originalTitleDescriptor.set.call(this, newValue);
                }
            },
        });
    } catch (e) {
        log("document.title has already been overwritten, moving on");
    }

    function ensureHtmlAndHead() {
        if (!document.documentElement) {
            document.appendChild(document.createElement("html"));
            log("Created html element");
        }

        if (!document.head) {
            document.documentElement.insertBefore(
                document.createElement("head"),
                document.documentElement.firstChild || null,
            );
            log("Created head element");
        }
    }

    function ensureCustomTitle() {
        log("Ensuring custom title:", customTitle ?? pageTitle);

        ourTitleElement.textContent = customTitle ?? pageTitle;

        const firstTitle = document.querySelector("title");
        if (firstTitle && firstTitle !== ourTitleElement) {
            log("Replacing existing title element");
            setPageTitle(document.title);
            firstTitle.parentNode.replaceChild(ourTitleElement, firstTitle);
            return;
        }

        ensureHtmlAndHead();

        if (!firstTitle) {
            log("No title element found, creating document structure");

            document.head.insertBefore(
                ourTitleElement,
                document.head.firstChild || null,
            );

            log("Inserted our title element");
        }
    }

    // This may run very often, depending on the site. However, we aren't
    // checking every mutation, instead just doing a simple if check each time,
    // and modern computers can do millions of those a second.
    const observer = new SafeMutationObserver(() => {
        if (customTitle === null && document.title !== pageTitle) {
            log("Updating pageTitle to match document.title");
            setPageTitle(document.title);
            return;
        }

        if (customTitle !== null && document.title !== customTitle) {
            log("Enforcing custom title");
            ensureCustomTitle();
        }
    });

    // Observe at document level and reconnect if document.documentElement changes
    function setupObserver() {
        log("Setting up observer");
        observer.disconnect();

        ensureHtmlAndHead();

        if (customTitle !== null) {
            log("Custom title active, ensuring it is set");
            ensureCustomTitle();
        }

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    }

    setupObserver();

    new SafeMutationObserver(() => {
        log("Document element changed, resetting observer");
        setupObserver();
    }).observe(document, { childList: true });

    window.addEventListener("message", function (event) {
        if (event.data.action !== "updateTitleOverrideScript") return;

        log("Message received:", event.data);

        const newCustomTitle = event.data.customTitle;
        const newDebugMode = event.data.debugMode;

        if (
            event.data.originalTitle &&
            event.data.originalTitle !== event.data.currentTitle
        ) {
            originalTitle = event.data.originalTitle || "";
            pageTitle = originalTitle;
            log("Saved original title value:", originalTitle);
        }

        if (customTitle !== undefined && customTitle !== newCustomTitle) {
            customTitle = newCustomTitle;

            if (newCustomTitle === null) {
                log("Resetting custom title");
                ourTitleElement.textContent = pageTitle;
            } else {
                log("Updating custom title to:", newCustomTitle);
                ensureCustomTitle();
            }
        }

        if (debugMode !== undefined && debugMode !== newDebugMode) {
            debugMode = newDebugMode;
            log("Debug mode", newDebugMode ? "enabled" : "disabled");
        }

        if (!extensionId && event.data.extensionId) {
            extensionId = event.data.extensionId;
            log("Extension ID received:", extensionId);

            // Periodically check if the extension has been disabled.
            // If so, clean up until it is enabled again with a set custom title
            setInterval(() => {
                if (customTitle === null) return;
                try {
                    chrome.runtime.sendMessage(
                        extensionId,
                        { action: "ping" },
                        (response) => {
                            if (response) {
                                //console.log("[Title Override] Ping from background:", response);
                            } else {
                                //console.log(
                                //"[Title Override] Background script not found, cleaning up until re-enabled",
                                //);
                                customTitle = null;
                                debugMode = false;
                                ourTitleElement.textContent = pageTitle;
                            }
                        },
                    );
                } catch (error) {
                    //console.log(
                    //"[Title Override] Background script not found, cleaning up until re-enabled",
                    //);
                    customTitle = null;
                    debugMode = false;
                    ourTitleElement.textContent = pageTitle;
                }
            }, 1000);
        }
    });

    log("Title override script fully initialized");

    // To indicate it is in the iframe on the test page
    if (window.self !== window.top) {
        document.documentElement.style.backgroundColor = "lightblue";
    }
})();
