# CSS Audit Findings - Wildcards and Overly Broad Selectors

## Wildcard Selectors Found (6 instances)

### 1. _production-dashboard.scss (Line 145)
```scss
* {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
}
```
**Issue**: Strips styling from ALL descendants
**Fix**: Target specific child elements (.btn__content, .btn__label)

### 2. _typography.scss (Line 140)
```scss
[class*="pill__"] * {
  text-transform: none;
  font-size: inherit;
  letter-spacing: normal;
}
```
**Issue**: Affects all descendants of pill elements
**Fix**: Target specific text elements within pills

### 3. _forms.scss (Line 559)
```scss
.array-field__row *,
.blocks-field__row * {
  border-left: none;
}
```
**Issue**: Removes borders from ALL nested elements
**Fix**: Target specific form field types

### 4. _modals.scss (Line 23-26)
```scss
[class*="modal"] *,
[class*="popup"] *,
.drawer *,
[class*="drawer"] * {
  border-top: none !important;
  border-bottom: none !important;
}
```
**Issue**: Removes borders from ALL modal content
**Fix**: Target specific modal sections

### 5. _navigation.scss (Line 36)
```scss
.nav > * {
  border: none !important;
  border-top: none !important;
  border-bottom: none !important;
}
```
**Issue**: Direct children selector is acceptable, but could be more specific
**Fix**: Target .nav > li, .nav > ul specifically

### 6. _cards.scss (Line 146)
```scss
> * {
  position: relative;
  z-index: $z-base;
}
```
**Issue**: Direct children selector in isolation context
**Fix**: This one is acceptable for layout purposes

## Action Items

- [ ] Fix _production-dashboard.scss wildcard
- [ ] Fix _typography.scss pill wildcard
- [ ] Fix _forms.scss array/blocks wildcard
- [ ] Fix _modals.scss wildcard
- [ ] Refine _navigation.scss selector
- [ ] Keep _cards.scss as is (layout-specific)

## Additional Notes

- Total `!important` flags: 338
- Total `html body` prefixes: 54
- These will be addressed in subsequent phases






