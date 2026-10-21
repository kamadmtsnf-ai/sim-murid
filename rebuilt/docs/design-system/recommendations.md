# Hasil pencarian aktual UI UX Pro Max

Bukti rekomendasi; keputusan final hanya pada MASTER.md. Generator menggunakan dataset upstream berlisensi MIT, SHA56ea9cf174ed86786187daa9de0e6247cb0747e4. Pencarian ikon kosong dua kali; Lucide existing dipertahankan berdasarkan aturan umum skill, bukan hasil pencocokan dataset. Chart trend merekomendasikan line dan tabel fallback; tidak menambahkan pustaka chart dalam perubahan ini.

## Design System: Rebuilt SiM-Murid

### Pattern
- **Name:** Hero + Features + CTA
- **Conversion Focus:** Deep CTA placement. For CTA label text, verify at least 4.5:1 against the button fill; use 7:1 only when the product explicitly targets AAA normal-text contrast. Keep focus and component boundaries independently visible. Disable hero parallax under reduced motion and render its static final state.
- **CTA Placement:** Hero (sticky) + Bottom
- **Color Strategy:** Hero: Brand primary or vibrant. Features: Card bg #FAFAFA. CTA: Contrasting accent color
- **Sections:** Hero with headline/image > Value prop > Key features (3-5) > CTA section > Footer

### Style
- **Name:** Minimalism & Swiss Style
- **Mode Support:** Light supported | Dark supported
- **Keywords:** Clean, simple, spacious, functional, white space, high contrast, geometric, sans-serif, grid-based, essential
- **Best For:** Enterprise apps, dashboards, documentation sites, SaaS platforms, professional tools
- **Performance:** cost:low|drivers:none | **Accessibility:** risk:low|requires:contrast-text-4.5,keyboard,visible-focus,reduced-motion

### Colors
| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#0D9488` | `--color-primary` |
| On Primary | `#000000` | `--color-on-primary` |
| Secondary | `#2DD4BF` | `--color-secondary` |
| On Secondary | `#0F172A` | `--color-on-secondary` |
| Accent/CTA | `#D97706` | `--color-accent` |
| On Accent/CTA | `#000000` | `--color-on-accent` |
| Background | `#F0FDFA` | `--color-background` |
| Foreground | `#134E4A` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Card Foreground | `#134E4A` | `--color-card-foreground` |
| Muted | `#E8F1F4` | `--color-muted` |
| Muted Foreground | `#475569` | `--color-muted-foreground` |
| Border | `#5EEAD4` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| On Destructive | `#FFFFFF` | `--color-on-destructive` |
| Ring | `#0D9488` | `--color-ring` |

*Notes: Education teal + course amber + grade green*

### Typography
- **Heading:** Fira Code
- **Body:** Fira Sans
- **Mood:** dashboard, data, analytics, code, technical, precise
- **Best For:** Dashboards, analytics, data visualization, admin panels
- **Google Fonts:** https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap
- **CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');
```

### Key Effects
Subtle hover (200-250ms), smooth transitions, sharp shadows if any, clear type hierarchy, fast loading

### Pre-Delivery Checklist
- [ ] No emojis as icons (use SVG: Heroicons/Lucide)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] prefers-reduced-motion respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px



## Design System: Rebuilt SiM-Murid

### Pattern
- **Name:** Enterprise Gateway
- **Conversion Focus:** Path selection (I am a...). Mega menu navigation. Trust signals prominent. Provide pause/stop for video and rotating logos; stop on focus and reduced motion. Logo carousel controls must be keyboard operable; pause moving media offscreen/hidden and render a static final state under reduced motion.
- **CTA Placement:** Contact Sales (Primary) + Login (Secondary)
- **Color Strategy:** Corporate: Navy/Grey. High integrity. Conservative accents.
- **Sections:** Hero (Video/Mission) > Solutions by Industry > Solutions by Role > Client Logos > Contact Sales

### Style
- **Name:** Data-Dense Dashboard
- **Mode Support:** Light supported | Dark supported
- **Keywords:** Multiple charts/widgets, data tables, KPI cards, minimal padding, grid layout, space-efficient, maximum data visibility
- **Best For:** Business intelligence dashboards, financial analytics, enterprise reporting, operational dashboards, data warehousing
- **Performance:** cost:low|drivers:none | **Accessibility:** risk:low|requires:contrast-text-4.5,keyboard,visible-focus,reduced-motion

### Colors
| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#1E40AF` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#3B82F6` | `--color-secondary` |
| On Secondary | `#000000` | `--color-on-secondary` |
| Accent/CTA | `#D97706` | `--color-accent` |
| On Accent/CTA | `#000000` | `--color-on-accent` |
| Background | `#F8FAFC` | `--color-background` |
| Foreground | `#1E3A8A` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Card Foreground | `#1E3A8A` | `--color-card-foreground` |
| Muted | `#E9EEF6` | `--color-muted` |
| Muted Foreground | `#475569` | `--color-muted-foreground` |
| Border | `#DBEAFE` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| On Destructive | `#FFFFFF` | `--color-on-destructive` |
| Ring | `#1E40AF` | `--color-ring` |

