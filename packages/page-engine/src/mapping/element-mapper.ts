export class ElementMapper {
  private elementToId = new WeakMap<Element, string>();
  private idToElement = new Map<string, Element>();
  private nextId = 1;

  reset(): void {
    // Keep the weak element identity for this Document lifetime, but expose
    // only elements selected by the current snapshot through idToElement.
    this.idToElement.clear();
  }

  getOrAssign(element: Element): string {
    const existing = this.elementToId.get(element);
    if (existing) {
      this.idToElement.set(existing, element);
      return existing;
    }

    const id = `node-${String(this.nextId).padStart(5, "0")}`;
    this.nextId += 1;
    this.elementToId.set(element, id);
    this.idToElement.set(id, element);
    return id;
  }

  getId(element: Element): string | undefined {
    return this.elementToId.get(element);
  }

  hasId(id: string): boolean {
    return this.idToElement.has(id);
  }

  resolve(id: string): Element | undefined {
    const element = this.idToElement.get(id);
    if (!element) return undefined;
    if (!element.isConnected) {
      this.idToElement.delete(id);
      return undefined;
    }
    return element;
  }
}
