import { noChange } from "lit";
import { AttributePart, Directive, DirectiveParameters, PartInfo, PartType, directive } from "lit/async-directive.js";

/**
 * A key-value set of class names to truthy values.
 */
export interface ShadowPartInfo {
    readonly [name: string]: string | boolean | number;
  }

class ShadowPartMapDirective extends Directive {
    /**
     * Stores the ClassInfo object applied to a given AttributePart.
     * Used to unset existing values when a new ClassInfo object is applied.
     */
    private _previousShadowParts?: Set<string>;
    private _staticShadowParts?: Set<string>;
  
    constructor(partInfo: PartInfo) {
      super(partInfo);
      if (
        partInfo.type !== PartType.ATTRIBUTE ||
        partInfo.name !== 'part' ||
        (partInfo.strings?.length as number) > 2
      ) {
        throw new Error(
          '`partMap()` can only be used in the `part` attribute ' +
            'and must be the only section in the attribute.',
        );
      }
    }
  
    render(shadowPartInfo: ShadowPartInfo) {
      // Add spaces to ensure separation from static classes
      return (
        ' ' +
        Object.keys(shadowPartInfo)
          .filter((key) => shadowPartInfo[key])
          .join(' ') +
        ' '
      );
    }
  
    override update(part: AttributePart, [shadowPartInfo]: DirectiveParameters<this>) {
      // Remember dynamic classes on the first render
      if (this._previousShadowParts === undefined) {
        this._previousShadowParts = new Set();
        if (part.strings !== undefined) {
          this._staticShadowParts = new Set(
            part.strings
              .join(' ')
              .split(/\s/)
              .filter((s) => s !== ''),
          );
        }
        for (const name in shadowPartInfo) {
          if (shadowPartInfo[name] && !this._staticShadowParts?.has(name)) {
            this._previousShadowParts.add(name);
          }
        }
        return this.render(shadowPartInfo);
      }
  
      const partList = part.element.part;
  
      // Remove old classes that no longer apply
      for (const name of this._previousShadowParts) {
        if (!(name in shadowPartInfo)) {
          partList.remove(name);
          this._previousShadowParts.delete(name);
        }
      }
  
      // Add or remove classes based on their classMap value
      for (const name in shadowPartInfo) {
        // We explicitly want a loose truthy check of `value` because it seems
        // more convenient that '' and 0 are skipped.
        const value = !!shadowPartInfo[name];
        if (
          value !== this._previousShadowParts.has(name) &&
          !this._staticShadowParts?.has(name)
        ) {
          if (value) {
            partList.add(name);
            this._previousShadowParts.add(name);
          } else {
            partList.remove(name);
            this._previousShadowParts.delete(name);
          }
        }
      }
      return noChange;
    }
  }
  
  /**
   * A directive that applies dynamic shadow part names.
   *
   * This must be used in the `part` attribute and must be the only part used in
   * the attribute. It takes each property in the `shadowPartInfo` argument and adds
   * the property name to the element's `part` property if the property value is
   * truthy; if the property value is falsey, the property name is removed from
   * the element's `part`.
   *
   * For example `{foo: bar}` applies the part `foo` if the value of `bar` is
   * truthy.
   *
   * @param partMap
   */
  export const partMap = directive(ShadowPartMapDirective);
  
  /**
   * The type of the class that powers this directive. Necessary for naming the
   * directive's return type.
   */
  export type {ShadowPartMapDirective};