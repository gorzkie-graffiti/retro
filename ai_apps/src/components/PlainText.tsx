import { Fragment, type ReactNode } from "react";
import {
  parseMarkdown,
  type InlineNode,
  type MarkdownBlock,
} from "../lib/markdown";
import { splitCodeSegments } from "../lib/plainText";

interface PlainTextProps {
  content: string;
}

function renderInline(nodes: InlineNode[], prefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${prefix}-i-${index}`;

    switch (node.type) {
      case "text":
        return <Fragment key={key}>{node.value}</Fragment>;
      case "code":
        return (
          <code className="md-inline-code" key={key}>
            {node.value}
          </code>
        );
      case "strong":
        return (
          <strong className="md-strong" key={key}>
            {renderInline(node.children, key)}
          </strong>
        );
      case "emphasis":
        return (
          <em className="md-emphasis" key={key}>
            {renderInline(node.children, key)}
          </em>
        );
      case "delete":
        return (
          <del className="md-delete" key={key}>
            {renderInline(node.children, key)}
          </del>
        );
      case "link":
        return (
          <a
            className="md-link"
            href={node.href}
            key={key}
            rel="noreferrer noopener"
            target="_blank"
          >
            {renderInline(node.children, key)}
          </a>
        );
    }
  });
}

function renderBlocks(blocks: MarkdownBlock[], prefix: string): ReactNode[] {
  return blocks.map((block, index) => {
    const key = `${prefix}-b-${index}`;

    switch (block.type) {
      case "paragraph":
        return (
          <p className="md-paragraph" key={key}>
            {renderInline(block.children, key)}
          </p>
        );
      case "heading":
        return (
          <div
            aria-level={block.level}
            className={`md-heading md-heading--${block.level}`}
            key={key}
            role="heading"
          >
            {renderInline(block.children, key)}
          </div>
        );
      case "list": {
        const items = block.items.map((item, itemIndex) => (
          <li key={`${key}-item-${itemIndex}`}>
            {renderInline(item, `${key}-item-${itemIndex}`)}
          </li>
        ));
        return block.ordered ? (
          <ol className="md-list md-list--ordered" key={key} start={block.start}>
            {items}
          </ol>
        ) : (
          <ul className="md-list" key={key}>
            {items}
          </ul>
        );
      }
      case "blockquote":
        return (
          <blockquote className="md-blockquote" key={key}>
            {renderBlocks(block.blocks, key)}
          </blockquote>
        );
      case "rule":
        return <hr className="md-rule" key={key} />;
    }
  });
}

/**
 * Model answers use a dependency-free Markdown subset rendered exclusively as
 * React text/elements. Raw model HTML is never parsed or injected, so script
 * tags and event-handler attributes remain inert text.
 */
export function PlainText({ content }: PlainTextProps) {
  const segments = splitCodeSegments(content);

  return (
    <div className="plain-text">
      {segments.map((segment, index) => {
        if (segment.type === "code") {
          return (
            <div className="code-block" key={`code-${index}`}>
              <div className="code-block-label">
                CODE SAMPLE
                {segment.language ? ` / ${segment.language}` : ""}
              </div>
              <pre>
                <code>{segment.content}</code>
              </pre>
            </div>
          );
        }
        if (!segment.content.trim()) {
          return null;
        }
        return (
          <Fragment key={`md-${index}`}>
            {renderBlocks(parseMarkdown(segment.content), `md-${index}`)}
          </Fragment>
        );
      })}
    </div>
  );
}
