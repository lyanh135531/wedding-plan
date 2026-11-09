import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoleProvider, UserRole } from '../../../src/context/RoleContext';
import { EventScopeProvider } from '../../../src/context/EventScopeContext';
import { PrototypeProvider } from '../../../src/components/testing/PrototypeToolbar';

let cachedCss: string | null = null;

export function getFullPageHtml(
  component: React.ReactElement,
  options: {
    role?: UserRole;
    scope?: string;
  } = {}
): string {
  if (!cachedCss) {
    const cssPath = path.resolve(process.cwd(), 'tests/e2e/prototypes/tailwind.generated.css');
    cachedCss = fs.readFileSync(cssPath, 'utf8');
  }

  const role = options.role ?? 'owner';
  const scope = options.scope ?? 'all';

  const wrapped = React.createElement(
    RoleProvider,
    { initialRole: role },
    React.createElement(
      EventScopeProvider,
      {
        initialEvents: [
          { id: 'ev_main', name: 'Tiệc Cưới Chính', isRepresentative: true },
          { id: 'ev_nha_gai', name: 'Lễ Vu Quy Nhà Gái' },
          { id: 'ev_nha_trai', name: 'Lễ Thành Hôn Nhà Trai' },
        ],
        initialScope: scope,
      },
      React.createElement(
        PrototypeProvider,
        null,
        component
      )
    )
  );

  const markup = renderToStaticMarkup(wrapped);

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wedding Management Prototype</title>
  <style>
    :root {
      --bg-page: #F7F5F0;
      --bg-surface: #FFFFFF;
      --color-primary: #23483E;
      --color-primary-hover: #19382F;
      --color-text-main: #1F2933;
      --color-text-muted: #52616B;
      --border-control: #7A8881;
      --border-subtle: #E2E8E4;
      --color-success: #166534;
      --bg-success: #ECFDF3;
      --color-warning: #854D0E;
      --bg-warning: #FFF8E1;
      --color-danger: #B42318;
      --bg-danger: #FEF3F2;
      --color-info: #175CD3;
      --bg-info: #EFF8FF;
      --color-focus: #1D4ED8;
      --sidebar-width: 240px;
      --header-height: 64px;
      --bottom-nav-height: 64px;
      --touch-target-min: 44px;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      background-color: var(--bg-page);
      color: var(--color-text-main);
      overflow-x: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    ${cachedCss}
  </style>
</head>
<body>
  <div id="__next" class="min-h-screen bg-[#F7F5F0]">${markup}</div>
</body>
</html>`;
}
