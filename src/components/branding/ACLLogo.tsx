import type { CSSProperties } from "react";

interface ACLLogoProps {
  variant?: "row" | "compact" | "stack" | "mark";
  onInk?: boolean;
  size?: number;
  className?: string;
}

function GrowthMark({ size = 80, showArc = true }: { size?: number; showArc?: boolean }) {
  const monoStyle = { ["--m" as string]: `${size}px` } as CSSProperties;

  return (
    <div className="acl-mono" style={monoStyle} aria-hidden="true">
      <div className="m-stage">
        <span className="ltr m-a">A</span>
        <span className="ltr m-c">C</span>
        <span className="ltr m-l">L</span>
        {showArc ? (
          <svg className="m-arc" viewBox="0 0 230 230" preserveAspectRatio="none">
            <path d="M -6 214 C 70 206, 150 150, 244 -8" />
            <circle cx="244" cy="-8" r="5.5" />
          </svg>
        ) : null}
      </div>
    </div>
  );
}

export function ACLLogo({
  variant = "row",
  onInk = false,
  size,
  className = "",
}: ACLLogoProps) {
  const style = size ? ({ ["--logo-size" as string]: `${size}px` } as CSSProperties) : undefined;
  const classes = `acl-logo ${onInk ? "on-ink" : ""} acl-logo--${variant} ${className}`.trim();
  const monoSize = size ? Math.max(size, 28) : variant === "stack" ? 120 : variant === "compact" ? 28 : variant === "mark" ? 30 : 52;
  const showArc = monoSize > 34;

  if (variant === "mark") {
    return (
      <div className={classes} style={style} aria-label="ACL Accounting Consulting Leaders">
        <GrowthMark size={monoSize} showArc={showArc} />
      </div>
    );
  }

  if (variant === "stack") {
    return (
      <div className={classes} style={style} aria-label="ACL Accounting Consulting Leaders">
        <GrowthMark size={monoSize} showArc={showArc} />
        <div className="acl-divider" />
        <div className="acl-tag">Accounting · Consulting · Leaders</div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={classes} style={style} aria-label="ACL Accounting Consulting Leaders">
        <GrowthMark size={monoSize} showArc={showArc} />
        <div className="acl-tag">Accounting · Consulting · Leaders</div>
      </div>
    );
  }

  return (
    <div className={classes} style={style} aria-label="ACL Accounting Consulting Leaders">
      <GrowthMark size={monoSize} showArc={showArc} />
      <div className="acl-bar" />
      <div className="acl-words">
        <span>Accounting</span>
        <span>Consulting</span>
        <span>Leaders</span>
      </div>
    </div>
  );
}
