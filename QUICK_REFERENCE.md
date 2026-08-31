# Quick Reference: Neon Brand Usage Guide

## 🎨 When to Use Neon Green

### ✅ DO Use Neon For:
```tsx
// Primary call-to-action buttons
<button className="bg-brand-neon">Book Now</button>

// Active/selected states
<Link className={isActive ? "text-brand-neon" : "text-brand-muted"}>

// Success indicators
<CheckCircle className="text-brand-neon" />

// Status badges (operational, active, live)
<span className="text-brand-neon">Active</span>

// Hover states on key elements
.hover:text-brand-neon

// Logo accent
Nokael<span className="text-brand-neon">.</span>

// Data that needs emphasis (in stats grids)
<p className="text-brand-neon">AED 275</p>
```

### ❌ DON'T Use Neon For:
```tsx
// Every icon - alternate with blue
<Icon className="text-brand-blue" /> // Also valid

// Body text - use brand-text or brand-muted
<p className="text-brand-text">Regular content</p>

// All borders - most should be brand-border
<div className="border-brand-border"> // Not brand-neon

// Background fills - use at 10% opacity max
<div className="bg-brand-neon/10"> // Not bg-brand-neon

// Every hover state - vary your interactions
.hover:border-brand-border // Some elements don't need neon

// Section backgrounds - keep it subtle
<section className="bg-brand-surface"> // Not neon-tinted
```

---

## 📐 Typography Scale

### Font Sizes
```css
/* Display - Hero only */
text-5xl md:text-8xl lg:text-9xl (48-144px)

/* H1 - Page titles */  
text-4xl md:text-6xl (36-60px)

/* H2 - Section headers */
text-3xl md:text-5xl (30-48px)

/* H3 - Card titles */
text-xl md:text-2xl (20-24px)

/* Body - Default text */
text-base (16px)

/* Small - Metadata */
text-sm (14px)

/* Tiny - Labels */
text-xs (12px)

/* Micro - Badges */
text-[11px] (11px)
```

### Font Weights
```css
/* Headlines */
font-semibold // Use this for most headings

/* Important text */
font-bold // CTAs, labels, emphasis

/* Body */
font-normal // Most body copy (not medium!)

/* Display large text */
font-medium // Only for hero/display sizes
```

### Letter Spacing
```css
/* Normal - Most text */
tracking-tight // -0.02em (default for headings)

/* Labels only */
tracking-wider // 0.05em (not 0.3em!)

/* Avoid */
tracking-tighter // Too tight
tracking-widest // Too aggressive
```

---

## 🎯 Button Styles

### Primary CTA (Neon)
```tsx
<button className="bg-brand-neon text-brand-bg font-bold px-6 py-4 rounded-xl 
  shadow-lg shadow-brand-neon/20 hover:opacity-90 transition-all">
  Book Now
</button>
```

### Secondary CTA
```tsx
<button className="bg-brand-surface border border-brand-border text-brand-text 
  font-bold px-6 py-4 rounded-xl hover:border-brand-border/60 transition-all">
  Learn More
</button>
```

### Text Link
```tsx
<Link className="text-brand-muted hover:text-brand-neon transition-colors">
  View details
</Link>
```

---

## 🏷️ Badge Patterns

### Status Badge (Neon)
```tsx
<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full 
  bg-brand-neon/10 border border-brand-neon/20">
  <div className="w-1 h-1 rounded-full bg-brand-neon" />
  <span className="text-[11px] font-bold uppercase tracking-wider text-brand-neon">
    Active
  </span>
</div>
```

### Info Badge (Neutral)
```tsx
<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full 
  bg-brand-surface border border-brand-border">
  <Icon className="w-3.5 h-3.5 text-brand-muted" />
  <span className="text-[11px] font-semibold text-brand-text">
    Licensed UAE Operator
  </span>
</div>
```

### Section Label Badge
```tsx
<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full 
  bg-brand-neon/10 border border-brand-neon/20 mb-6">
  <div className="w-1 h-1 rounded-full bg-brand-neon" />
  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-neon">
    Section Label
  </p>
</div>
```

---

## 📦 Card Patterns

### Feature Card
```tsx
<div className="p-8 rounded-3xl bg-gradient-to-br from-brand-input to-brand-surface 
  border border-brand-input-border hover:border-brand-neon/30 
  transition-all duration-300 group">
  
  {/* Icon */}
  <div className="w-12 h-12 rounded-2xl bg-brand-neon/10 
    flex items-center justify-center mb-8 
    group-hover:scale-110 transition-transform">
    <Icon className="w-6 h-6 text-brand-neon" />
  </div>
  
  {/* Content */}
  <h3 className="text-xl font-bold mb-4 text-brand-text">Title</h3>
  <p className="text-sm text-brand-muted leading-relaxed">Description</p>
  
  {/* Gradient accent */}
  <div className="absolute -bottom-24 -right-24 w-48 h-48 blur-3xl 
    bg-brand-neon/10 opacity-0 group-hover:opacity-100 
    transition-opacity duration-700" />
</div>
```

### Simple Card
```tsx
<div className="p-6 rounded-2xl bg-brand-surface border border-brand-border 
  hover:border-brand-neon/20 transition-all duration-300">
  <h3 className="text-lg font-bold mb-3 text-brand-text">Title</h3>
  <p className="text-sm text-brand-muted leading-relaxed">Content</p>
</div>
```

---

## 🎨 Color Combinations

### Neon + Dark (Primary)
```tsx
className="bg-brand-neon text-brand-bg"
// Use for: Primary CTAs, active states
```

### Neon Glow on Dark
```tsx
className="bg-brand-surface border border-brand-neon/20 text-brand-neon"
// Use for: Featured elements, active cards
```

