# Spectral Healthcare AI Governance Platform - Design Guidelines

## Design Approach

**Selected Approach**: Modern B2B SaaS Design System inspired by Stripe's clarity, Linear's precision, and enterprise healthcare platforms.

**Rationale**: This platform targets C-suite healthcare executives (CISOs, VPs, CIOs) and requires a design that balances professional credibility with modern SaaS sophistication. The dual-audience model (Health Systems + AI Vendors) demands clear information architecture with seamless segmentation.

**Core Principles**:
- Executive-grade professionalism with modern edge
- Trust-building through clarity and organization
- Dense information delivered with generous breathing room
- Precision over decoration

---

## Typography System

**Primary Font**: Inter (Google Fonts)
- Headings: 600-700 weight
- Body: 400-500 weight

**Type Scale**:
- Hero Headline: text-6xl md:text-7xl lg:text-8xl, font-bold, tracking-tight
- Section Headlines: text-4xl md:text-5xl, font-bold
- Subsection Titles: text-2xl md:text-3xl, font-semibold
- Feature Titles: text-xl font-semibold
- Body Large: text-lg leading-relaxed
- Body Standard: text-base leading-relaxed
- Caption/Meta: text-sm

**Hierarchy Rules**:
- Headlines use tight line-height (leading-tight)
- Body text uses relaxed leading for readability
- Maintain 2-3 weight differences between heading levels
- Use letter-spacing strategically (tracking-tight for large text)

---

## Layout System

**Spacing Primitives**: Tailwind units of 4, 6, 8, 12, 16, 20, 24, 32
- Component padding: p-6, p-8
- Section spacing: py-16, py-20, py-24, py-32
- Element gaps: gap-4, gap-6, gap-8, gap-12

**Container Strategy**:
- Page container: max-w-7xl mx-auto px-6 lg:px-8
- Content blocks: max-w-6xl for standard sections
- Text content: max-w-4xl for readability
- Feature grids: max-w-7xl for expansive layouts

**Grid System**:
- Mobile: Single column (grid-cols-1)
- Tablet: 2 columns (md:grid-cols-2)
- Desktop: 3-4 columns (lg:grid-cols-3 or lg:grid-cols-4)
- Pricing tiers: Always 3 columns on desktop (lg:grid-cols-3)

**Vertical Rhythm**:
- Hero: py-20 md:py-24 lg:py-32
- Major sections: py-16 md:py-20 lg:py-24
- Subsections: py-12 md:py-16
- Components: mb-8, mb-12, mb-16 between elements

---

## Page Structure & Sections

### 1. Hero Section
**Layout**: Full-width, centered content with strategic asymmetry
- Headline + subheadline + dual CTAs + social proof strip
- Use large hero image: Professional healthcare technology setting (modern hospital command center, clean medical facility with screens showing data dashboards)
- Image placement: Full-width background with gradient overlay
- Content: Centered, max-w-4xl, z-index above image
- Social proof: Horizontal strip with metrics, semi-transparent background
- Height: min-h-[85vh] to avoid forced 100vh

### 2. Health Systems Section (Multi-part)

**Problem Statement Block**:
- Two-column layout (lg:grid-cols-2)
- Left: Narrative text (max-w-2xl)
- Right: Visual checklist with X marks, structured list

**Solution - 4 Pillars**:
- Grid layout: md:grid-cols-2 lg:grid-cols-4
- Each pillar: Card component with icon, title, 4-5 bullet points
- Icons: Use Heroicons (outline style)
- Card style: Bordered, rounded-xl, p-8, hover elevation

**Testimonials**:
- Three-column grid (lg:grid-cols-3)
- Quote cards with attribution, title, organization
- Card elevation: Subtle shadow, rounded-lg

**ROI Calculator Section**:
- Two-column comparison (md:grid-cols-2)
- "Without Spectral" vs "With Spectral"
- Large numbers, clear savings callout

