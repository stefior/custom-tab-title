export default class TestUI {
    constructor(tester) {
        this.tester = tester;
        this.resultsContainer = document.getElementById("testResults");
        this.progressBar = document.getElementById("progressBar");
        this.resultsTable = null;
        this.controlPanel = document.getElementById("testGroups");
        this.totalTests = 0;
        this.completedTests = 0;
        this.isRunningTests = false;
        this.allTestResults = [];
        this.setupUI();
    }

    setupUI() {
        this.setupExportButton();
        this.setupClearButton();
        this.setupResultsTable();
        this.setupControls();
        this.setupTestGroups();
    }

    setupExportButton() {
        const exportButton = document.getElementById("exportButton");
        exportButton.addEventListener("click", () =>
            this.exportCurrentResults(),
        );
    }

    setupClearButton() {
        const clearButton = document.getElementById("clearButton");
        clearButton.addEventListener("click", () => this.clearResults());
    }

    clearResults() {
        const tbody = this.resultsTable.tBodies[0];
        if (tbody) {
            while (tbody.firstChild) {
                tbody.removeChild(tbody.firstChild);
            }
        }
        this.allTestResults = [];
    }

    setupResultsTable() {
        this.resultsTable = document.createElement("table");
        this.resultsTable.id = "resultsTable";

        const headerRow = this.resultsTable.createTHead().insertRow();
        [
            "Mode",
            "Phase",
            "Status",
            "Initial Title",
            "Result Title",
            "Expected Title",
            "Timing",
        ].forEach((text) => {
            const th = document.createElement("th");
            th.textContent = text;
            headerRow.appendChild(th);
        });

        this.resultsContainer.appendChild(this.resultsTable);
    }

    setupControls() {
        const runAllButton = document.getElementById("runAllTests");
        runAllButton.addEventListener("click", () => this.runAndDisplayTests());
    }

    setupTestGroups() {
        this.tester.tests.forEach((test) => {
            const button = document.createElement("button");
            button.textContent = test.name;
            button.addEventListener("click", () =>
                this.runAndDisplayTests(test.name),
            );

            this.controlPanel.appendChild(button);
        });
    }

    updateProgress() {
        this.completedTests++;
        const percentage = (this.completedTests / this.totalTests) * 100;
        this.progressBar.style.setProperty("--progress", `${percentage}%`);
        this.progressBar.querySelector("span").textContent =
            `[${this.completedTests}/${this.totalTests}]`;
    }

    async runAndDisplayTests(testName = null) {
        if (this.isRunningTests) return;
        this.isRunningTests = true;
        try {
            this.progressBar.style.setProperty("--progress", "0%");
            this.completedTests = 0;

            const testsToRun = testName
                ? this.tester.tests.filter((t) => t.name === testName)
                : this.tester.tests;

            this.totalTests = testsToRun.length;
            this.progressBar.querySelector("span").textContent =
                `[0/${this.totalTests}]`;

            const results = [];
            for (const test of testsToRun) {
                const activeResult = await this.tester.runSingleTest(test, {
                    extensionActive: true,
                });
                const inactiveResult = await this.tester.runSingleTest(test, {
                    extensionActive: false,
                });
                results.push({ activeResult, inactiveResult });
                this.displayResults([{ activeResult, inactiveResult }]);
                this.updateProgress();
            }

            this.allTestResults = this.allTestResults.concat(results);
        } finally {
            this.isRunningTests = false;
        }
    }

    exportCurrentResults() {
        if (this.allTestResults.length === 0) {
            console.log("No results to export");
            return;
        }

        const exportData = this.allTestResults.flatMap(
            ({ activeResult, inactiveResult }) => [
                this.formatResultForExport(activeResult, "Active", "Test"),
                this.formatResultForExport(activeResult, "Active", "Reset"),
                this.formatResultForExport(inactiveResult, "Inactive", "Test"),
                this.formatResultForExport(inactiveResult, "Inactive", "Reset"),
            ],
        );

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "test-results.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    formatResultForExport(result, mode, phase) {
        const isTest = phase === "Test";
        return {
            testName: result.name,
            mode,
            phase,
            status: isTest
                ? result.testPassed
                    ? "PASS"
                    : "FAIL"
                : result.resetPassed
                  ? "PASS"
                  : "FAIL",
            initialTitle: result.initialTitle,
            resultTitle: isTest ? result.postTestTitle : result.postResetTitle,
            expectedTitle: isTest
                ? result.expectedTestTitle
                : result.expectedResetTitle,
            timing: result.timings,
        };
    }

    getCellContent(cell) {
        return cell.classList.contains("empty-string") ? "" : cell.textContent;
    }

    displayResults(results) {
        const tbody =
            this.resultsTable.tBodies[0] || this.resultsTable.createTBody();

        results.forEach(({ activeResult, inactiveResult }) => {
            const headerRow = tbody.insertRow(0);
            headerRow.className = "test-header";
            const headerCell = headerRow.insertCell();
            headerCell.colSpan = 8;
            headerCell.textContent = activeResult.name;

            // Add all four rows
            this.addResultRow(tbody, inactiveResult, "Inactive", "Reset");
            this.addResultRow(tbody, inactiveResult, "Inactive", "Test");
            this.addResultRow(tbody, activeResult, "Active", "Reset");
            this.addResultRow(tbody, activeResult, "Active", "Test");
        });
    }

    addResultRow(tbody, result, mode, phase) {
        const row = tbody.insertRow(1);
        const isTest = phase === "Test";
        row.className = `${mode.toLowerCase()}-test ${
            isTest
                ? result.testPassed
                    ? "pass"
                    : "fail"
                : result.resetPassed
                  ? "pass"
                  : "fail"
        }`;

        const cells = [
            mode,
            phase,
            isTest
                ? result.testPassed
                    ? "PASS"
                    : "FAIL"
                : result.resetPassed
                  ? "PASS"
                  : "FAIL",
            this.formatTitle(result.initialTitle),
            this.formatTitle(
                isTest ? result.postTestTitle : result.postResetTitle,
            ),
            this.formatTitle(
                isTest ? result.expectedTestTitle : result.expectedResetTitle,
            ),
            this.formatTiming(result.timings),
        ];

        cells.forEach((content) => {
            const cell = row.insertCell();
            if (typeof content === "object") {
                Object.assign(cell, content);
            } else {
                cell.textContent = content;
            }
        });
    }

    formatTitle(title) {
        if (title === "") {
            return {
                textContent: "(empty string)",
                className: "empty-string",
            };
        }
        return title;
    }

    formatTiming(timings) {
        return Object.entries(timings)
            .map(([key, value]) => {
                const capitalizedKey = this.capitalizeFirstLetter(key);
                const formattedValue = `${value.toFixed(1)}ms`;
                return `${capitalizedKey}: ${formattedValue}`;
            })
            .join("\n");
    }

    capitalizeFirstLetter(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
