
# AllAccess AI - Automated Accessibility Auditor

This project is a Next.js application that performs automated accessibility audits on any given URL using **Playwright** and **axe-core**. It specifically targets WCAG 2.1 A/AA standards, which map directly to revised Section 508 requirements.

## 🚀 Getting Started

1.  **Install dependencies**:
    ```bash
    pnpm install
    ```

2.  **Install Playwright browsers**:
    ```bash
    npx playwright install chromium
    ```

3.  **Run the development server**:
    ```bash
    pnpm dev
    ```

4.  **Open the app**:
    Navigate to [http://localhost:3000](http://localhost:3000).

## 🛠 Tech Stack & Tools

-   **Next.js 15+** (App Router): Framework for frontend and API.
-   **Playwright**: Headless browser automation to render pages exactly as users see them.
-   **axe-core**: The industry standard accessibility testing engine.
    -    configured to run `wcag2a`, `wcag2aa`, and `section508` rules.
-   **TypeScript**: For type safety.
-   **CSS Modules**: For scoped, performant, and maintainable styling (Glassmorphism design).

## 🧩 Project Structure

-   `app/page.tsx`: The main frontend interface. Accepts a URL and displays results.
-   `app/page.module.css`: Styles for the frontend (Dark mode, glassmorphism).
-   `app/api/scan/route.ts`: The backend API route.
    -   Launches a headless Chromium instance.
    -   Injects `axe-core` into the target page.
    -   Runs the audit.
    -   Calculates a compliance score.
    -   Returns a JSON report.

## 📊 Compliance Coverage (Section 508)

The automated scan checks for violations that map to **Section 508** standards including:
-   Color contrast (1.4.3)
-   Alt text for images (1.1.1)
-   Form labels (1.3.1, 3.3.2)
-   ARIA usage (4.1.2)
-   Heading hierarchy (1.3.1)

*Note: Automated testing covers ~60-80% of compliance issues. Manual testing is recommended for full verification (e.g., screen reader usability).*
# accessibilitychecker