*Notes: Blue data + amber highlights [Accent adjusted from #F59E0B]*

### Typography
- **Heading:** Fira Code
- **Body:** Fira Sans
- **Mood:** dashboard, data, analytics, code, technical, precise
- **Best For:** Dashboards, analytics, data visualization, admin panels
- **Google Fonts:** https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap
- **CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');
```

### Key Effects
Hover tooltips, chart zoom on click, row highlighting on hover, smooth filter animations, data loading spinners

### Avoid (Anti-patterns)
- Ornate design
- No filtering

### Pre-Delivery Checklist
- [ ] No emojis as icons (use SVG: Heroicons/Lucide)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] prefers-reduced-motion respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px



## UI Pro Max Search Results
**Domain:** ux | **Query:** keyboard focus modal
**Source:** ux-guidelines.csv | **Found:** 3 results

### Result 1
- **Category:** Interaction
- **Issue:** Focus States
- **Platform:** All
- **Description:** Keyboard focus, including controls inside a modal, needs a visible indicator
- **Do:** Use a visible focus ring on every interactive control, including modal controls
- **Don't:** Remove focus outline without replacement
- **Code Example Good:** focus:ring-2 focus:ring-blue-500
- **Code Example Bad:** outline-none without alternative
- **Severity:** High

### Result 2
- **Category:** Accessibility
- **Issue:** Focus Not Obscured (Enhanced)
- **Platform:** Web
- **Description:** WCAG 2.2 AAA requires keyboard focus to remain fully visible
- **Do:** Keep the entire focused component unobscured by author-created content
- **Don't:** Present this enhanced AAA criterion as an AA requirement or allow persistent UI to hide any part of focus
- **Code Example Good:** close persistent overlay before focus moves behind it
- **Code Example Bad:** sticky footer covers half the focused button
- **Severity:** Medium

### Result 3
- **Category:** Accessibility
- **Issue:** Focus Not Obscured (Minimum)
- **Platform:** Web
- **Description:** WCAG 2.2 AA requires keyboard focus to remain at least partially visible
- **Do:** Offset sticky UI with scroll-padding and dismiss or move persistent overlays
- **Don't:** Let headers footers banners or chat widgets fully cover focus
- **Code Example Good:** scroll-padding-top: var(--header-height)
- **Code Example Bad:** fixed overlay covers :focus
- **Severity:** High



## UI Pro Max Stack Guidelines
**Stack:** nextjs | **Query:** loading error forms
**Source:** stacks/nextjs.csv | **Found:** 3 results

### Result 1
- **Category:** Routing
- **Guideline:** Handle loading states
- **Description:** Use loading.tsx for route loading UI
- **Do:** loading.tsx alongside page.tsx
- **Don't:** Manual loading state management
- **Code Good:** app/dashboard/loading.tsx
- **Code Bad:** useState for loading in page
- **Severity:** Medium
- **Docs URL:** https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming
- **Applies To:** nextjs 16.2
- **Status:** active
- **Verified At:** 2026-08-13

### Result 2
- **Category:** Routing
- **Guideline:** Handle errors with error.tsx
- **Description:** Catch errors at route level
- **Do:** error.tsx with reset function
- **Don't:** try/catch in every component
- **Code Good:** app/dashboard/error.tsx
- **Code Bad:** try/catch in page component
- **Severity:** High
- **Docs URL:** https://nextjs.org/docs/app/building-your-application/routing/error-handling
- **Applies To:** nextjs 16.2
- **Status:** active
- **Verified At:** 2026-08-13

### Result 3
- **Category:** DataFetching
- **Guideline:** Use Server Actions for mutations
- **Description:** Server Actions for form submissions
- **Do:** action={serverAction} in forms
- **Don't:** API route for every mutation
- **Code Good:** <form action={createPost}>
- **Code Bad:** <form onSubmit={callApiRoute}>
- **Severity:** Medium
- **Docs URL:** https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- **Applies To:** nextjs 16.2
- **Status:** active
- **Verified At:** 2026-08-13



## UI Pro Max Stack Guidelines
**Stack:** react | **Query:** form accessible label
**Source:** stacks/react.csv | **Found:** 3 results

### Result 1
- **Category:** Accessibility
- **Guideline:** Label form controls
- **Description:** Associate labels with inputs
- **Do:** htmlFor matching input id
- **Don't:** Placeholder as only label
- **Code Good:** <label htmlFor="email">Email</label>
- **Code Bad:** <input placeholder="Email"/>
- **Severity:** High
- **Docs URL:** https://react.dev/reference/react-dom/components/input
- **Applies To:** react 19.2.x
- **Status:** active
- **Verified At:** 2026-08-13

### Result 2
- **Category:** Testing
- **Guideline:** Use testing-library queries
- **Description:** Use accessible queries
- **Do:** getByRole getByLabelText
- **Don't:** getByTestId for everything
- **Code Good:** getByRole('button')
- **Code Bad:** getByTestId('submit-btn')
- **Severity:** Medium
- **Docs URL:** https://testing-library.com/docs/queries/about#priority
- **Applies To:** react 19.2.x
- **Status:** active
- **Verified At:** 2026-08-13

### Result 3
- **Category:** Forms
- **Guideline:** Call useFormStatus from a form child
- **Description:** Reads submission status from the nearest parent form.
- **Do:** Call it in a child rendered inside the form
- **Don't:** Call it in the component that renders the form
- **Code Good:** function Submit(){ const { pending } = useFormStatus(); return <button disabled={pending}>Save</button> }
- **Code Bad:** function Form(){ const { pending } = useFormStatus(); return <form>...</form> }
- **Severity:** High
- **Docs URL:** https://react.dev/reference/react-dom/hooks/useFormStatus
- **Applies To:** react 19.2.x
- **Status:** active
- **Verified At:** 2026-09-21



## UI Pro Max Stack Guidelines
**Stack:** html-tailwind | **Query:** responsive table overflow
**Source:** stacks/html-tailwind.csv | **Found:** 3 results

### Result 1
- **Category:** Typography
- **Guideline:** Text truncation
- **Description:** Handle long text gracefully
- **Do:** truncate or line-clamp-*
- **Don't:** Overflow breaking layout
- **Code Good:** line-clamp-2
- **Code Bad:** No overflow handling
- **Severity:** Medium
- **Docs URL:** https://tailwindcss.com/docs/text-overflow
- **Applies To:** html-tailwind 4.3
- **Status:** active
- **Verified At:** 2026-08-13

### Result 2
- **Category:** Layout
- **Guideline:** Compact label layout
- **Description:** Handle chip and badge text overflow without breaking compact labels or hiding collection values
- **Do:** Use flex flex-wrap gap-2 for collections; for one label use whitespace-nowrap bounded min-w-0 truncate and shrink-0 controls
- **Don't:** Clip a fixed-height row let labels wrap inside a pill or let dismiss icons shrink
- **Code Good:** flex flex-wrap gap-2; label min-w-0 whitespace-nowrap truncate; icon shrink-0
- **Code Bad:** flex h-8 overflow-hidden
- **Severity:** High
- **Docs URL:** https://tailwindcss.com/docs/flex-wrap
- **Applies To:** html-tailwind 4.3
- **Status:** active
- **Verified At:** 2026-08-13

### Result 3
- **Category:** Images
- **Guideline:** Reserve image space
- **Description:** Give image wrappers an aspect ratio or dimensions to avoid layout shifts
- **Do:** aspect-video or explicit dimensions
- **Don't:** Let images determine layout after load
- **Code Good:** aspect-video overflow-hidden
- **Code Bad:** Image without reserved space
- **Severity:** High
- **Docs URL:** https://tailwindcss.com/docs/aspect-ratio
- **Applies To:** html-tailwind 4.3
- **Status:** active
- **Verified At:** 2026-08-13



## UI Pro Max Stack Guidelines
**Stack:** shadcn | **Query:** dialog focus
**Source:** stacks/shadcn.csv | **Found:** 3 results

### Result 1
- **Category:** A11y
- **Guideline:** Maintain focus management
- **Description:** Dialog Sheet handle focus automatically
- **Do:** Let components manage focus
- **Don't:** Custom focus handling
- **Code Good:** <Dialog> traps focus
- **Code Bad:** document.querySelector().focus()
- **Severity:** High
- **Docs URL:** https://ui.shadcn.com/docs/components/dialog
- **Applies To:** shadcn cli 4; base=base|radix|aria
- **Status:** active
- **Verified At:** 2026-08-13

### Result 2
- **Category:** Dialog
- **Guideline:** Use Dialog for modal content
- **Description:** Dialog component for overlay modal windows
- **Do:** Dialog for confirmations forms details
- **Don't:** Alert for modal content
- **Code Good:** <Dialog><DialogContent>
- **Code Bad:** <Alert> styled as modal
- **Severity:** High
- **Docs URL:** https://ui.shadcn.com/docs/components/dialog
- **Applies To:** shadcn cli 4; base=base|radix|aria
- **Status:** active
- **Verified At:** 2026-08-13

### Result 3
- **Category:** Dialog
- **Guideline:** Handle dialog state properly
- **Description:** Use open and onOpenChange for controlled dialogs
- **Do:** Controlled state with useState
- **Don't:** Uncontrolled with default open only
- **Code Good:** <Dialog open={open} onOpenChange={setOpen}>
- **Code Bad:** <Dialog defaultOpen={true}>
- **Severity:** Medium
- **Docs URL:** https://ui.shadcn.com/docs/components/dialog
- **Applies To:** shadcn cli 4; base=base|radix|aria
- **Status:** active
- **Verified At:** 2026-08-13



## UI Pro Max Search Results
**Domain:** chart | **Query:** monthly attendance trend
**Source:** charts.csv | **Found:** 1 results

### Result 1
- **Data Type:** Trend Over Time
- **Keywords:** trend, time-series, line, growth, timeline, progress, accessible chart, keyboard accessible chart
- **Best Chart Type:** Line Chart
- **Secondary Options:** Area Chart, Smooth Area
- **When to Use:** Data has a time axis; user needs to observe rise/fall trends or rate of change over a continuous period
- **When NOT to Use:** Fewer than 4 data points (use stat card); more than 6 series (visual noise); no time dimension exists
- **Data Volume Threshold:** <1000 pts: SVG; ≥1000 pts: Canvas + downsampling; >10000: aggregate to intervals
- **Color Guidance:** Primary: #0080FF. Multiple series: distinct colors + distinct line styles. Fill: 20% opacity
- **Accessibility Grade:** deprecated: use Accessibility Risk
- **Accessibility Risk:** risk:low
- **Accessibility Notes:** Use solid, dashed, and dotted line styles plus direct series labels; never distinguish series by hue alone.
- **A11y Fallback:** Visible data table plus concise trend summary. Keyboard: focus reveals hover values; +/- buttons zoom; Reset restores the full range.
- **Library Recommendation:** Chart.js, Recharts, ApexCharts
- **Interactive Level:** Hover + Zoom



## UI Pro Max Search Results
**Domain:** icons | **Query:** navigation education
**Source:** icons.csv | **Found:** 0 results

No matches. This is not a match with an empty value -- the query did not hit the database. Retry with broader/different keywords before falling back to general defaults, and say explicitly that no database match was found if you do fall back.
**Closest known terms:** caution


## UI Pro Max Search Results
**Domain:** icons | **Query:** search
**Source:** icons.csv | **Found:** 0 results

No matches. This is not a match with an empty value -- the query did not hit the database. Retry with broader/different keywords before falling back to general defaults, and say explicitly that no database match was found if you do fall back.
