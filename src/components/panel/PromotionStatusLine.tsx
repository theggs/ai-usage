import type { RefObject } from "react";
import type { CopyTree } from "../../app/shared/i18n";
import {
  formatPromotionDetailTiming,
  formatPromotionServiceDecision,
  getPromotionCompactStatusLabel,
  getPromotionPopoverLabel,
  getPromotionStatusLabel,
  getPromotionTriggerLabel
} from "../../app/shared/i18n";
import type {
  PromotionDisplayDecision,
  PromotionOverlayState,
  PromotionServiceDecision
} from "../../features/promotions/types";
import claudeCodeIcon from "../../assets/icons/service-claude-code.svg";
import codexIcon from "../../assets/icons/service-codex.svg";

const ICON_BY_SERVICE_ID: Record<string, string> = {
  codex: codexIcon,
  "claude-code": claudeCodeIcon
};

const STATUS_TONE_CLASS: Record<PromotionServiceDecision["status"], string> = {
  "active-window": "promotion-pill-active-window",
  "active-general": "promotion-pill-active-general",
  "inactive-window": "promotion-pill-inactive-window",
  "eligibility-unknown": "promotion-pill-eligibility-unknown",
  none: "promotion-pill-none"
};

const PromotionPill = ({
  copy,
  decision,
  compact
}: {
  copy: CopyTree;
  decision: PromotionServiceDecision;
  compact?: boolean;
}) => {
  const iconSrc = ICON_BY_SERVICE_ID[decision.serviceId];
  const pillToneClass = STATUS_TONE_CLASS[decision.status];
  const compactLabel =
    decision.benefitLabel &&
    (decision.status === "active-window" || decision.status === "active-general")
      ? decision.benefitLabel
      : getPromotionCompactStatusLabel(copy, decision.status);

  return (
    <span
      className={`promotion-pill ${pillToneClass} ${compact ? "promotion-pill-compact" : ""}`}
      data-testid={`promotion-pill-${decision.serviceId}`}
      title={formatPromotionServiceDecision(copy, decision)}
    >
      {iconSrc ? (
        <img
          alt=""
          aria-hidden="true"
          className="promotion-pill-icon"
          data-testid={`promotion-pill-icon-${decision.serviceId}`}
          src={iconSrc}
        />
      ) : null}
      <span className="promotion-pill-label">
        {compactLabel}
      </span>
    </span>
  );
};

const PromotionPopoverItem = ({
  copy,
  decision
}: {
  copy: CopyTree;
  decision: PromotionServiceDecision;
}) => {
  const iconSrc = ICON_BY_SERVICE_ID[decision.serviceId];
  const pillToneClass = STATUS_TONE_CLASS[decision.status];

  return (
    <div
      className={`promotion-popover-item ${pillToneClass}`}
      data-testid={`promotion-popover-item-${decision.serviceId}`}
      title={formatPromotionServiceDecision(copy, decision)}
    >
      <div className="promotion-popover-main">
        <div className="promotion-popover-header">
          <div className="promotion-popover-identity">
            {iconSrc ? (
              <img
                alt=""
                aria-hidden="true"
                className="promotion-pill-icon"
                data-testid={`promotion-popover-icon-${decision.serviceId}`}
                src={iconSrc}
              />
            ) : null}
            <span className="promotion-popover-service">{decision.serviceName}</span>
          </div>
          <div className="promotion-popover-badges">
            <span
              className={`promotion-popover-badge promotion-popover-status-badge ${pillToneClass}`}
              data-testid={`promotion-popover-status-${decision.serviceId}`}
            >
              {getPromotionStatusLabel(copy, decision.status)}
            </span>
            {decision.benefitLabel ? (
              <span
                className={`promotion-popover-badge promotion-popover-benefit-badge ${pillToneClass}`}
                data-testid={`promotion-popover-benefit-${decision.serviceId}`}
              >
                {decision.benefitLabel}
              </span>
            ) : null}
          </div>
        </div>
        {formatPromotionDetailTiming(copy, decision.detailTiming) ? (
          <div
            className="promotion-popover-detail"
            data-testid={`promotion-popover-detail-${decision.serviceId}`}
          >
            {formatPromotionDetailTiming(copy, decision.detailTiming)}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const PromotionStatusLine = ({
  copy,
  overlayState,
  promotionDecision,
  rootRef,
  onPreviewStart,
  onPreviewEnd,
  onPin
}: {
  copy: CopyTree;
  overlayState: PromotionOverlayState;
  promotionDecision: PromotionDisplayDecision;
  rootRef?: RefObject<HTMLDivElement | null>;
  onPreviewStart?: () => void;
  onPreviewEnd?: () => void;
  onPin?: () => void;
}) => {
  const canOpenPopover = promotionDecision.allServices.length > 0;
  const shouldShowPopover = overlayState !== "closed" && promotionDecision.allServices.length > 0;
  const showFallback = promotionDecision.fallbackState === "none" || promotionDecision.inlineServices.length === 0;

  return (
    <div
      ref={rootRef}
      className="promotion-status-line relative mt-1 min-w-0"
      data-testid="promotion-status-line"
      onBlurCapture={(event) => {
        if (overlayState === "pinned") {
          return;
        }
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
          return;
        }
        onPreviewEnd?.();
      }}
      onFocusCapture={() => onPreviewStart?.()}
      onMouseEnter={() => onPreviewStart?.()}
      onMouseLeave={() => onPreviewEnd?.()}
    >
      <button
        aria-expanded={shouldShowPopover}
        aria-haspopup={canOpenPopover ? "dialog" : undefined}
        aria-label={getPromotionTriggerLabel(copy, overlayState)}
        className="promotion-trigger flex min-w-0 max-w-full items-center gap-1.5 rounded-xl bg-transparent px-0 py-0.5 text-left"
        data-testid="promotion-status-trigger"
        onClick={() => {
          if (!canOpenPopover) {
            return;
          }
          onPin?.();
        }}
        type="button"
      >
        {showFallback ? (
          <span
            className="promotion-fallback text-[11px] leading-[1.15] text-slate-500"
            data-testid="promotion-status-fallback"
          >
            {copy.promotionNoneKnown}
          </span>
        ) : (
          <span className="promotion-pill-row" data-testid="promotion-pill-row">
            {promotionDecision.inlineServices.map((decision) => (
              <PromotionPill
                compact
                copy={copy}
                decision={decision}
                key={decision.serviceId}
              />
            ))}
          </span>
        )}
      </button>

      {shouldShowPopover ? (
        <div
          aria-label={getPromotionPopoverLabel(copy)}
          className="promotion-popover absolute left-0 top-full z-20 mt-2 min-w-[220px] max-w-[320px] rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg shadow-slate-900/8 backdrop-blur"
          data-testid="promotion-status-popover"
          role="dialog"
        >
          <div className="promotion-popover-list flex flex-col gap-1.5">
            {promotionDecision.allServices.map((decision) => (
              <PromotionPopoverItem copy={copy} decision={decision} key={decision.serviceId} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
