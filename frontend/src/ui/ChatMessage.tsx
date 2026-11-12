import { isValidElement, memo, type ReactNode, useEffect, useState } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

function CodeBlock({ children }: { children?: ReactNode }): ReactNode {
  const [copied, setCopied] = useState<'ready' | 'copied' | 'failed'>('ready');
  const code = isValidElement<{ className?: string; children?: ReactNode }>(children) ? children : null;
  const language = /(?:^|\s)language-([^\s]+)/.exec(code?.props.className ?? '')?.[1] ?? 'text';
  const text = typeof code?.props.children === 'string' ? code.props.children.replace(/\n$/, '') : '';

  useEffect(() => {
    if (copied === 'ready') return;
    const timer = window.setTimeout(() => setCopied('ready'), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <div className="chat-code-block">
      <div className="chat-code-heading">
        <span>{language}</span>
        <button type="button" aria-label={`Copy ${language} code`} onClick={() => {
          void (async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied('copied');
            } catch {
              setCopied('failed');
            }
          })();
        }}>{copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Try again' : 'Copy'}</button>
      </div>
      <pre><code className={code?.props.className}>{text}</code></pre>
      <span className="chat-copy-status" role="status">
        {copied === 'copied' ? 'Code copied to clipboard.' : copied === 'failed' ? 'Could not copy code. Select and copy it manually.' : ''}
      </span>
    </div>
  );
}

const components: Components = {
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  table: ({ children }) => <div className="chat-table-scroll" tabIndex={0} role="region" aria-label="Message table"><table>{children}</table></div>,
  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
  img: ({ src, alt, title }) => <img src={src} alt={alt ?? ''} title={title} loading="lazy" />,
};

/** Parse Markdown into React elements; raw HTML is never executed. */
export const ChatMessage = memo(function ChatMessage({ content }: { content: string }): ReactNode {
  return <div className="chat-markdown">
    <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml>{content}</Markdown>
  </div>;
});
