export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { connectToDatabase } from '../../../../../../server/src/db/mongoose'
import { getUser } from '../../../../../../server/src/auth/getUser'
import { fetchPage } from '../../../../../../server/src/services/pageFetcher/fetchPage'
import * as cheerio from 'cheerio'

const EVENT_HANDLER_ATTRS = [
  'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover',
  'onmousemove', 'onmouseout', 'onkeypress', 'onkeydown', 'onkeyup',
  'onfocus', 'onblur', 'onsubmit', 'onreset', 'onselect', 'onchange',
  'onload', 'onerror', 'onunload', 'onresize', 'onscroll'
]

function getSelectorBridgeScript(): string {
  return `
(function() {
  let highlightedEl = null;
  const HIGHLIGHT_STYLE = '2px solid #FF6B5A';
  const HIGHLIGHT_BG = 'rgba(255, 107, 90, 0.1)';

  function generateSelector(el) {
    if (el.id) {
      return '#' + CSS.escape(el.id);
    }

    const parts = [];
    let current = el;

    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();

      // Prefer meaningful classes over positional selectors
      const classes = Array.from(current.classList).filter(c =>
        !c.startsWith('js-') && !c.startsWith('_') && c.length < 40
      );
      if (classes.length > 0) {
        selector += '.' + classes.map(c => CSS.escape(c)).join('.');
      }

      // Check if this selector is already unique at this level
      const parent = current.parentElement;
      if (parent) {
        const siblings = parent.querySelectorAll(':scope > ' + selector);
        if (siblings.length > 1) {
          // Add nth-of-type if needed
          const index = Array.from(parent.children).indexOf(current) + 1;
          selector += ':nth-child(' + index + ')';
        }
      }

      parts.unshift(selector);

      // Test if the full path is unique in the document
      const fullSelector = parts.join(' > ');
      try {
        const matches = document.querySelectorAll(fullSelector);
        if (matches.length === 1) {
          return fullSelector;
        }
      } catch(e) {
        // Invalid selector, keep building the path
      }

      current = current.parentElement;
    }

    return parts.join(' > ');
  }

  document.addEventListener('mouseover', function(e) {
    if (highlightedEl) {
      highlightedEl.style.outline = highlightedEl._prevOutline || '';
      highlightedEl.style.backgroundColor = highlightedEl._prevBg || '';
    }
    const target = e.target;
    target._prevOutline = target.style.outline;
    target._prevBg = target.style.backgroundColor;
    target.style.outline = HIGHLIGHT_STYLE;
    target.style.backgroundColor = HIGHLIGHT_BG;
    highlightedEl = target;
  }, true);

  document.addEventListener('mouseout', function(e) {
    const target = e.target;
    target.style.outline = target._prevOutline || '';
    target.style.backgroundColor = target._prevBg || '';
  }, true);

  // Build ancestor chain for depth navigation
  function getAncestorChain(el, maxDepth) {
    var chain = [];
    var current = el;
    for (var i = 0; i < (maxDepth || 5); i++) {
      if (!current || current === document.body || current === document.documentElement) break;
      chain.push({
        selector: generateSelector(current),
        textContent: (current.textContent || '').trim().substring(0, 200),
        tagName: current.tagName.toLowerCase(),
        childCount: current.children.length
      });
      current = current.parentElement;
    }
    return chain;
  }

  document.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();

    var target = e.target;
    var selector = generateSelector(target);
    var attrs = {};
    for (var i = 0; i < target.attributes.length; i++) {
      attrs[target.attributes[i].name] = target.attributes[i].value;
    }

    // Get ancestor chain for ↑ navigation
    var ancestors = getAncestorChain(target, 5);

    // Get first few children for ↓ navigation
    var children = [];
    for (var c = 0; c < Math.min(target.children.length, 5); c++) {
      var child = target.children[c];
      children.push({
        selector: generateSelector(child),
        textContent: (child.textContent || '').trim().substring(0, 200),
        tagName: child.tagName.toLowerCase(),
        childCount: child.children.length
      });
    }

    // Get siblings for ← → navigation
    var siblings = [];
    var parent = target.parentElement;
    if (parent) {
      var sibs = parent.children;
      for (var s = 0; s < Math.min(sibs.length, 10); s++) {
        var sib = sibs[s];
        siblings.push({
          selector: generateSelector(sib),
          textContent: (sib.textContent || '').trim().substring(0, 200),
          tagName: sib.tagName.toLowerCase(),
          childCount: sib.children.length,
          isCurrent: sib === target
        });
      }
    }

    window.parent.postMessage({
      type: 'CURTN_ELEMENT_SELECTED',
      selector: selector,
      textContent: (target.textContent || '').trim().substring(0, 500),
      attributes: attrs,
      tagName: target.tagName.toLowerCase(),
      ancestors: ancestors,
      children: children,
      siblings: siblings
    }, '*');
  }, true);

  // Prevent navigation
  document.addEventListener('submit', function(e) { e.preventDefault(); }, true);
  var anchors = document.querySelectorAll('a');
  anchors.forEach(function(a) { a.removeAttribute('target'); });
})();
`
}

