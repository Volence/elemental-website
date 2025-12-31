# SCSS Nesting Issues Fixed

**Date**: December 25, 2025  
**Issue**: Attribute selectors with nested `&` selectors cause SCSS compilation errors

## The Problem

SCSS doesn't allow nesting the parent selector (`&`) inside attribute selectors like `[class*="modal"]` because it tries to create invalid CSS like `[class*="modal"]__content`.

### Error Message
```
Selector "[class*='modal']" can't have a suffix
```

## Files Fixed

### 1. `_modals.scss`

**Before (BROKEN):**
```scss
.modal,
.drawer,
[class*="modal"],
[class*="drawer"] {
  backdrop-filter: blur(8px);
  
  &__content {  // ❌ Creates invalid selector
    @include glow-card($admin-accent-primary);
  }
}
```

**After (FIXED):**
```scss
.modal,
.drawer {
  backdrop-filter: blur(8px);
}

// Separate selector - no nesting
.modal__content,
.drawer__content {
  @include glow-card($admin-accent-primary);
}
```

### 2. `_payload-overrides.scss` - Modals Section

**Before (BROKEN):**
```scss
.modal,
.popup,
.drawer {
  backdrop-filter: blur(8px);
  
  [class*="modal__content"],  // ❌ Attribute selector nested
  [class*="popup__content"] {
    @include glow-card($admin-accent-primary);
  }
}
```

**After (FIXED):**
```scss
.modal,
.popup,
.drawer {
  backdrop-filter: blur(8px);
}

// Explicit class names - no attribute selectors
.modal__content,
.popup__content,
.drawer__content {
  @include glow-card($admin-accent-primary);
}
```

### 3. `_payload-overrides.scss` - Toasts Section

**Before (BROKEN):**
```scss
[class*="toast"],
[class*="notification"] {
  @include glow-card($admin-accent-info);
  
  &[class*="success"] {  // ❌ Compound attribute selector
    @include glow-card($admin-accent-success);
  }
}
```

**After (FIXED):**
```scss
.toast,
.notification {
  @include glow-card($admin-accent-info);
}

// Use explicit classes and modifiers
.toast--success,
.notification--success,
.toast.success,
.notification.success {
  @include glow-card($admin-accent-success);
}
```

## Key Principles

### ✅ SAFE Patterns

```scss
// Regular class selectors with nesting - OK
.modal {
  &__content { }  // ✅ Creates .modal__content
  &:hover { }     // ✅ Creates .modal:hover
  &::before { }   // ✅ Creates .modal::before
}

// Attribute selectors without nesting - OK
[class*="modal"] {
  color: red;     // ✅ No nesting
}
```

### ❌ UNSAFE Patterns

```scss
// Attribute selector with & nesting - BREAKS
[class*="modal"] {
  &__content { }  // ❌ Tries to create [class*="modal"]__content
  &--active { }   // ❌ Tries to create [class*="modal"]--active
}

// Compound attribute selectors - RISKY
[class*="modal"] {
  &[class*="large"] { }  // ❌ May break
}
```

## Prevention Strategy

1. **Use explicit class names** instead of attribute selectors when nesting is needed
2. **Flatten nested structures** when using attribute selectors
3. **Test SCSS compilation** after refactoring
4. **Avoid `[class*="..."]` with `&__` patterns**

## Files Reviewed (No Issues Found)

- `_section-theming.scss` - Uses `&::before`, `&:hover` only (safe)
- `_buttons.scss` - No nested attribute selectors
- `_badges.scss` - Attribute selectors used safely without nesting
- `_forms.scss` - No problematic patterns
- `_typography.scss` - No problematic patterns

## Testing

After these fixes, the SCSS should compile without errors:

```bash
npm run build
# or
npm run dev
```

No more "Selector can't have a suffix" errors! 🎉

## Related Issues

- Button text truncation (fixed separately with width overrides)
- Modal responsiveness (improved as part of refactor)
- Section theming (working as expected)







