import type { DemoPanelState } from "../../lib/tauri/contracts";
import { formatTraySummary } from "../../lib/tauri/summary";

const now = () => new Date().toISOString();

export const createDemoPanelState = (
  summaryMode: "icon-only" | "single-dimension" | "multi-dimension" = "multi-dimension"
): DemoPanelState => {
  const items: DemoPanelState["items"] = [
    {
      serviceId: "openai-demo",
      serviceName: "OpenAI",
      accountLabel: "Personal Sandbox",
      iconKey: "openai",
      statusLabel: "demo",
      lastRefreshedAt: now(),
      quotaDimensions: [
        {
          label: "5h window",
          remainingPercent: 64,
          remainingAbsolute: "64% left",
          resetHint: "Resets in 2h"
        },
        {
          label: "7d window",
          remainingPercent: 82,
          remainingAbsolute: "82% left",
          resetHint: "Resets in 4d"
        }
      ]
    },
    {
      serviceId: "claude-demo",
      serviceName: "Claude",
      accountLabel: "Team Seat",
      iconKey: "claude",
      statusLabel: "demo",
      lastRefreshedAt: now(),
      quotaDimensions: [
        {
          label: "Daily quota",
          remainingPercent: 48,
          remainingAbsolute: "48% left",
          resetHint: "Resets tomorrow"
        }
      ]
    }
  ];

  return {
    desktopSurface: {
      platform: "macos",
      iconState: "offline-demo",
      summaryMode,
      summaryText: formatTraySummary(summaryMode, items),
      panelVisible: false
    },
    updatedAt: now(),
    items
  };
};