### 3. Pricing Section
**Layout**: Three-tier cards, equal height
- Grid: lg:grid-cols-3 gap-8
- Middle tier ("Growth"): Elevated/highlighted with border emphasis
- Each card: Rounded-2xl, p-8, structured with:
  - Tier name + price (text-4xl font-bold)
  - "For" descriptor
  - "Perfect for" use case
  - Feature checklist (checkmark bullets)
  - CTA button
  - Example use case (text-sm)

### 4. AI Vendors Section
**Problem/Solution Mirror**: Similar structure to Health Systems
- Certification process: Numbered step flow (1-5)
- Benefits grid: 2-column layout
- Trust page mockup: Include visual representation

### 5. Stats Dashboard Component
**Placement**: Between major sections as social proof
- Horizontal layout: 3-4 metrics
- Large numbers (text-5xl font-bold)
- Descriptive labels below
- Dividers between metrics

---

## Component Library

### Navigation
- Sticky header: backdrop-blur, semi-transparent
- Logo + nav links + dual CTAs
- Mobile: Hamburger menu, slide-out drawer

### Buttons
**Primary CTA**: px-8 py-4, text-lg, rounded-lg, font-semibold
**Secondary CTA**: Outlined variant, same sizing
**On-image buttons**: Backdrop-blur background (backdrop-blur-sm bg-white/10)

### Cards
**Feature Cards**: p-6 md:p-8, rounded-xl, border, hover:shadow-lg transition
**Pricing Cards**: p-8, rounded-2xl, full feature list, clear hierarchy
**Testimonial Cards**: p-6, rounded-lg, quote + attribution

### Icons
**Source**: Heroicons (outline for features, solid for small UI elements)
**Sizing**: w-6 h-6 for inline, w-12 h-12 for feature cards, w-8 h-8 for section markers

### Forms
**Contact/Demo Forms**: 
- Single column, max-w-lg
- Input fields: px-4 py-3, rounded-lg, border
- Generous spacing: gap-6
- Large submit button
- Optional: Inline validation states

### Badges & Tags
**"Spectral Verified" Badge**: Rounded-full, px-4 py-2, flex items-center, icon + text
**Tier indicators**: Small, uppercase, tracking-wide, font-semibold

---

## Images

### Hero Image
**Description**: Modern healthcare command center or hospital technology hub. Clean, professional environment with large screens displaying data dashboards, analytics, and monitoring systems. Bright, naturally lit space with medical professionals collaborating. Sense of control, clarity, and modern technology.
**Treatment**: Full-width background, gradient overlay from bottom for text legibility, slight blur or darkening for contrast

### Section Supporting Images
- **Dashboard mockup**: Clean UI showing compliance dashboard with real-time metrics
- **Trust page example**: Screenshot of vendor verification page
- **Hospital setting**: Professional healthcare facility photos for credibility
- Use sparingly - only where they enhance understanding or build trust

---

## Responsive Behavior

**Breakpoints**:
- Mobile-first approach
- md: 768px (tablets)
- lg: 1024px (desktop)
- xl: 1280px (large screens)

**Key Adaptations**:
- Grid collapses: 4-col → 2-col → 1-col
- Typography scales down on mobile (text-6xl → text-4xl)
- Padding reduces: py-32 → py-20 → py-16
- Horizontal layouts stack vertically
- Navigation converts to hamburger menu

---

## Animations

**Minimal, purposeful motion**:
- Fade-in on scroll for section reveals (intersection observer)
- Hover states: Gentle elevation (shadow transitions)
- Button interactions: Scale subtle (hover:scale-[1.02])
- Card hovers: Shadow increase (transition-shadow duration-300)
- NO: Parallax, complex scroll animations, auto-playing content

---

## Accessibility

- Semantic HTML structure (header, nav, main, section, footer)
- ARIA labels for icon-only buttons
- Focus states clearly visible (ring-2 ring-offset-2)
- Form inputs with associated labels
- Sufficient contrast ratios throughout
- Keyboard navigation support
- Skip-to-content link

---

## Production Notes

- Optimize images: WebP format, responsive srcset
- Lazy load below-fold images
- CDN delivery for font and icons
- Minimize animation JavaScript
- Ensure fast initial paint (<2s)
- Mobile performance priority (healthcare executives often review on tablets)