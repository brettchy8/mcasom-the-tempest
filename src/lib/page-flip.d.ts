declare module 'page-flip/dist/js/page-flip.module.js' {
  export class PageFlip {
    constructor(element: HTMLElement, settings: Record<string, number | string | boolean>);
    loadFromHTML(elements: NodeListOf<HTMLElement> | HTMLElement[]): void;
    on(event: string, callback: (event: { data: number | { page: number } }) => void): void;
    turnToPage(index: number): void;
    flipNext(): void;
    flipPrev(): void;
    getCurrentPageIndex(): number;
    update(): void;
    destroy(): void;
  }
}
