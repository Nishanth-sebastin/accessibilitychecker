import { NextResponse } from 'next/server';
import { chromium, type Browser, type Page } from 'playwright-core';
import chromiumMin from '@sparticuz/chromium-min';

export const maxDuration = 60; // 60 seconds on Vercel (if Pro) or max available on Hobby

// Helper: Test 200%/400% zoom (1.4.4, 1.4.10)
async function testZoom(page: Page, scale: number): Promise<{ pass: boolean; issues: string[] }> {
    const issues: string[] = [];
    try {
        await page.setViewportSize({ width: 1280, height: 800 });
        const initialMetrics = await page.evaluate(() => {
            return {
                scrollWidth: document.documentElement.scrollWidth,
                scrollHeight: document.documentElement.scrollHeight
            };
        });

        await page.evaluate((s: number) => {
            document.body.style.transform = `scale(${s})`;
            document.body.style.transformOrigin = '0 0';
            document.body.style.width = `${100 / s}%`;
        }, scale);

        await page.waitForTimeout(500);

        const zoomedMetrics = await page.evaluate(() => {
            return {
                scrollWidth: document.documentElement.scrollWidth,
                scrollHeight: document.documentElement.scrollHeight,
                windowWidth: window.innerWidth
            };
        });

        if (zoomedMetrics.scrollWidth > zoomedMetrics.windowWidth * 1.05) {
            issues.push(`Horizontal scroll detected at ${scale * 100}% zoom`);
        }
        if (zoomedMetrics.scrollHeight < initialMetrics.scrollHeight * 0.5) {
            issues.push('Content seemingly lost or layout broken at zoom');
        }

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
        await page.setViewportSize({ width: 1440, height: 900 });
    } catch (e) {
        issues.push('Reflow test encountered an error');
    }
    return { pass: issues.length === 0, issues };
}

// Helper: Keyboard traps/focus (2.1.1)
async function testKeyboard(page: Page): Promise<{ pass: boolean; issues: string[] }> {
    const issues: string[] = [];
    try {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        const hasFocus = await page.evaluate(() => {
            return document.activeElement && document.activeElement !== document.body;
        });

        if (!hasFocus) {
            issues.push('Unable to tab to any element initially');
        }

        if (hasFocus) {
            const focusStyle = await page.evaluate(() => {
                const el = document.activeElement;
                if (!el) return null;
                const style = window.getComputedStyle(el);
                return {
                    outlineStyle: style.outlineStyle,
                    boxShadow: style.boxShadow,
                    border: style.border,
                    outlineWidth: style.outlineWidth
                };
            });

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

// Helper: Touch target size (2.5.5)
async function testTouchTargets(page: Page): Promise<{ pass: boolean; issues: string[] }> {
    const issues = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        const smallTargets: string[] = [];
        elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && (rect.width < 24 || rect.height < 24)) {
                smallTargets.push(`${el.tagName.toLowerCase()}: "${(el as HTMLElement).innerText.substring(0, 20)}" is only ${Math.round(rect.width)}x${Math.round(rect.height)}px`);
            }
        });
        return smallTargets.slice(0, 5);
    });
    return { pass: issues.length === 0, issues };
}

