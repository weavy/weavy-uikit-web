# Guideline for Weavy SCSS

## Structure

* `/theme/base/` is the folder for core/common/abstract/vars.
* `/theme/vendor/` is the folder for external libraries, such as *bootstrap* or *prism*.
* `/theme/` is the folder for all components that we use.

## Namespace

* All our class names use the ´.wy-` prefix.
* All our intentionally exposed CSS custom properties (aka CSS variables) use the `--wy-` prefix.

## SCSS/CSS

* Everything should be easy to override on client side. Avoid nested or other complex selectors.
* Use `@use` and avoid ~~`@import`~~. *@import* is deprecated in SCSS. See [SASS: @import: Heads up](https://sass-lang.com/documentation/at-rules/import)
* Try to keep the namespaces instead of ~~`@use "example" as *;`~~. This gives clarity to what is external and improves code hinting and intellisense.
* *CSS Custom properties* always require you to use `$variable` within interpolation `#{$variable}` in SCSS. It's ok to use that on other properies as well. See [SASS: CSS Variable Syntax](https://sass-lang.com/documentation/breaking-changes/css-vars)
* Use `:where()` around selectors that you want to be easily overridden and have specificity 0. See [MDN: :where()](https://developer.mozilla.org/en-US/docs/Web/CSS/:where).
* When using `:root` selector for any css that is blocked by a Shadow DOM, combine it with shadow root selector `:host > *`. Combined with *:where()* this gives `:where(:root, :host > *)`.
* Avoid using `border` for things with a specific size or in tables. Border-sizes are based on floats, wich causes lots of issues for rendering and layout. Use *inset* `box-shadow` instead.

## Components

Try to write components as self-contained. Avoid dependencies to other *components* unless there is a good reason for it. 
It should be possible to `@use` the component without the need for *using* or *importing* other files.

* Intentionally exposed CSS custom properties should use the prefix and be placed within a `:root { }` selector. CSS custom properties falls through a Shadow DOM, so there is no need for ~~`:host > *`~~.
* Internal CSS custom properties can use a the prefix `--wy-component-`.
* Don't place `$variables` outside the component in another file unless they are actually shared. Shared variables should almost always be represented by an intentionally exposed CSS custom property.

## Colors

We use semantic colors from [Material Design 3 color system](https://m3.material.io/styles/color/overview). These are set using CSS custom properties and they are ready-to-use 'colors.token(--wy-token)' in the `base/color` module.

* We base our colors only on primary, neutral and error colors, but you shouldn't have to worry about that, since you are using semantic colors instead.
* Reference [MD3: color roles](https://m3.material.io/styles/color/the-color-system/color-roles) to pick colors to use
* All background colors have a corresponding *on*-color for the text.
* If you need another color, you should create it as an intentionally exposed CSS custom property. You can access colors via `color.token()`.

```scss
background-color: #{color.token(--wy-primary)};
color: #{color.token(--wy-on-primary)};
```

## Inherited colors/variables

For components that acts as some form of container that can contain other componens, we use internal CSS custom properties to define the colors it is using. 

This way, the current colors can be used by any component placed within the container. For example a *badge* may use the `--wy-component-background-color` of a *list-item* for it's `border-color`. 

When using a modifier class or similar in the container, you can just override the CSS custom property. If you override the CSS custom property in `:hover` or `:focus` you need to define the property where it's used once again, due to the order of the rules.

```scss
/* _container-example.scss */
.wy-container-example {
    --wy-component-background-color: #{color.token(--wy-surface-1)};
    --wy-component-color: #{color.token(--wy-on-surface)};

    background: var(--wy-component-background-color);
    color:  var(--wy-component-color);

    &:hover {
        --wy-component-background-color: #{color.token(--wy-surface-variant)};

        /* Note: background-color must be re-defined with the new color after the change, because the order of the rules. */
        background-color: var(--wy-component-background-color);
    }
}

/* _subnode-example.scss */
.wy-subnode-example {
    /* using inherited background-color together with default value */
    border-color: var(--wy-component-background-color, #{color.token(--wy-outline)})
}
```

```html
<div class="wy-container-component">
    <hr class="wy-subnode-component" />
<div>
```

## Bootstrap migration

* Consider rewriting the module inspired by their solution if it is too complex.
* Anything used from bootstrap should be copied into the component being used. 
* Remove parts of the CSS that aren't used.
* Replace `#{prefix}` with `wy-`.
* Move all definitions of CSS custom properties to `:root{}`.
* All bootstrap variables are available in the `base/vars` module. `@use 'base/vars';` and namespace any variables `vars.$spacer`.
* Bootstrap uses a size-adjustment called *rfs* for compatibility using mixins. We rely standard sizing and this and it breaks our layout. 
  
  Replace the mixins with their normal CSS representation:
  * `@include font-size(x);`  => `font-size: x;`
  * `@include border-top-radius(x);` => `border-top-left-radius: x; border-top-right-radius: x;`
  * ...and same for `padding()`, `margin()` etc.
* Additional functions/mixins needed may be ported and placed in 'base/`.