import { NextResponse } from 'next/server';
import { chromium, type Browser, type Page } from 'playwright';

// Helper: Test 200%/400% zoom (1.4.4, 1.4.10)
async function testZoom(page: Page, scale: number): Promise<{ pass: boolean; issues: string[] }> {
    const issues: string[] = [];
    try {
        // Set a baseline viewport
        await page.setViewportSize({ width: 1280, height: 800 });

        // Get initial metrics
        const initialMetrics = await page.evaluate(() => {
            return {
                scrollWidth: document.documentElement.scrollWidth,
                scrollHeight: document.documentElement.scrollHeight
            };
        });

        // Apply Zoom via CSS
        await page.evaluate((s: number) => {
            document.body.style.transform = `scale(${s})`;
            document.body.style.transformOrigin = '0 0';
            document.body.style.width = `${100 / s}%`; // Compensate width to simulate browser zoom reflow
        }, scale);

        // Wait for layout
        await page.waitForTimeout(500);

        const zoomedMetrics = await page.evaluate(() => {
            return {
                scrollWidth: document.documentElement.scrollWidth,
                scrollHeight: document.documentElement.scrollHeight,
                windowWidth: window.innerWidth
            };
        });

        // Check for horizontal scroll (reflow issue) logic:
        // If scrollWidth > windowWidth significantly, it means content is overflowing horizontally
        if (zoomedMetrics.scrollWidth > zoomedMetrics.windowWidth * 1.05) {
            issues.push(`Horizontal scroll detected at ${scale * 100}% zoom`);
        }

        // Check if content disappeared (heuristic: scrollHeight shouldn't shrink drastically)
        if (zoomedMetrics.scrollHeight < initialMetrics.scrollHeight * 0.5) {
            issues.push('Content seemingly lost or layout broken at zoom');
        }

        // Reset
        await page.evaluate(() => {
            document.body.style.transform = '';
            document.body.style.transformOrigin = '';
            document.body.style.width = '';
        });
    } catch (e) {
        issues.push('Zoom test encountered an error');
    }

    return { pass: issues.length === 0, issues };
}

// Helper: Reflow at 400% (1.4.10)
async function testReflow(page: Page): Promise<{ pass: boolean; issues: string[] }> {
    const issues: string[] = [];
    try {
        // WCAG 1.4.10 Reflow: Content can be presented without loss of information or functionality, and without requiring scrolling in two dimensions
        // Simplified test: Set viewport to 320px width (equivalent to 1280px at 400% zoom)
        await page.setViewportSize({ width: 320, height: 1024 });
        await page.waitForTimeout(500);

        const check = await page.evaluate(() => {
            return {
                scrollWidth: document.documentElement.scrollWidth,
                windowWidth: window.innerWidth
            };
        });

        if (check.scrollWidth > check.windowWidth) {
            issues.push('Horizontal scrolling required at 320px width (Reflow failure)');
        }

        // Reset viewport
        await page.setViewportSize({ width: 1440, height: 900 });
    } catch (e) {
        issues.push('Reflow test encountered an error');
    }

    return { pass: issues.length === 0, issues };
}

// Helper: Keyboard traps/focus (2.1.1)
async function testKeyboard(page: Page): Promise<{ pass: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check if we can tab through the first few interactions
    try {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        // Active element check
        const hasFocus = await page.evaluate(() => {
            return document.activeElement && document.activeElement !== document.body;
        });

        if (!hasFocus) {
            issues.push('Unable to tab to any element initially');
        }

        // Check focus indicator on active element
        if (hasFocus) {
            const focusStyle = await page.evaluate(() => {
                const el = document.activeElement;
                if (!el) return null;
                const style = window.getComputedStyle(el);
                return {
                    outline: style.outline,
                    outlineStyle: style.outlineStyle,
                    boxShadow: style.boxShadow,
                    border: style.border,
                    outlineWidth: style.outlineWidth
                };
            });

            // Heuristic: if no outline, no shadow, no border change... might be inaccessible
            if (focusStyle &&
                (focusStyle.outlineStyle === 'none' || focusStyle.outlineWidth === '0px') &&
                focusStyle.boxShadow === 'none' &&
                (!focusStyle.border || focusStyle.border.includes('none') || focusStyle.border.includes('0px'))) {
                issues.push('Focus indicator might be missing (no outline/shadow detected)');
            }
        }

    } catch (e) {
        issues.push('Keyboard navigation failed during test');
    }

    return { pass: issues.length === 0, issues };
}

