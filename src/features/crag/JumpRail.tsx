/**
 * The row of section links that follows you down a crag page.
 *
 * A crag page is long -- approach, topos, routes, rain, forecast, logbook, details -- and the one
 * thing a climber standing at the wall wants is usually the route list. The rail puts every section
 * one tap away and marks the one being read, which is what `jumpSpy` did.
 */

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { JUMP_SECTIONS } from "./jumpSections";

export const JumpRail = ({ present }: { present: ReadonlySet<string> }) => {
    const { t } = useTranslation();
    const [active, setActive] = useState<string | null>(null);
    const sections = JUMP_SECTIONS.filter((s) => present.has(s.id));

    // Which section is being read. An observer rather than a scroll handler: it does not run on
    // every pixel, and it keeps working inside the page's own scrolling pane.
    useEffect(() => {
        if (!sections.length) return;
        const seen = new Map<string, number>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) seen.set(entry.target.id, entry.intersectionRatio);
                let best: string | null = null;
                let bestRatio = 0;
                for (const [id, ratio] of seen) {
                    if (ratio > bestRatio) {
                        best = id;
                        bestRatio = ratio;
                    }
                }
                if (best) setActive(best);
            },
            { threshold: [0, 0.25, 0.5, 1] },
        );
        for (const section of sections) {
            const el = document.getElementById(section.id);
            if (el) observer.observe(el);
        }
        return () => observer.disconnect();
    }, [sections]);

    if (sections.length < 2) return null;

    return (
        <Box
            component="nav"
            aria-label={t("j.label")}
            sx={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                display: "flex",
                gap: 0.75,
                overflowX: "auto",
                py: 1,
                bgcolor: "background.default",
                borderBottom: 1,
                borderColor: "divider",
            }}
        >
            {sections.map((section) => {
                const Icon = section.icon;
                return (
                    <Chip
                        key={section.id}
                        clickable
                        size="small"
                        icon={<Icon sx={{ fontSize: 16 }} />}
                        label={t(section.label)}
                        aria-current={active === section.id ? "true" : undefined}
                        onClick={() =>
                            document
                                .getElementById(section.id)
                                ?.scrollIntoView({ behavior: "smooth", block: "start" })
                        }
                        // The original's coloured rail: a tint of the section's colour, filled when read.
                        sx={{
                            flex: "none",
                            fontWeight: 600,
                            border: 1,
                            borderColor: `color-mix(in srgb, ${section.color} 45%, transparent)`,
                            bgcolor:
                                active === section.id
                                    ? section.color
                                    : `color-mix(in srgb, ${section.color} 12%, var(--raise))`,
                            color: active === section.id ? "var(--onc)" : "text.primary",
                            "& .MuiChip-icon": {
                                color: active === section.id ? "var(--onc)" : section.color,
                            },
                            "&:hover": {
                                bgcolor: `color-mix(in srgb, ${section.color} 22%, var(--raise))`,
                            },
                        }}
                    />
                );
            })}
        </Box>
    );
};
