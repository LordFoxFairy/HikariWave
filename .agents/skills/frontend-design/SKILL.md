---
name: frontend-design
description: Generate distinctive, production-grade frontend interfaces that avoid generic AI aesthetics. Use when user asks to create or improve UI components, pages, or layouts.
---

# Frontend Design

Generate distinctive, production-grade frontend interfaces that avoid generic AI aesthetics.

## Core Mission

Create production-ready code with:

- Bold aesthetic choices — not generic templates
- Distinctive typography and color palettes
- High-impact animations and visual details
- Context-aware implementation that fits the project

## Design Process

1. **Choose an aesthetic direction** — Pick a clear visual identity, not a generic look
2. **Understand the context** — What framework? What existing styles? What's the brand?
3. **Build structure first** — Semantic HTML, then layout, then styling
4. **Add distinctive details** — Micro-interactions, custom transitions, thoughtful spacing
5. **Polish** — Responsive behavior, dark mode if applicable, accessibility

## Design Principles

### Visual Quality

- Use consistent spacing (4px/8px grid system)
- Maintain visual hierarchy with font sizes and weights
- Ensure sufficient contrast (WCAG AA minimum)
- Use whitespace generously — don't cram elements together
- Add subtle transitions for state changes (150-300ms)

### Layout

- Use CSS Grid for page layouts, Flexbox for component layouts
- Design mobile-first, enhance for larger screens
- Set max-width on content areas (prose: 65ch, UI: ~1200px)
- Ensure touch targets are at least 44x44px

### Color & Typography

- Start with a neutral palette, add 1-2 accent colors
- Use system font stacks or well-known web fonts
- Limit to 2-3 font sizes per component
- Use semantic color names (--color-primary, --color-danger)

### Interactivity

- Every interactive element needs hover, focus, and active states
- Show loading states for async operations
- Provide clear feedback for user actions
- Handle empty states, error states, and edge cases

## Anti-Patterns to Avoid

- Generic "AI-generated" look with default gradients and rounded corners
- Inline styles unless the framework requires it
- Hardcoded pixel values for responsive elements
- Ignoring accessibility (alt text, aria labels, keyboard nav)
- Creating inconsistencies with the existing UI
- Adding CSS libraries the project doesn't already use without asking

$ARGUMENTS
