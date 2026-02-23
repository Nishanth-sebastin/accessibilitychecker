export const mockAuditResult = {
  "status": 200,
  "error": false,
  "url": "https://nextjs.org/docs/app/getting-started/installation",
  "score": 53,
  "timestamp": new Date().toISOString(),
  "screenshot": "https://nextjs.org/static/blog/next-13/nextjs-13.png",
  "summary": {
    "violations": 35,
    "passed": 45,
    "manual": 5,
    "inapplicable": 39
  },
  "categories": {
    "violations": [
      {
        "id": "color-contrast",
        "help": "Elements must meet minimum color contrast ratio thresholds",
        "description": "Ensures the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds.",
        "wcagCriteria": "1.4.3 (AA)",
        "disabilities": ["Low Vision", "Colorblindness"],
        "nodes": [
          {
            "selector": ".navbar-module__cV3TuW__selected",
            "snippet": "<a class=\"navbar-module__cV3TuW__selected\" title=\"Documentation\" data-zone=\"same\" href=\"/docs\">Docs</a>",
            "colors": { "fgColor": "#0072f5", "bgColor": "#ffffff" },
            "colors_fixed": {
              "fixedFg": { "background": "#ffffff", "foreground": "#0071f3" },
              "fixedBg": { "background": "#080808", "foreground": "#0072f5" }
            }
          },
          {
            "selector": ".navbar-module__cV3TuW__search",
            "snippet": "<button class=\"navbar-module__cV3TuW__search\" data-variant=\"large\" type=\"button\">Search documentation...</button>",
            "colors": { "fgColor": "#8f8f8f", "bgColor": "#f2f2f2" },
            "colors_fixed": {
              "fixedFg": { "background": "#f2f2f2", "foreground": "#6e6e6e" },
              "fixedBg": { "background": "#282828", "foreground": "#8f8f8f" }
            }
          },
          {
            "selector": ".truncate.text-pretty",
            "snippet": "<span class=\"truncate text-pretty\">Installation</span>",
            "colors": { "fgColor": "#0072f5", "bgColor": "#ffffff" },
            "colors_fixed": {
              "fixedFg": { "background": "#ffffff", "foreground": "#0071f3" },
              "fixedBg": { "background": "#080808", "foreground": "#0072f5" }
            }
          },
          {
            "selector": ".flex-wrap.gap-2.text-sm > a",
            "snippet": "<a class=\"text-gray-700\" href=\"/docs/app\">App Router</a>",
            "colors": { "fgColor": "#8f8f8f", "bgColor": "#ffffff" },
            "colors_fixed": {
              "fixedFg": { "background": "#ffffff", "foreground": "#767676" },
              "fixedBg": { "background": "#282828", "foreground": "#8f8f8f" }
            }
          },
          {
            "selector": "a[href$=\"nodejs.org/\"]",
            "snippet": "<a href=\"https://nodejs.org/\" target=\"_blank\">Node.js</a>",
            "colors": { "fgColor": "#0072f5", "bgColor": "#ffffff" },
            "colors_fixed": {
              "fixedFg": { "background": "#ffffff", "foreground": "#0071f3" },
              "fixedBg": { "background": "#080808", "foreground": "#0072f5" }
            }
          },
          {
            "selector": "p:nth-child(14) > a",
            "snippet": "<a href=\"/docs/architecture/supported-browsers\">browser support</a>",
            "colors": { "fgColor": "#0072f5", "bgColor": "#ffffff" },
            "colors_fixed": {
              "fixedFg": { "background": "#ffffff", "foreground": "#0071f3" },
              "fixedBg": { "background": "#080808", "foreground": "#0072f5" }
            }
          }
        ]
      }
    ],
    "passed": [],
    "manual": { "procedures": [], "verificationRequired": [] },
    "inapplicable": []
  }
};