### Blue + Dark (Secondary)
```tsx
className="bg-brand-blue/10 text-brand-blue"
// Use for: Info states, alternate icons
```

### Neutral (Most Content)
```tsx
className="bg-brand-surface border border-brand-border text-brand-text"
// Use for: Cards, forms, content areas
```

### Subtle Background
```tsx
className="bg-brand-input border border-brand-input-border"
// Use for: Input fields, nested cards
```

---

## 📱 Responsive Patterns

### Section Padding
```tsx
className="py-24 md:py-32" // Standard section
className="py-32 md:py-40" // Hero/major sections
```

### Grid Layouts
```tsx
// 4 columns desktop, 2 tablet, 1 mobile
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"

// 3 columns desktop, 2 tablet, 1 mobile  
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"

// 2 columns everywhere except mobile
className="grid grid-cols-1 md:grid-cols-2 gap-8"
```

### Text Sizing
```tsx
// Hero headline
className="text-5xl md:text-8xl lg:text-9xl"

// Section header
className="text-3xl md:text-5xl"

// Subheading
className="text-xl md:text-2xl"
```

---

## ⚡ Animation Patterns

### Hover Lift
```tsx
className="transition-all duration-300 hover:translate-y-[-2px]"
```

### Scale on Hover
```tsx
className="transition-transform duration-300 group-hover:scale-110"
```

### Gradient Shift
```tsx
<div className="absolute ... bg-brand-neon/10 blur-3xl 
  opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
```

### Icon Animate
```tsx
<Icon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
```

### Custom Easing
```tsx
transition={{ 
  duration: 0.8,
  ease: [0.16, 1, 0.3, 1] // Smooth, natural
}}
```

---

## 🚫 Common Mistakes to Avoid

### Typography
```tsx
❌ className="text-[10px] uppercase tracking-[0.3em]"
✅ className="text-xs font-semibold tracking-wider"

❌ className="font-black uppercase tracking-widest"
✅ className="font-bold"

❌ className="tracking-tighter" // Too tight
✅ className="tracking-tight"   // Just right
```

### Colors
```tsx
❌ className="text-brand-neon" // On body text
✅ className="text-brand-text" // Body should be readable

❌ className="border-brand-neon" // All borders
✅ className="border-brand-border" // Most borders

❌ className="bg-brand-neon/50" // Too much
✅ className="bg-brand-neon/10"  // Subtle
```

### Spacing
```tsx
❌ className="gap-4" // Too tight for cards
✅ className="gap-6" // Better breathing room

❌ className="px-12 py-2" // Disproportionate
✅ className="px-12 py-6" // Balanced
```

---

## ✨ Quick Wins Checklist

### Copy Updates (10 min)
- [ ] Replace "Dispatch" with simpler terms
- [ ] Remove unnecessary "Urgent/Immediate"  
- [ ] Simplify navigation labels
- [ ] Update CTA button text
- [ ] Rewrite footer description

### Visual Updates (15 min)
- [ ] Check all icons aren't just neon (alternate blue)
- [ ] Verify uppercase only on badges/labels
- [ ] Ensure cards have subtle gradients
- [ ] Check button shadows are multi-layer
- [ ] Add pill badges to section headers

### Content Updates (30 min)
- [ ] Add one real delivery example with timestamp
- [ ] Add license number to footer
- [ ] Add "Operating since [date]"
- [ ] Add specific corridor example
- [ ] Update one stock photo

---

## 🎯 Brand Voice Guidelines

### ✅ Sound Like This:
- "Book a driver" (clear, direct)
- "90 minutes to Abu Dhabi" (specific)
- "One driver, straight there" (simple promise)
- "Licensed since 2023" (credible)

### ❌ Not Like This:
- "Request immediate pickup dispatch" (robotic)
- "Rapid intercity transit corridor" (jargon)
- "Direct-response logistics dispatch system" (corporate)
- "Fully licensed UAE logistics operator" (formal)

### Tone Principles:
1. **Confident** - We know what we do
2. **Specific** - Real numbers, real examples
3. **Direct** - Short sentences, clear meaning
4. **Human** - Like talking to a dispatcher, not a robot

---

## 📏 Design System Summary

### Colors
- **Neon** (#39FF14): Primary actions, active states
- **Blue** (#2D7DFF): Secondary info, alternate accent
- **Text** (#E6EAF0): Body copy
- **Muted** (#B3B3B3): Secondary text
- **Surface** (#1A1A1A): Cards, elevated elements
- **Border** (rgba(255,255,255,0.05)): Subtle divisions

### Spacing
- **Gap** between cards: 6 (1.5rem)
- **Padding** in cards: 8 (2rem)
- **Section** padding: 24-32 (6-8rem)
- **Button** padding: px-6 py-4

### Borders
- **Radius** for cards: rounded-2xl or rounded-3xl
- **Radius** for buttons: rounded-xl
- **Radius** for badges: rounded-full
- **Width**: 1px default

### Shadows
- **Button**: `shadow-lg shadow-brand-neon/20`
- **Card hover**: `0 8px 30px rgba(0,0,0,0.1)`
- **Neon glow**: Multi-layer (see index.css)

---

## 🔄 Review Checklist

Before deploying new sections/components:

- [ ] Neon used strategically (not everywhere)?
- [ ] Typography readable (not too small/tight)?
- [ ] Uppercase only on labels?
- [ ] Copy clear and specific?
- [ ] Buttons have proper shadows?
- [ ] Cards have subtle texture?
- [ ] Hover states smooth?
- [ ] Mobile responsive?
- [ ] Accessible focus states?
- [ ] Animations respect reduced-motion?

---

Use this as your go-to reference when building new components or updating existing ones. The goal is consistency without monotony, boldness without overwhelm.
