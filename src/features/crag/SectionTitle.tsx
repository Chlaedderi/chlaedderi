/**
 * A section heading of the crag page as the original drew it: a coloured square with the section's
 * icon, then the title in small capitals. Icon and colour come from JUMP_SECTIONS, so the heading
 * and its chip in the rail always match.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { JUMP_SECTIONS, type JumpId } from "./jumpSections";

export const SectionTitle = ({
    section,
    children,
    flex,
}: {
    section: JumpId;
    children: React.ReactNode;
    /** Let the title take the free width, for a heading that shares its row with a button. */
    flex?: boolean;
}) => {
    const s = JUMP_SECTIONS.find((x) => x.id === section)!;
    const Icon = s.icon;
    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.1,
                mb: 1,
                flex: flex ? 1 : undefined,
            }}
        >
            <Box
                aria-hidden
                sx={{
                    flex: "none",
                    width: 30,
                    height: 30,
                    borderRadius: "10px",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: s.color,
                    color: "var(--onc)",
                    boxShadow: `0 3px 8px color-mix(in srgb, ${s.color} 35%, transparent)`,
                }}
            >
                <Icon sx={{ fontSize: 17 }} />
            </Box>
            <Typography
                component="h3"
                sx={{
                    font: "700 16px var(--display)",
                    letterSpacing: ".07em",
                    textTransform: "uppercase",
                    color: "text.primary",
                }}
            >
                {children}
            </Typography>
        </Box>
    );
};
