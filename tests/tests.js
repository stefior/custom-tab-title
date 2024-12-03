import TestUI from "./TestUI.js";
import TitleTest from "./TitleTest.js";

const tests = [
    {
        name: "Delete Title Element",
        run: async (doc) => {
            const titleEl = doc.querySelector("title");
            if (titleEl) titleEl.remove();
        },
        expectedActiveResetTitle: TitleTest.INITIAL_TITLE,
        expectedInactiveTitle: "",
    },
    {
        name: "Delete Head",
        run: async (doc) => {
            doc.head.remove();
        },
        expectedActiveResetTitle: TitleTest.INITIAL_TITLE,
        expectedInactiveTitle: "",
    },
    {
        name: "Change document.title",
        run: async (doc) => {
            doc.title = TitleTest.MODIFIED_TITLE;
        },
    },
    {
        name: "Change textContent",
        run: async (doc) => {
            doc.querySelector("title").textContent = TitleTest.MODIFIED_TITLE;
        },
    },
    {
        name: "Rapid Title Changes",
        run: async (doc) => {
            // Test rapid document.title changes
            for (let i = 1000; i > 0; i--) {
                doc.title = "Rapid " + i;
            }
            doc.title = TitleTest.MODIFIED_TITLE;

            // Test rapid textContent changes
            const el = doc.querySelector("title");
            for (let i = 1000; i > 0; i--) {
                el.textContent = "Rapid " + i;
            }
            el.textContent = TitleTest.MODIFIED_TITLE;
        },
    },
    {
        name: "Insert Adjacent Title Element Outside Head",
        run: async (doc) => {
            doc.head.insertAdjacentHTML(
                "beforebegin",
                `<title>${TitleTest.MODIFIED_TITLE}</title>`,
            );
        },
    },
    {
        name: "Replace Title Element with New",
        run: async (doc) => {
            const newTitle = doc.createElement("title");
            newTitle.textContent = TitleTest.MODIFIED_TITLE;
            doc.head.replaceChild(newTitle, doc.querySelector("title"));
        },
    },
    {
        name: "Replace Title Element with Clone",
        run: async (doc) => {
            const titleClone = doc.querySelector("title").cloneNode(true);
            titleClone.textContent = TitleTest.MODIFIED_TITLE;
            doc.head.replaceChild(titleClone, doc.querySelector("title"));
        },
    },
    {
        name: "Insert Title Before Existing",
        run: async (doc) => {
            let newTitle = doc.createElement("title");
            newTitle.textContent = TitleTest.MODIFIED_TITLE;
            doc.head.insertBefore(newTitle, doc.querySelector("title"));
        },
    },
    {
        name: "Multiple Title Tags At Once",
        run: async (doc) => {
            const fragment = doc.createDocumentFragment();
            for (let i = 0; i < 5; i++) {
                const newTitle = doc.createElement("title");
                newTitle.textContent = TitleTest.MODIFIED_TITLE;
                fragment.appendChild(newTitle);
            }
            doc.head.insertBefore(fragment, doc.head.firstChild || null);
        },
    },
    {
        name: "Replace Head",
        run: async (doc) => {
            const newHead = doc.createElement("head");
            Array.from(doc.head.children).forEach((child) => {
                newHead.appendChild(child.cloneNode(true));
            });
            const newTitle = newHead.querySelector("title");
            newTitle.textContent = TitleTest.MODIFIED_TITLE;
            doc.documentElement.replaceChild(newHead, doc.head);
        },
    },
    {
        name: "Duplicate Head",
        run: async (doc) => {
            const duplicateHead = doc.createElement("head");
            const newTitle = doc.createElement("title");
            newTitle.textContent = TitleTest.MODIFIED_TITLE;
            duplicateHead.appendChild(newTitle);
            doc.documentElement.insertBefore(duplicateHead, doc.head);
        },
    },
    {
        name: "Insert Text Node Before Title Text",
        run: async (doc) => {
            const titleElement = doc.querySelector("title");
            const newTextNode = doc.createTextNode(TitleTest.MODIFIED_TITLE);
            titleElement.insertBefore(newTextNode, titleElement.firstChild);
        },
        expectedActiveResetTitle:
            TitleTest.MODIFIED_TITLE + TitleTest.INITIAL_TITLE,
        expectedInactiveTitle:
            TitleTest.MODIFIED_TITLE + TitleTest.INITIAL_TITLE,
    },
    {
        name: "Replace Title Text Node",
        run: async (doc) => {
            const titleElement = doc.querySelector("title");
            const newTextNode = doc.createTextNode(TitleTest.MODIFIED_TITLE);
            titleElement.replaceChild(newTextNode, titleElement.firstChild);
        },
    },
    {
        name: "Append Multiple Text Nodes to Title",
        run: async (doc) => {
            const titleElement = doc.querySelector("title");
            const firstNode = doc.createTextNode(TitleTest.MODIFIED_TITLE);
            const secondNode = doc.createTextNode(TitleTest.MODIFIED_TITLE);
            titleElement.appendChild(firstNode);
            titleElement.appendChild(secondNode);
        },
        expectedActiveResetTitle:
            TitleTest.INITIAL_TITLE +
            TitleTest.MODIFIED_TITLE +
            TitleTest.MODIFIED_TITLE,
        expectedInactiveTitle:
            TitleTest.INITIAL_TITLE +
            TitleTest.MODIFIED_TITLE +
            TitleTest.MODIFIED_TITLE,
    },
    {
        name: "Add Body Title, then Move Head",
        run: async (doc) => {
            const bodyTitle = doc.createElement("title");
            bodyTitle.textContent = TitleTest.MODIFIED_TITLE;
            doc.body.insertBefore(bodyTitle, doc.body.firstChild);
            doc.documentElement.appendChild(doc.head);
        },
    },
    {
        name: "Change Title Every Frame",
        run: async (doc) => {
            return new Promise((resolve) => {
                let frameCount = 100;
                function changeTitle() {
                    doc.title = `Frame Title ${frameCount}`;
                    frameCount--;
                    if (frameCount > 0) {
                        doc.defaultView.requestAnimationFrame(changeTitle);
                    } else {
                        doc.title = TitleTest.MODIFIED_TITLE;
                        resolve();
                    }
                }
                doc.defaultView.requestAnimationFrame(changeTitle);
            });
        },
    },
    {
        name: "Change Title in MutationObserver",
        run: async (doc) => {
            return new Promise((resolve) => {
                const observer = new doc.defaultView.MutationObserver(() => {
                    doc.title = TitleTest.MODIFIED_TITLE;
                    observer.disconnect();
                    resolve();
                });
                observer.observe(doc.body, { childList: true });
                doc.body.appendChild(doc.createElement("div"));
            });
        },
    },
    {
        name: "Change Title using queueMicrotask",
        run: async (doc) => {
            return new Promise((resolve) => {
                doc.defaultView.queueMicrotask(() => {
                    doc.title = TitleTest.MODIFIED_TITLE;
                    resolve();
                });
            });
        },
    },
    {
        name: "100k Title Attributes",
        run: async (doc) => {
            const titleElement = doc.querySelector("title");
            for (let i = 0; i < 100_000; i++) {
                titleElement.setAttribute(`data-attr${i}`, "value");
            }
            titleElement.textContent = TitleTest.MODIFIED_TITLE;
        },
    },
    {
        name: "Change HTML Inner HTML (Title Only)",
        run: async (doc) => {
            doc.documentElement.innerHTML =
                doc.documentElement.innerHTML.replace(
                    /<title>.*?<\/title>/,
                    `<title>${TitleTest.MODIFIED_TITLE}</title>`,
                );
        },
    },
    {
        name: "Change Head Outer HTML (Title Only)",
        run: async (doc) => {
            doc.head.outerHTML = doc.head.outerHTML.replace(
                /<title>.*?<\/title>/,
                `<title>${TitleTest.MODIFIED_TITLE}</title>`,
            );
        },
    },
    {
        name: "Replace Entire HTML",
        run: async (doc) => {
            const newHtml = doc.documentElement.cloneNode(true);
            newHtml.querySelector("title").textContent =
                TitleTest.MODIFIED_TITLE;
            doc.replaceChild(newHtml, doc.documentElement);
        },
    },
    {
        name: "Delete Entire HTML",
        run: async (doc) => {
            doc.documentElement.remove();
        },
        expectedActiveResetTitle: TitleTest.INITIAL_TITLE,
        expectedInactiveTitle: "",
    },
    {
        name: "Modify Head OuterHTML",
        run: async (doc) => {
            doc.head.outerHTML = `<title>${TitleTest.MODIFIED_TITLE}</title>`;
        },
    },
    {
        name: "Nullify Window Events",
        run: async (doc) => {
            const win = doc.defaultView;
            for (let key in win) {
                if (key.startsWith("on")) {
                    win[key] = null;
                }
            }
            doc.querySelector("title").textContent = TitleTest.MODIFIED_TITLE;
        },
    },
    {
        name: "Use createHTMLDocument",
        run: async (doc) => {
            const newDoc =
                doc.implementation.createHTMLDocument("New Document");
            newDoc.title = TitleTest.MODIFIED_TITLE;
            doc.replaceChild(
                doc.importNode(newDoc.documentElement, true),
                doc.documentElement,
            );
        },
    },
    {
        name: "Insert Comment in Title",
        run: async (doc) => {
            const titleElement = doc.querySelector("title");
            const commentNode = doc.createComment("test");
            titleElement.insertBefore(commentNode, titleElement.firstChild);
        },
        expectedActiveResetTitle: TitleTest.INITIAL_TITLE,
        expectedInactiveTitle: TitleTest.INITIAL_TITLE,
    },
    {
        name: "Initial Empty Title",
        initialHTML: `
            <!DOCTYPE html>
            <html>
            <head>
                <title></title>
            </head>
            <body>
                <h1>Test iframe</h1>
            </body>
            </html>
        `,
        run: async (doc) => {
            // No action needed, we're testing the initial state
        },
        expectedActiveResetTitle: "",
        expectedInactiveTitle: "",
    },
    {
        name: "Disconnect All MutationObservers",
        preSetup: async (doc) => {
            const win = doc.defaultView;
            win._testObservers = [];
            const originalMutationObserver = win.MutationObserver;

            win.MutationObserver = function (...args) {
                const observer = new originalMutationObserver(...args);
                win._testObservers.push(observer);
                return observer;
            };
            win.MutationObserver.prototype = originalMutationObserver.prototype;
        },
        run: async (doc) => {
            const win = doc.defaultView;
            win._testObservers.forEach((observer) => observer.disconnect());

            // Replace the title element entirely, which should be caught by MutationObserver
            const newTitle = doc.createElement("title");
            newTitle.textContent = TitleTest.MODIFIED_TITLE;
            const oldTitle = doc.querySelector("title");
            oldTitle.parentNode.replaceChild(newTitle, oldTitle);
        },
    },
    {
        name: "Set Title to Empty String",
        run: async (doc) => {
            const titleEl = doc.querySelector("title");
            titleEl.textContent = "";
        },
        expectedActiveResetTitle: TitleTest.INITIAL_TITLE,
        expectedInactiveTitle: "",
    },
    {
        name: "Set Title to Whitespace",
        run: async (doc) => {
            const titleEl = doc.querySelector("title");
            const whitespaceValues = [" ", "  ", "\t", "\n", " \n \t "];
            for (const ws of whitespaceValues) {
                titleEl.textContent = ws;
            }
        },
        expectedActiveResetTitle: TitleTest.INITIAL_TITLE,
        expectedInactiveTitle: "",
    },
    {
        name: "Title in Body Initially",
        initialHTML: `
            <!DOCTYPE html>
            <html>
            <head></head>
            <body>
                <title>${TitleTest.INITIAL_TITLE}</title>
            </body>
            </html>
        `,
        run: async (doc) => {
            const titleEl = doc.querySelector("title");
            titleEl.textContent = TitleTest.MODIFIED_TITLE;
        },
    },
    {
        name: "No Title Element Initially",
        initialHTML: `
            <!DOCTYPE html>
            <html>
            <head></head>
            <body>
                <h1>Test iframe</h1>
            </body>
            </html>
        `,
        run: async (doc) => {
            doc.title = TitleTest.MODIFIED_TITLE;
        },
    },
    {
        name: "No Head Initially",
        initialHTML: `
            <!DOCTYPE html>
            <html>
                <body>
                    <h1>Test iframe</h1>
                </body>
            </html>
        `,
        run: async (doc) => {
            doc.title = TitleTest.MODIFIED_TITLE;
        },
    },
    {
        name: "No HTML Element Initially",
        initialHTML: `
            <h1>Test iframe</h1>
        `,
        run: async (doc) => {
            doc.title = TitleTest.MODIFIED_TITLE;
        },
    },
    {
        name: "Window.stop() After Replacing Title",
        run: async (doc) => {
            const titleEl = doc.querySelector("title");
            const newTitle = doc.createElement("title");
            newTitle.textContent = TitleTest.MODIFIED_TITLE;
            titleEl.parentNode.replaceChild(newTitle, titleEl);
            doc.defaultView.stop();
        },
    },
    {
        name: "Nested Head Elements",
        run: async (doc) => {
            const newHead = doc.createElement("head");
            const newTitle = doc.createElement("title");
            newTitle.textContent = TitleTest.MODIFIED_TITLE;
            newHead.appendChild(newTitle);
            doc.head.insertBefore(newHead, doc.head.firstChild);
        },
    },
    {
        name: "Nested Title Elements",
        run: async (doc) => {
            const existingTitle = doc.querySelector("title");
            const newTitle = doc.createElement("title");
            newTitle.textContent = TitleTest.MODIFIED_TITLE;
            existingTitle.appendChild(newTitle);
        },
        // The browser ignores nested title elements, so we will too
        expectedActiveResetTitle: TitleTest.INITIAL_TITLE,
        expectedInactiveTitle: TitleTest.INITIAL_TITLE,
    },
    {
        name: "Rapid Title Mutations",
        run: async (doc) => {
            return new Promise((resolve) => {
                const titleElement = doc.querySelector("title");
                let count = 0;
                const interval = setInterval(() => {
                    // Trigger both characterData and childList mutations
                    if (count % 2 === 0) {
                        const textNode = doc.createTextNode(
                            `Mutation ${count}`,
                        );
                        titleElement.appendChild(textNode);
                    } else {
                        titleElement.textContent = `Mutation ${count}`;
                    }
                    count++;

                    if (count >= 1000) {
                        clearInterval(interval);
                        titleElement.textContent = TitleTest.MODIFIED_TITLE;
                        resolve();
                    }
                }, 1); // Try to achieve 1000 mutations per second
            });
        },
    },
];

document.addEventListener("DOMContentLoaded", () => {
    const tester = new TitleTest(tests);
    new TestUI(tester);
});
