export default class TitleTest {
    static CUSTOM_TITLE = "CUSTOM";
    static INITIAL_TITLE = "INITIAL";
    static MODIFIED_TITLE = "MODIFIED";
    static STANDARD_TEST_HTML = `
        <!DOCTYPE html>
        <html>
            <head>
                <title>${TitleTest.INITIAL_TITLE}</title>
            </head>
            <body>
                <h1>Test iframe</h1>
            </body>
        </html>
    `;

    constructor(tests) {
        this.tests = tests;
        this.testFrame = null;
    }

    async runTests(testName, activeOnly = null, onProgress = null) {
        const testsToRun = testName
            ? this.tests.filter((t) => t.name === testName)
            : this.tests;

        const allResults = [];

        for (const test of testsToRun) {
            const runInactive = activeOnly === null || !activeOnly;
            const runActive = activeOnly === null || activeOnly;

            if (runInactive) {
                allResults.push(
                    await this.runSingleTest(test, { extensionActive: false }),
                );
                if (onProgress) onProgress();
            }
            if (runActive) {
                allResults.push(
                    await this.runSingleTest(test, { extensionActive: true }),
                );
                if (onProgress) onProgress();
            }
        }

        return allResults;
    }

    async runSingleTest(test, { extensionActive }) {
        const fullTest = {
            initialHTML: TitleTest.STANDARD_TEST_HTML,
            expectedActiveResetTitle: TitleTest.MODIFIED_TITLE,
            expectedInactiveTitle: TitleTest.MODIFIED_TITLE,
            ...test,
        };

        const timings = {
            setup: 0,
            run: 0,
            check: 0,
            reset: 0,
            checkReset: 0,
            total: 0,
        };
        const startTotal = performance.now();

        try {
            const { initialTitle, postTestTitle, postResetTitle } =
                await this.executeTest(fullTest, extensionActive, timings);

            timings.total = performance.now() - startTotal;

            return {
                name: fullTest.name,
                extensionActive,
                testPassed: extensionActive
                    ? postTestTitle === TitleTest.CUSTOM_TITLE
                    : postTestTitle === fullTest.expectedInactiveTitle,
                resetPassed: extensionActive
                    ? postResetTitle === fullTest.expectedActiveResetTitle
                    : postResetTitle === fullTest.expectedInactiveTitle,
                initialTitle,
                postTestTitle,
                postResetTitle,
                expectedTestTitle: extensionActive
                    ? TitleTest.CUSTOM_TITLE
                    : fullTest.expectedInactiveTitle,
                expectedResetTitle: extensionActive
                    ? fullTest.expectedActiveResetTitle
                    : fullTest.expectedInactiveTitle,
                timings,
            };
        } catch (error) {
            timings.total = performance.now() - startTotal;

            return {
                name: fullTest.name,
                extensionActive,
                testPassed: false,
                resetPassed: false,
                error: error.message,
                timings,
            };
        }
    }

    async executeTest(test, extensionActive, timings) {
        const startSetup = performance.now();
        await this.setupTestEnvironment(
            test.initialHTML,
            test.name,
            test.preSetup,
        );

        timings.setup = performance.now() - startSetup;

        const initialTitle = this.testFrame.contentDocument.title;

        if (extensionActive) {
            this.testFrame.contentWindow.postMessage(
                {
                    action: "updateTitleOverrideScript",
                    customTitle: TitleTest.CUSTOM_TITLE,
                    debugMode: false
                },
                "*",
            );
        }

        // Allow message handler to process
        await new Promise((resolve) => setTimeout(resolve, 0));

        const startRun = performance.now();
        await test.run(this.testFrame.contentDocument);
        timings.run = performance.now() - startRun;

        // Allow test mutations to be processed
        await new Promise((resolve) => setTimeout(resolve, 0));
        const postTestTitle = this.testFrame.contentDocument.title;

        const startCheck = performance.now();
        timings.check = performance.now() - startCheck;

        const startReset = performance.now();
        this.testFrame.contentWindow.postMessage(
            {
                action: "updateTitleOverrideScript",
                customTitle: null,
                debugMode: false
            },
            "*",
        );
        timings.reset = performance.now() - startReset;

        // Allow reset to be processed
        await new Promise((resolve) => setTimeout(resolve, 0));
        const postResetTitle = this.testFrame.contentDocument.title;

        const startCheckReset = performance.now();
        timings.checkReset = performance.now() - startCheckReset;

        return { initialTitle, postTestTitle, postResetTitle };
    }

    async setupTestEnvironment(initialHTML, testName, preSetup = null) {
        if (this.testFrame) {
            document
                .getElementById("iframeContainer")
                .removeChild(this.testFrame);
        }

        this.testFrame = document.createElement("iframe");
        this.testFrame.style.width = "100%";
        this.testFrame.style.height = "100%";
        document.getElementById("iframeContainer").appendChild(this.testFrame);

        return new Promise((resolve) => {
            this.testFrame.onload = async () => {
                if (preSetup) {
                    await preSetup(this.testFrame.contentDocument);
                }

                console.log(testName + " ------------------------------------");
                await this.injectExtensionScript();
                resolve();
            };

            this.testFrame.contentDocument.open();
            this.testFrame.contentDocument.write(initialHTML);
            this.testFrame.contentDocument.close();
        });
    }

    async injectExtensionScript() {
        const extensionScript =
            this.testFrame.contentDocument.createElement("script");
        extensionScript.src = chrome.runtime.getURL("titleOverride.js");

        return new Promise((resolve) => {
            extensionScript.onload = resolve;
            this.testFrame.contentDocument.head.appendChild(extensionScript);
        });
    }
}