// Helper: Multimedia captions (1.2.x)
async function testMultimedia(page: Page): Promise<{ captionsFound: boolean; issues: string[] }> {
    const result = await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        if (videos.length === 0) return { hasVideo: false, hasCaptions: false };

        const hasCaptions = videos.some(v => {
            const tracks = Array.from(v.querySelectorAll('track'));
            return tracks.some(t => (t as HTMLTrackElement).kind === 'captions' || (t as HTMLTrackElement).kind === 'subtitles');
        });

        return { hasVideo: true, hasCaptions };
    });

    const issues = result.hasVideo && !result.hasCaptions ? ['Video found without captions'] : [];
    return { captionsFound: result.hasCaptions, issues };
}

export async function POST(req: Request) {
    try {
        const { url } = await req.json();
        if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

        const browser: Browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const context = await browser.newContext({
            bypassCSP: true,
            viewport: { width: 1440, height: 900 }
        });

        const page: Page = await context.newPage();

        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            try { await page.waitForLoadState('networkidle', { timeout: 5000 }); } catch (e) { }

            const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 });
            const screenshotBase64 = `data:image/jpeg;base64,${screenshot.toString('base64')}`;

            await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.0/axe.min.js' });

            const axeResults = await page.evaluate(async () => {
                // @ts-ignore
                return await window.axe.run({
                    runOnly: {
                        type: 'tag',
                        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'section508']
                    }
                });
            });

            // Perform additional manual-automated checks
            const zoomResult = await testZoom(page, 2);
            const reflowResult = await testReflow(page);
            const keyboardResult = await testKeyboard(page);
            const multimediaResult = await testMultimedia(page);

            const mapTagsToWCAG = (tags: string[]) => {
                const wcag = tags.find(t => t.startsWith('wcag')) || 'Best Practice';
                const match = wcag.match(/wcag(\d)(\d)(a|aa|aaa)/);
                if (match) return `${match[1]}.${match[2]} (${match[3].toUpperCase()})`;
                return wcag.toUpperCase();
            };

            const mapTagsToDisabilities = (tags: string[]) => {
                const map: Record<string, string> = {
                    'cat.color': 'Colorblindness',
                    'cat.contrast': 'Low Vision',
                    'cat.aria': 'Blindness',
                    'cat.forms': 'Motor Skills',
                    'cat.keyboard': 'Motor Skills',
                    'cat.structure': 'Cognitive',
                    'cat.text-alternatives': 'Blindness',
                };
                const disabilities = new Set<string>();
                tags.forEach(tag => { if (map[tag]) map[tag].split(', ').forEach(d => disabilities.add(d)); });
                return disabilities.size > 0 ? Array.from(disabilities) : ['General Accessibility'];
            };

            const processList = (list: any[]) => {
                return list.map(v => ({
                    id: v.id,
                    help: v.help,
                    description: v.description,
                    impact: v.impact,
                    wcagCriteria: mapTagsToWCAG(v.tags),
                    disabilities: mapTagsToDisabilities(v.tags),
                    helpUrl: v.helpUrl,
                    nodes: (v.nodes || []).map((n: any) => ({
                        target: n.target,
                        html: n.html,
                        failureSummary: n.failureSummary || ''
                    }))
                }));
            };

            // Violations: Failed automated checks
            const violations = processList(axeResults.violations);

            // Incomplete: Issues that require manual verification
            const incomplete = processList(axeResults.incomplete);

            // Passed: Successful automated checks
            const passed = processList(axeResults.passes);

            // Inapplicable: Rules that don't apply to this page
            const inapplicable = processList(axeResults.inapplicable);

            // Standard Manual Procedures (as seen in screenshots)
            const manualProcedures = [
                {
                    id: 'proc-zoom',
                    title: 'Text Legibility & Layout Integrity at High Zoom Levels',
                    levels: ['AA', 'AAA'],
                    passed: zoomResult.pass,
                    issues: zoomResult.issues,
                    purpose: "Evaluate whether content remains legible and functional when users apply increased zoom levels or custom visual settings.",
                    criteria: [
                        { code: '1.4.4', name: 'Resize text', level: 'AA', description: 'Text can be resized up to 200% without loss of content or functionality.', testing: 'Increase text size to 200% and check for overlaps or cut-off content.' }
                    ]
                },
                {
                    id: 'proc-reflow',
                    title: 'Reflow and Responsive Layout Integrity',
                    levels: ['AA'],
                    passed: reflowResult.pass,
                    issues: reflowResult.issues,
                    purpose: "Ensuring content can be presented without loss of information or functionality, and without requiring scrolling in two dimensions.",
                    criteria: [
                        { code: '1.4.10', name: 'Reflow', level: 'AA', description: 'Content can be presented without loss of information or functionality, and without requiring scrolling in two dimensions.', testing: 'Set viewport to 320px width and check for horizontal scrolling.' }
                    ]
                },
                {
                    id: 'proc-keyboard',
                    title: 'Keyboard Navigation and Full Access',
                    levels: ['A', 'AA'],
                    passed: keyboardResult.pass,
                    issues: keyboardResult.issues,
                    purpose: "Ensuring all interactive elements are reachable and operable via keyboard alone.",
                    criteria: [
                        { code: '2.1.1', name: 'Keyboard', level: 'A', description: 'All functionality is operable through a keyboard interface.', testing: 'Navigate the entire page using only the Tab and Enter keys.' }
                    ]
                },
                {
                    id: 'proc-multimedia',
                    title: 'Multimedia Captions and Alternatives',
                    levels: ['A', 'AA'],
                    passed: multimediaResult.captionsFound || !multimediaResult.issues.length,
                    issues: multimediaResult.issues,
                    purpose: "Ensuring multimedia content is accessible to users with hearing or visual impairments.",
                    criteria: [
                        { code: '1.2.2', name: 'Captions (Prerecorded)', level: 'A', description: 'Captions are provided for all prerecorded audio content in synchronized media.', testing: 'Check if video elements have caption tracks.' }
                    ]
                }
            ];

            // Scoring logic based on impact
            let score = 100;
            violations.forEach((v: any) => {
                const weights: any = { critical: 8, serious: 5, moderate: 2, minor: 1 };
                score -= (weights[v.impact] || 1) + (v.nodes.length * 0.1);
            });
            // Penalize for failed manual-automated checks
            manualProcedures.forEach(proc => {
                if (!proc.passed) score -= 5;
            });
            score = Math.max(0, Math.round(score));

            await browser.close();

            // Critical Issues count based on total elements affected
            const totalViolations = violations.reduce((acc, v) => acc + v.nodes.length, 0);

            // Other counts based on category/rule count
            const totalPassed = passed.length;
            const totalManual = manualProcedures.length + incomplete.length;
            const totalInapplicable = inapplicable.length;

            return NextResponse.json({
                url, score, timestamp: new Date().toISOString(), screenshot: screenshotBase64,
                categories: {
                    violations,
                    passed,
                    manual: { procedures: manualProcedures, verificationRequired: incomplete },
                    inapplicable
                },
                summary: {
                    violations: totalViolations,
                    passed: totalPassed,
                    manual: totalManual,
                    inapplicable: totalInapplicable
                }
            });

        } catch (e: any) {
            await browser.close();
            return NextResponse.json({ error: e.message }, { status: 500 });
        }
    } catch (e: any) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