function getBaseUrl(sourceUrl: string): string {
  try {
    const u = new URL(sourceUrl)
    // Use origin + path up to last slash for relative URL resolution
    const pathParts = u.pathname.split('/')
    pathParts.pop() // remove the last segment (filename or empty)
    return u.origin + pathParts.join('/') + '/'
  } catch {
    return sourceUrl
  }
}

function rewriteUrls($: any, sourceUrl: string) {
  const origin = new URL(sourceUrl).origin

  // Rewrite relative URLs on key attributes
  const urlAttrs = ['href', 'src', 'srcset', 'action']
  $('*').each((_i: number, el: any) => {
    const elem = $(el)
    for (const attr of urlAttrs) {
      const val = elem.attr(attr)
      if (!val || val.startsWith('data:') || val.startsWith('javascript:') || val.startsWith('#')) continue
      if (val.startsWith('//')) {
        elem.attr(attr, 'https:' + val)
      } else if (val.startsWith('/')) {
        elem.attr(attr, origin + val)
      } else if (!val.startsWith('http')) {
        try {
          elem.attr(attr, new URL(val, sourceUrl).toString())
        } catch { /* leave as-is */ }
      }
    }
  })
}

function sanitizeHtml(html: string, sourceUrl: string): string {
  const $ = cheerio.load(html)

  // Remove all script tags except JSON-LD
  $('script').each((_i, el) => {
    const type = $(el).attr('type')
    if (type !== 'application/ld+json') {
      $(el).remove()
    }
  })

  // Remove iframes
  $('iframe').remove()

  // Remove meta refresh
  $('meta[http-equiv="refresh"]').remove()

  // Remove event handler attributes
  $('*').each((_i, el) => {
    const elem = $(el)
    for (const attr of EVENT_HANDLER_ATTRS) {
      elem.removeAttr(attr)
    }
  })

  // Rewrite relative URLs to absolute before adding base tag
  rewriteUrls($, sourceUrl)

  // Add base tag for any remaining relative references
  const baseUrl = getBaseUrl(sourceUrl)
  // Remove any existing base tags first
  $('base').remove()
  $('head').prepend(`<base href="${baseUrl}">`)

  // Inject crosshair cursor style
  $('head').append(`<style>
    * { cursor: crosshair !important; }
    a { pointer-events: auto !important; }
    body { overflow: auto !important; }
  </style>`)

  // If the body looks empty (SPA / JS-rendered), inject a helpful notice
  const bodyText = $('body').text().trim()
  if (bodyText.length < 50) {
    $('body').prepend(`
      <div style="background: #1a1a2e; color: #e0d4c8; padding: 16px; font-family: system-ui; border-bottom: 2px solid #ff6b5a; font-size: 14px;">
        <strong>Note:</strong> This page appears to render its content with JavaScript, which is stripped for security.
        The page structure is still available for selector mapping — try clicking elements below, or use JSON-LD extraction if available.
      </div>
    `)
  }

  // Inject bridge script at end of body
  $('body').append(`<script>${getSelectorBridgeScript()}</script>`)

  return $.html()
}

export async function GET(request: Request) {
  try {
    await connectToDatabase()

    // Auth check — admin only
    // Accept token from Authorization header or query param (iframes can't send headers)
    const url = new URL(request.url)
    const tokenParam = url.searchParams.get('token')
    const authorization = request.headers.get('authorization') || (tokenParam ? `Bearer ${tokenParam}` : undefined)
    const user = await getUser({ authorization })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { UserModel } = await import(
      '../../../../../../server/src/entities/user/userModel'
    )
    const adminUser = await UserModel.findById(user.id)
    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const targetUrl = url.searchParams.get('url')

    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }

    // Validate it's a real URL
    try {
      new URL(targetUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    const html = await fetchPage(targetUrl)
    const sanitized = sanitizeHtml(html, targetUrl)

    return new Response(sanitized, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'SAMEORIGIN'
      }
    })
  } catch (err: any) {
    console.error('Page preview error:', err)
    return NextResponse.json(
      { error: `Failed to fetch page: ${err.message}` },
      { status: 500 }
    )
  }
}
