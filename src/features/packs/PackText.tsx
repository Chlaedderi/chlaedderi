/**
 * Running text that came out of a mappack.
 *
 * The one place pack strings become markup, and the reason it is a component rather than a string
 * of HTML: JSX puts a token's text in as a child, so it is never parsed. `parseInline` has already
 * decided what counts as bold and what counts as a link -- and only `http(s)` targets do.
 */

import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import { Fragment } from "react";

import { useLang } from "@app/useAppData";
import { type InlineToken, i18, parseInline } from "@core/text";
import type { Block, I18nText } from "@domain/mappack";

const Inline = ({ text }: { text: string }) => (
    <>
        {parseInline(text).map((token: InlineToken, i) => {
            if (token.kind === "bold") return <b key={i}>{token.text}</b>;
            if (token.kind === "link") {
                return (
                    <Link key={i} href={token.url} target="_blank" rel="noopener noreferrer">
                        {token.label}
                    </Link>
                );
            }
            return <Fragment key={i}>{token.text}</Fragment>;
        })}
    </>
);

/** One inline text from a pack, in the language in force. */
export const PackInline = ({ text }: { text: I18nText | null | undefined }) => {
    const lang = useLang();
    return <Inline text={i18(text, lang)} />;
};

/** The blocks of a pack page, in the order the pack gives them. */
export const PackBlocks = ({ blocks }: { blocks: readonly Block[] }) => {
    const lang = useLang();
    return (
        <>
            {blocks.map((block, i) => {
                if (block.h) {
                    return (
                        <Typography key={i} variant="h4" sx={{ mt: 2.5, mb: 1 }}>
                            {i18(block.h, lang)}
                        </Typography>
                    );
                }
                if (block.p) {
                    return (
                        <Typography key={i} variant="body1" sx={{ mb: 1.5 }}>
                            <Inline text={i18(block.p, lang)} />
                        </Typography>
                    );
                }
                if (block.hint) {
                    return (
                        <Typography key={i} variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                            <Inline text={i18(block.hint, lang)} />
                        </Typography>
                    );
                }
                if (block.ul) {
                    return (
                        <List key={i} dense sx={{ listStyleType: "disc", pl: 3, py: 0, mb: 1.5 }}>
                            {block.ul.map((item, j) => (
                                <ListItem key={j} sx={{ display: "list-item", px: 0, py: 0.25 }}>
                                    <ListItemText
                                        primary={<Inline text={i18(item, lang)} />}
                                        sx={{ my: 0 }}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    );
                }
                return null;
            })}
        </>
    );
};
