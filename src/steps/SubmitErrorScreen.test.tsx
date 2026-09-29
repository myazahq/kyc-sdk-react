import type { ReactElement, ReactNode } from 'react';
import { isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../i18n')>();
  return { ...actual, useText: () => actual.defaultText };
});

import { SubmitErrorScreen } from './SubmittedScreens';

const noop = () => undefined;

/** Every element in a rendered tree, depth first (the screen is hook-free once useText is mocked). */
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const el = node as ReactElement<Record<string, unknown>>;
  return [el, ...elements(el.props.children as ReactNode)];
}

const textOf = (node: ReactNode): string =>
  Array.isArray(node)
    ? node.map(textOf).join('')
    : typeof node === 'string'
      ? node
      : isValidElement(node)
        ? textOf((node.props as { children?: ReactNode }).children)
        : '';

describe('SubmitErrorScreen', () => {
  it('offers Go back beside Close, and no Try Again, when the refusal can be fixed', () => {
    const html = renderToStaticMarkup(
      <SubmitErrorScreen message='Upload them' onRetry={noop} onClose={noop} onGoBack={noop} />,
    );
    expect(html).toContain('Go back');
    expect(html).toContain('Close');
    expect(html).not.toContain('Try Again');
  });

  it('keeps Try Again and Close when there is nowhere to go back to', () => {
    const html = renderToStaticMarkup(<SubmitErrorScreen message='x' onRetry={noop} onClose={noop} />);
    expect(html).not.toContain('Go back');
    expect(html).toContain('Try Again');
    expect(html).toContain('Close');
  });

  it('calls the Go back handler', () => {
    const onGoBack = vi.fn();
    const tree = SubmitErrorScreen({ message: 'x', onRetry: noop, onClose: noop, onGoBack });
    const button = elements(tree).find(
      (el) => typeof el.props.onClick === 'function' && textOf(el.props.children as ReactNode).includes('Go back'),
    );
    expect(button).toBeDefined();
    (button!.props.onClick as () => void)();
    expect(onGoBack).toHaveBeenCalledTimes(1);
  });
});
