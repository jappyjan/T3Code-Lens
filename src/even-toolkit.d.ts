// ── Type stubs for even-toolkit ─────────────────────────────────────
// The even-toolkit package is available at runtime inside the Even Hub
// WebView but may not be installed during CI builds. These declarations
// let TypeScript compile without the package present.

declare module 'even-toolkit' {
  // ── Display types ───────────────────────────────────────────────

  export type LineStyle = 'normal' | 'meta' | 'separator' | 'inverted';

  export interface DisplayLine {
    text: string;
    inverted: boolean;
    style: LineStyle;
  }

  export interface DisplayData {
    lines: DisplayLine[];
  }

  // ── Action types ────────────────────────────────────────────────

  export type GlassActionType = 'HIGHLIGHT_MOVE' | 'SELECT_HIGHLIGHTED' | 'GO_BACK';

  export type GlassAction =
    | { type: 'HIGHLIGHT_MOVE'; direction: 'up' | 'down' }
    | { type: 'SELECT_HIGHLIGHTED' }
    | { type: 'GO_BACK' };

  export interface GlassNavState {
    highlightedIndex: number;
    screen: string;
  }

  // ── Display primitives ──────────────────────────────────────────

  export function line(text: string, style?: LineStyle, inverted?: boolean): DisplayLine;
  export function separator(): DisplayLine;
  export function glassHeader(title: string, actionBar?: string): DisplayLine[];

  // ── Display builders ────────────────────────────────────────────

  export const G2_TEXT_LINES: number;
  export const HEADER_LINES: number;
  export const DEFAULT_CONTENT_SLOTS: number;

  export function slidingWindowStart(
    highlightedIndex: number,
    totalItems: number,
    maxVisible: number,
  ): number;

  export interface ScrollableListOptions<T> {
    items: T[];
    highlightedIndex: number;
    maxVisible: number;
    formatter: (item: T, index: number) => string;
    style?: 'normal' | 'meta';
  }

  export function buildScrollableList<T>(opts: ScrollableListOptions<T>): DisplayLine[];

  export interface ScrollableContentOptions {
    title: string;
    actionBar: string;
    contentLines: string[];
    scrollPos: number;
    contentSlots?: number;
    contentStyle?: 'normal' | 'meta';
  }

  export function buildScrollableContent(opts: ScrollableContentOptions): DisplayData;
}

declare module 'even-toolkit/useGlasses' {
  import type { DisplayData, GlassAction, GlassNavState, ColumnData, SplitData } from 'even-toolkit';

  export interface UseGlassesConfig<S> {
    getSnapshot: () => S;
    toDisplayData: (snapshot: S, nav: GlassNavState) => DisplayData;
    onGlassAction: (action: GlassAction, nav: GlassNavState, snapshot: S) => GlassNavState;
    deriveScreen: (path: string) => string;
    appName: string;
    shutdownOnHomeBack?: boolean;
    shutdownMode?: 0 | 1;
  }

  export function useGlasses<S>(config: UseGlassesConfig<S>): void;
}

declare module 'even-toolkit/keyboard' {
  import type { GlassAction } from 'even-toolkit';
  export function bindKeyboard(dispatch: (action: GlassAction) => void): () => void;
}

declare module 'even-toolkit/stt' {
  export class STTEngine {
    constructor(config: {
      provider: unknown;
      onTranscript: (result: { text: string; isFinal: boolean }) => void;
      onError: (err: { message?: string }) => void;
      onEnd: () => void;
    });
    start(): Promise<void>;
    stop(): void;
  }

  export function createProvider(
    name: string,
    config: { apiKey?: string; language?: string },
  ): unknown;
}

declare module 'even-toolkit/web' {
  import type * as React from 'react';

  // ── Card ────────────────────────────────────────────────────────

  export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'elevated' | 'interactive';
    padding?: 'none' | 'default' | 'sm' | 'lg';
  }
  export const Card: React.ForwardRefExoticComponent<CardProps & React.RefAttributes<HTMLDivElement>>;
  export const cardVariants: Function;

  // ── Badge ───────────────────────────────────────────────────────

  export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'positive' | 'negative' | 'accent' | 'neutral';
  }
  export const Badge: React.ForwardRefExoticComponent<BadgeProps & React.RefAttributes<HTMLSpanElement>>;
  export const badgeVariants: Function;

  // ── Button ──────────────────────────────────────────────────────

  export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'highlight' | 'default' | 'ghost' | 'danger' | 'secondary';
    size?: 'default' | 'sm' | 'lg' | 'icon';
  }
  export const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
  export const buttonVariants: Function;

  // ── Input ───────────────────────────────────────────────────────

  export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
  export const Input: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>;

  // ── Select ──────────────────────────────────────────────────────

  export interface SelectOption {
    value: string;
    label: string;
  }

  export interface SelectProps {
    value?: string;
    options: SelectOption[];
    onValueChange?: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
  }
  export function Select(props: SelectProps): JSX.Element;

  // ── SettingsGroup ───────────────────────────────────────────────

  export interface SettingsGroupProps {
    label: string;
    children: React.ReactNode;
    className?: string;
  }
  export function SettingsGroup(props: SettingsGroupProps): JSX.Element;

  // ── SectionHeader ───────────────────────────────────────────────

  export interface SectionHeaderProps {
    title: string;
    action?: React.ReactNode;
    className?: string;
  }
  export function SectionHeader(props: SectionHeaderProps): JSX.Element;

  // ── ScreenHeader ────────────────────────────────────────────────

  export interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    className?: string;
  }
  export function ScreenHeader(props: ScreenHeaderProps): JSX.Element;

  // ── NavHeader ───────────────────────────────────────────────────

  export interface NavHeaderProps {
    title: React.ReactNode;
    left?: React.ReactNode;
    right?: React.ReactNode;
    className?: string;
  }
  export function NavHeader(props: NavHeaderProps): JSX.Element;
}

declare module 'even-toolkit/web/theme-dark.css' {}
declare module 'even-toolkit/web/theme-light.css' {}
declare module 'even-toolkit/web/typography.css' {}