// Helper: Heading hierarchy (1.3.1)
async function testHeadingOrder(page: Page): Promise<{ pass: boolean; issues: string[] }> {
    const issues = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const errors: string[] = [];
        let prevLevel = 0;
        headings.forEach(h => {
            const level = parseInt(h.tagName[1]);
            if (prevLevel > 0 && level > prevLevel + 1) {
                errors.push(`Heading level skipped: H${prevLevel} to H${level}`);
            }
            prevLevel = level;
        });
        if (headings.length > 0 && headings[0].tagName !== 'H1') {
            errors.push('Page does not start with an H1 heading');
        }
        return errors;
    });
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
    let browser: Browser | null = null;
    try {
        const { url } = await req.json();
        if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

        const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION;

        if (isVercel) {
            browser = await chromium.launch({
                args: chromiumMin.args,
                executablePath: await chromiumMin.executablePath('https://github.com/sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'),
                headless: chromiumMin.headless,
            });
        } else {
            // Local fallback
            browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
        }

        const context = await browser.newContext({
            bypassCSP: true,
            viewport: { width: 1440, height: 900 }
        });

        const page: Page = await context.newPage();
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

        const zoomResult = await testZoom(page, 2);
        const reflowResult = await testReflow(page);
        const keyboardResult = await testKeyboard(page);
        const multimediaResult = await testMultimedia(page);
        const touchResult = await testTouchTargets(page);
        const headingResult = await testHeadingOrder(page);

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

        const violations = processList(axeResults.violations);
        const incomplete = processList(axeResults.incomplete);
        const passed = processList(axeResults.passes);
        const inapplicable = processList(axeResults.inapplicable);

        const manualProcedures = [
            {
                id: 'proc-zoom',
                title: 'Text Legibility & Layout Integrity at High Zoom Levels',
                levels: ['AA', 'AAA'],
                passed: zoomResult.pass,
                issues: zoomResult.issues,
                purpose: "Evaluate whether content remains legible and functional when users apply increased zoom levels.",
                criteria: [{ code: '1.4.4', name: 'Resize text', level: 'AA', description: 'Text can be resized up to 200% without loss of content or functionality.', testing: 'Increase text size to 200%.' }]
            },
            {
                id: 'proc-reflow',
                title: 'Reflow and Responsive Layout Integrity',
                levels: ['AA'],
                passed: reflowResult.pass,
                issues: reflowResult.issues,
                purpose: "Ensuring content can be presented without loss of functionality, and without scrolling in two dimensions.",
                criteria: [{ code: '1.4.10', name: 'Reflow', level: 'AA', description: 'Content can be presented without requiring scrolling in two dimensions.', testing: 'Set viewport to 320px width.' }]
            },
            {
                id: 'proc-keyboard',
                title: 'Keyboard Navigation and Full Access',
                levels: ['A', 'AA'],
                passed: keyboardResult.pass,
                issues: keyboardResult.issues,
                purpose: "Ensuring all interactive elements are reachable via keyboard alone.",
                criteria: [{ code: '2.1.1', name: 'Keyboard', level: 'A', description: 'All functionality is operable through a keyboard interface.', testing: 'Navigate using Tab and Enter.' }]
            },
            {
                id: 'proc-multimedia',
                title: 'Multimedia Captions and Alternatives',
                levels: ['A', 'AA'],
                passed: multimediaResult.captionsFound || !multimediaResult.issues.length,
                issues: multimediaResult.issues,
                purpose: "Ensuring multimedia content is accessible.",
                criteria: [{ code: '1.2.2', name: 'Captions', level: 'A', description: 'Captions are provided for audio content.', testing: 'Check if video has caption tracks.' }]
            },
            {
                id: 'proc-touch',
                title: 'Touch Target Size and Spacing',
                levels: ['AA'],
                passed: touchResult.pass,
                issues: touchResult.issues,
                purpose: "Ensuring interactive elements are large enough.",
                criteria: [{ code: '2.5.5', name: 'Target Size', level: 'AAA', description: 'Target for pointer inputs is at least 44x44 CSS pixels.', testing: 'Inspect button size.' }]
            },
            {
                id: 'proc-headings',
                title: 'Heading Hierarchy and Structure',
                levels: ['A'],
                passed: headingResult.pass,
                issues: headingResult.issues,
                purpose: "Ensuring a logical document structure.",
                criteria: [{ code: '1.3.1', name: 'Info and Relationships', level: 'A', description: 'Structure conveyed through presentation can be determined programmatically.', testing: 'Check heading sequence.' }]
            }
        ];

        let score = 100;
        violations.forEach((v: any) => {
            const weights: any = { critical: 8, serious: 5, moderate: 2, minor: 1 };
            score -= (weights[v.impact] || 1) + (v.nodes.length * 0.1);
        });
        manualProcedures.forEach(proc => { if (!proc.passed) score -= 4; });
        score = Math.max(0, Math.round(score));

        await browser.close();
        browser = null;

        const totalViolations = violations.reduce((acc, v) => acc + v.nodes.length, 0);

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
                passed: passed.length,
                manual: manualProcedures.length + incomplete.length,
                inapplicable: inapplicable.length
            }
        });

    } catch (e: any) {
        if (browser) await browser.close();
        return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
    }
}
