/**
 * The sections a crag page has, in the order it has them.
 *
 * Its own module so that JumpRail.tsx exports a component only, which is what React fast refresh
 * needs, and so the page and the rail cannot disagree about what the sections are. Each carries the
 * colour of its icon square and rail chip, as in the original.
 */

import WalkIcon from "@mui/icons-material/DirectionsWalk";
import ImageIcon from "@mui/icons-material/Image";
import InfoIcon from "@mui/icons-material/InfoOutlined";
import BookIcon from "@mui/icons-material/MenuBook";
import RouteIcon from "@mui/icons-material/Route";
import RainIcon from "@mui/icons-material/WaterDrop";
import SunIcon from "@mui/icons-material/WbSunny";

export const JUMP_SECTIONS = [
    { id: "apsec", label: "j.ap", icon: WalkIcon, color: "var(--park)" },
    { id: "toposec", label: "j.topo", icon: ImageIcon, color: "var(--violet)" },
    { id: "routesec", label: "j.routes", icon: RouteIcon, color: "var(--hot)" },
    { id: "wxsec", label: "j.wx", icon: RainIcon, color: "var(--rainc)" },
    { id: "fcsec", label: "j.fc", icon: SunIcon, color: "var(--amber)" },
    { id: "cragLog", label: "j.log", icon: BookIcon, color: "var(--ok)" },
    { id: "moresec", label: "j.more", icon: InfoIcon, color: "var(--ink2)" },
] as const;

export type JumpId = (typeof JUMP_SECTIONS)[number]["id"];
